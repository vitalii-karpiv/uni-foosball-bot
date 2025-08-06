const playerService = require('../services/playerService');
const matchService = require('../services/matchService');
const seasonService = require('../services/seasonService');
const { getCurrentSeason } = require('../utils/elo');

// TODO: Store match creation state (in production, use Redis or database)
const matchCreationState = new Map();

// In-memory play session state
const playSession = {
  invited: [], // usernames
  accepted: [], // usernames
  declined: [], // usernames
  active: false,
  messageIds: {}, // username: messageId
};

/**
 * Handle /register command
 */
async function handleRegister(msg) {
  try {
    console.log('🔍 Processing register command for:', msg.from.username);
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name;
    
    if (!username) {
      console.log('❌ No username found for user');
      return {
        text: '❌ You need to have a Telegram username to register. Please set a username in your Telegram settings and try again.',
        parse_mode: 'HTML'
      };
    }
    
    const name = lastName ? `${firstName} ${lastName}` : firstName;
    console.log('✅ Registering user:', username, 'with name:', name);
    
    await playerService.registerPlayer(username, name, msg.chat.id);
    
    return {
      text: `✅ <b>Welcome to Foosbot!</b>\n\nYou've been successfully registered as <b>@${username}</b>.\n\nYour starting Elo rating is <b>1000</b>.\n\nUse /help to see available commands.`,
      parse_mode: 'HTML'
    };
  } catch (error) {
    console.error('❌ Error in handleRegister:', error.message);
    if (error.message === 'Player already registered') {
      return {
        text: `✅ You're already registered as <b>@${msg.from.username}</b>!`,
        parse_mode: 'HTML'
      };
    }
    throw error;
  }
}

/**
 * Handle /match command - Start interactive match creation
 */
async function handleMatch(msg) {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Check if there's already a match creation in progress
    if (matchCreationState.has(chatId)) {
      return {
        text: '❌ <b>Match creation already in progress!</b>\n\nPlease complete the current match or wait for it to timeout.',
        parse_mode: 'HTML'
      };
    }
    
    // Get all registered players
    const players = await playerService.getAllPlayers();
    
    if (players.length < 4) {
      return {
        text: '❌ <b>Not enough players registered!</b>\n\nAt least 4 players need to be registered to create a match. Use /register to add more players.',
        parse_mode: 'HTML'
      };
    }
    
    // Initialize match creation state
    matchCreationState.set(chatId, {
      userId: userId,
      step: 'select_winners',
      winners: [],
      losers: [],
      timestamp: Date.now()
    });
    
    // Create inline keyboard for player selection
    const keyboard = createPlayerSelectionKeyboard(players, []);
    
    return {
      text: '🏆 <b>Creating New Match</b>\n\nPlease select <b>2 winners</b> for this match:',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  } catch (error) {
    console.error('❌ Error in handleMatch:', error.message);
    throw error;
  }
}

/**
 * Create inline keyboard for player selection
 */
function createPlayerSelectionKeyboard(players, selectedPlayers) {
  const keyboard = [];
  const playersPerRow = 2;
  
  for (let i = 0; i < players.length; i += playersPerRow) {
    const row = [];
    for (let j = 0; j < playersPerRow && i + j < players.length; j++) {
      const player = players[i + j];
      const isSelected = selectedPlayers.some(p => p.username === player.username);
      const buttonText = isSelected ? `✅ ${player.name || player.username}` : player.name || player.username;
      const callbackData = `player_${player.username}`;
      
      row.push({
        text: buttonText,
        callback_data: callbackData
      });
    }
    keyboard.push(row);
  }
  
  // Add control buttons
  const controlRow = [];
  if (selectedPlayers.length > 0) {
    controlRow.push({
      text: '🔄 Reset Selection',
      callback_data: 'reset_selection'
    });
  }
  // Always add Cancel button
  controlRow.push({
    text: '❌ Cancel',
    callback_data: 'cancel_match_creation'
  });

  if (controlRow.length > 0) {
    keyboard.push(controlRow);
  }
  
  return keyboard;
}

/**
 * Handle player selection callback
 * @param {object} callbackQuery - Telegram callback query
 * @param {object} bot - Telegram bot instance (optional, for notifications)
 */
async function handlePlayerSelection(callbackQuery, bot = null) {
  try {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    
    const state = matchCreationState.get(chatId);
    if (!state || state.userId !== userId) {
      return {
        text: '❌ <b>Invalid action!</b>\n\nThis match creation session has expired or belongs to another user.',
        parse_mode: 'HTML'
      };
    }
    
    // Check if session has expired (5 minutes)
    if (Date.now() - state.timestamp > 5 * 60 * 1000) {
      matchCreationState.delete(chatId);
      return {
        text: '❌ <b>Match creation session expired!</b>\n\nPlease start a new match with /match.',
        parse_mode: 'HTML'
      };
    }
    
    if (data === 'reset_selection') {
      // Reset current selection
      if (state.step === 'select_winners') {
        state.winners = [];
      } else {
        state.losers = [];
      }
      
      const players = await playerService.getAllPlayers();
      const currentSelection = state.step === 'select_winners' ? state.winners : state.losers;
      const keyboard = createPlayerSelectionKeyboard(players, currentSelection);
      
      const stepText = state.step === 'select_winners' ? '2 winners' : '2 losers';
      
      return {
        text: `🏆 <b>Creating New Match</b>\n\nPlease select <b>${stepText}</b> for this match:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    }
    
    // Handle cancel action
    if (data === 'cancel_match_creation') {
      matchCreationState.delete(chatId);
      return {
        text: '❌ <b>Match creation cancelled.</b>',
        parse_mode: 'HTML'
      };
    }
    
    if (data.startsWith('player_')) {
      const selectedUsername = data.replace('player_', '');
      let player = await playerService.getPlayerByUsername(selectedUsername);
      
      if (!player) {
        return {
          text: '❌ <b>Player not found!</b>\n\nPlease try again.',
          parse_mode: 'HTML'
        };
      }
      
      const currentSelectionForPlayer = state.step === 'select_winners' ? state.winners : state.losers;
      const isAlreadySelected = currentSelectionForPlayer.some(p => p.username === player.username);
      
      if (isAlreadySelected) {
        // Remove player from selection
        if (state.step === 'select_winners') {
          state.winners = state.winners.filter(p => p.username !== player.username);
        } else {
          state.losers = state.losers.filter(p => p.username !== player.username);
        }
      } else {
        // Add player to selection
        if (state.step === 'select_winners') {
          if (state.winners.length >= 2) {
            return {
              text: '❌ <b>Maximum 2 winners selected!</b>\n\nPlease deselect a player first.',
              parse_mode: 'HTML'
            };
          }
          state.winners.push(player);
        } else {
          if (state.losers.length >= 2) {
            return {
              text: '❌ <b>Maximum 2 losers selected!</b>\n\nPlease deselect a player first.',
              parse_mode: 'HTML'
            };
          }
          state.losers.push(player);
        }
      }
      
      // Update keyboard
      const players = await playerService.getAllPlayers();
      const currentSelectionForKeyboard = state.step === 'select_winners' ? state.winners : state.losers;
      
      // Filter available players based on current step
      let availablePlayers = players;
      if (state.step === 'select_losers') {
        // For losers selection, exclude winners and already selected losers
        availablePlayers = players.filter(p => 
          !state.winners.some(w => w.username === p.username) &&
          !state.losers.some(l => l.username === p.username)
        );
      }
      
      const keyboard = createPlayerSelectionKeyboard(availablePlayers, currentSelectionForKeyboard);
      
      // Add continue button if 2 players selected
      if (currentSelectionForKeyboard.length === 2) {
        // If we're selecting losers and have 2 losers, move to dry win question
        if (state.step === 'select_losers') {
          // Move to dry win question
          state.step = 'ask_dry_win';
          state.timestamp = Date.now(); // Reset timestamp
          
          const keyboard = [
            [
              { text: '✅ Yes, it was a dry win', callback_data: 'dry_win_yes' },
              { text: '❌ No, it was not a dry win', callback_data: 'dry_win_no' }
            ],
            [{ text: '❌ Cancel', callback_data: 'cancel_match_creation' }]
          ];
          
          return {
            text: `🏆 <b>Creating New Match</b>\n\nWinners: ${state.winners.map(p => p.name || p.username).join(', ')}\nLosers: ${state.losers.map(p => p.name || p.username).join(', ')}\n\n<b>Was this a dry win?</b>\n(A dry win means the losing team scored 0 goals)`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          };
        } else {
          // For winners selection, show continue button
          keyboard.push([{
            text: '➡️ Continue',
            callback_data: 'continue_selection'
          }]);
        }
      }
      
      const stepText = state.step === 'select_winners' ? '2 winners' : '2 losers';
      const selectedText = currentSelectionForKeyboard.map(p => p.name || p.username).join(', ');
      
      return {
        text: `🏆 <b>Creating New Match</b>\n\nPlease select <b>${stepText}</b> for this match:\n\nSelected: ${selectedText || 'None'}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    }
    
    if (data === 'continue_selection') {
      if (state.step === 'select_winners') {
        if (state.winners.length !== 2) {
          return {
            text: '❌ <b>Please select exactly 2 winners!</b>',
            parse_mode: 'HTML'
          };
        }
        
        // Move to losers selection
        state.step = 'select_losers';
        state.timestamp = Date.now(); // Reset timestamp
        
        const players = await playerService.getAllPlayers();
        const availablePlayers = players.filter(p => 
          !state.winners.some(w => w.username === p.username)
        );
        
        const keyboard = createPlayerSelectionKeyboard(availablePlayers, []);
        
        return {
          text: `🏆 <b>Creating New Match</b>\n\nWinners selected: ${state.winners.map(p => p.name || p.username).join(', ')}\n\nPlease select <b>2 losers</b> for this match:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        };
      } else if (state.step === 'select_losers') {
        if (state.losers.length !== 2) {
          return {
            text: '❌ <b>Please select exactly 2 losers!</b>',
            parse_mode: 'HTML'
          };
        }
        
        // Move to dry win question
        state.step = 'ask_dry_win';
        state.timestamp = Date.now(); // Reset timestamp
        
        const keyboard = [
          [
            { text: '✅ Yes, it was a dry win', callback_data: 'dry_win_yes' },
            { text: '❌ No, it was not a dry win', callback_data: 'dry_win_no' }
          ],
          [{ text: '❌ Cancel', callback_data: 'cancel_match_creation' }]
        ];
        
        return {
          text: `🏆 <b>Creating New Match</b>\n\nWinners: ${state.winners.map(p => p.name || p.username).join(', ')}\nLosers: ${state.losers.map(p => p.name || p.username).join(', ')}\n\n<b>Was this a dry win?</b>\n(A dry win means the losing team scored 0 goals)`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        };
      }
    }
    
    // Handle dry win selection
    if (data === 'dry_win_yes' || data === 'dry_win_no') {
      if (state.step !== 'ask_dry_win') {
        return {
          text: '❌ <b>Invalid action!</b>\n\nPlease complete the match creation process.',
          parse_mode: 'HTML'
        };
      }
      
      const isDryWin = data === 'dry_win_yes';
      
      // Record the match
      const winnerUsernames = state.winners.map(p => p.username);
      const loserUsernames = state.losers.map(p => p.username);
      
      const result = await matchService.recordMatch(winnerUsernames, loserUsernames, 1, isDryWin);
      
      // Clear the state
      matchCreationState.delete(chatId);
      
      const { match: matchRecord, eloResult } = result;
      
      // Format Elo changes with + or - sign
      const formatEloChange = (change) => change >= 0 ? `+${change}` : `${change}`;
      
      const dryWinText = isDryWin ? ' (Dry Win)' : '';
      const matchNotification = `🏆 <b>New Match Recorded!</b>${dryWinText}\n\n` +
              `<b>Teams:</b>\n` +
              `Winners: @${matchRecord.winners[0].username} + @${matchRecord.winners[1].username}\n` +
              `Losers: @${matchRecord.losers[0].username} + @${matchRecord.losers[1].username}\n\n` +
              `📊 <b>Elo Changes:</b>\n` +
              `Winners: ${formatEloChange(eloResult.team1Changes[0])}, ${formatEloChange(eloResult.team1Changes[1])}\n` +
              `Losers: ${formatEloChange(eloResult.team2Changes[0])}, ${formatEloChange(eloResult.team2Changes[1])}`;
      
      // Send notification to all users with chatId
      if (bot) {
        const players = await playerService.getAllPlayers();
        const usersWithChatId = players.filter(p => p.chatId);
        const matchParticipants = [...winnerUsernames, ...loserUsernames];
        
        for (const player of usersWithChatId) {
          // Skip sending notification to players who participated in this match
          if (matchParticipants.includes(player.username)) {
            continue;
          }
          
          try {
            await bot.sendMessage(player.chatId, matchNotification, { parse_mode: 'HTML' });
          } catch (error) {
            console.error(`Failed to send match notification to ${player.username}:`, error);
          }
        }
      }
      
      return {
        text: matchNotification,
        parse_mode: 'HTML'
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error in handlePlayerSelection:', error.message);
    throw error;
  }
}

/**
 * Handle /play command
 * @param {object} bot - Telegram bot instance
 * @param {object} msg - Telegram message object (from the user who sent /play)
 */
async function handlePlay(bot, msg) {
  // Only allow one play session at a time
  if (playSession.active) {
    console.log('A play session is already in progress. Please wait for it to finish or cancel it.');
    return { 
      text: 'A play session is already in progress. Please wait for it to finish or cancel it.',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancel Play Session', callback_data: 'cancel_play_session' }
        ]]
      },
      parse_mode: 'HTML'
    };
  }
  playSession.active = true;
  playSession.invited = [];
  playSession.accepted = [];
  playSession.declined = [];
  playSession.messageIds = {};

  // Find all users with chatId
  const playerService = require('../services/playerService');
  const players = await playerService.getAllPlayers();
  const usersWithChatId = players.filter(p => p.chatId);

  // Identify initiator
  const initiatorUsername = msg.from.username;
  playSession.invited = usersWithChatId.map(p => p.username).filter(u => u !== initiatorUsername);
  playSession.accepted = [initiatorUsername];

  // Send invitation to each user except initiator
  for (const player of usersWithChatId) {
    if (player.username === initiatorUsername) continue;
    const opts = {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Yes', callback_data: `play_yes_${player.username}` },
          { text: 'No', callback_data: `play_no_${player.username}` }
        ]]
      },
      parse_mode: 'HTML'
    };
    const sentMsg = await bot.sendMessage(player.chatId, '🎲 <b>Do you want to join a foosball match?</b>', opts);
    playSession.messageIds[player.username] = sentMsg.message_id;
  }
  return { text: `Invited ${usersWithChatId.length - 1} players to join the match.` };
}

/**
 * Handle /stats command
 */
async function handleStats(msg) {
  try {
    const username = msg.from.username;
    
    if (!username) {
      return {
        text: '❌ You need to have a Telegram username to view stats. Please set a username in your Telegram settings.',
        parse_mode: 'HTML'
      };
    }
    
    let player = await playerService.getPlayerByUsername(username);
    if (player && !player.chatId && msg.chat && msg.chat.id) {
      await playerService.updatePlayerChatId(username, msg.chat.id);
    }

    const stats = await matchService.getPlayerStats(username);
    
    return {
      text: `📊 <b>Stats for @${username}</b>\n\n` +
            `🏆 <b>Overall:</b>\n` +
            `• Matches: ${stats.totalMatches}\n` +
            `• Wins: ${stats.wins}\n` +
            `• Losses: ${stats.losses}\n` +
            `• Win Rate: ${stats.winRate}%\n` +
            `• Current Elo: <b>${stats.currentElo}</b>\n\n` +
            `📅 <b>Current Season (${getCurrentSeason()}):</b>\n` +
            `• Matches: ${stats.seasonMatches}\n` +
            `• Wins: ${stats.seasonWins}\n` +
            `• Win Rate: ${stats.seasonWinRate}%\n\n` +
            `🔥 <b>Recent Form:</b>\n` +
            `• Last 5 matches: ${stats.recentForm}/5 wins`,
      parse_mode: 'HTML'
    };
  } catch (error) {
    if (error.message === 'Player not found') {
      return {
        text: `❌ <b>Player not found!</b>\n\nYou need to register first using /register.`,
        parse_mode: 'HTML'
      };
    }
    throw error;
  }
}

/**
 * Handle /leaderboard command
 */
async function handleLeaderboard(msg) {
  try {
    const leaderboard = await playerService.getAllTimeLeaderboard();
    
    if (leaderboard.length === 0) {
      return {
        text: `📊 <b>All-Time Leaderboard</b>\n\nNo players registered yet. Use /register to join!`,
        parse_mode: 'HTML'
      };
    }
    
    let text = `📊 <b>All-Time Leaderboard</b>\n\n`;
    
    // Create table header
    text += `<code># | Player     | ELO  | WR\n`;
    text += `--|------------|------|-----\n`;
    
    leaderboard.forEach((player, index) => {
      const rank = index + 1;
      const displayName = getDisplayName(player);
      
      // Format the table row with compact spacing
      text += formatCustomTableRow(rank, displayName, [
        { value: player.elo, padding: 4 },
        { value: `${player.winRate}%`, padding: 0 }
      ]);
    });
    
    text += `</code>`;
    
    return {
      text: text.trim(),
      parse_mode: 'HTML'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Helper function to get display name for a player
 * @param {Object} player - Player object
 * @returns {string} Display name (alias or username)
 */
function getDisplayName(player) {
  return player.alias || player.username;
}

/**
 * Helper function to calculate points based on rank
 * @param {number} rank - Player rank (1-based)
 * @returns {number} Points (3 for 1st, 2 for 2nd, 1 for 3rd, 0 for others)
 */
function calculateRankPoints(rank) {
  return rank <= 3 ? (4 - rank) : 0;
}

/**
 * Helper function to format a table row
 * @param {number} rank - Player rank
 * @param {string} displayName - Player display name
 * @param {number} value - Value to display
 * @param {number} points - Points earned (optional)
 * @param {boolean} isSummary - Whether this is a summary table row
 * @returns {string} Formatted table row
 */
function formatTableRow(rank, displayName, value, points = null, isSummary = false) {
  const rankStr = rank.toString();
  const nameStr = displayName.padEnd(10);
  const valueStr = value.toString().padStart(isSummary ? 6 : 5);
  
  if (isSummary) {
    const earned = value > 0 ? value : '-';
    return `${rankStr} | ${nameStr} | ${valueStr}\n`;
  } else {
    const pointsDisplay = points > 0 ? points.toString() : '-';
    return `${rankStr} | ${nameStr} | ${valueStr} | ${pointsDisplay.padStart(5)}\n`;
  }
}

/**
 * Helper function to format a custom table row with multiple columns
 * @param {number} rank - Player rank
 * @param {string} displayName - Player display name
 * @param {Array} columns - Array of column values with their padding
 * @returns {string} Formatted table row
 */
function formatCustomTableRow(rank, displayName, columns) {
  const rankStr = rank.toString();
  const nameStr = displayName.padEnd(10);
  const columnStrs = columns.map(col => col.value.toString().padStart(col.padding));
  return `${rankStr} | ${nameStr} | ${columnStrs.join(' | ')}\n`;
}

/**
 * Helper function to create a table
 * @param {string} title - Table title
 * @param {Array} data - Array of entries with player and value properties
 * @param {string} valueName - Name for the value column
 * @param {boolean} isSummary - Whether this is a summary table
 * @returns {string} Formatted table
 */
function createTable(title, data, valueName = 'Value', isSummary = false) {
  if (!data || data.length === 0) return '';
  
  let table = `<b>${title}</b>\n`;
  
  if (isSummary) {
    table += `<code># | Player     | ${valueName}\n`;
    table += `--|------------|--------\n`;
  } else {
    table += `<code># | Player     | ${valueName} | Points\n`;
    table += `--|------------|-------|-------\n`;
  }
  
  data.forEach((entry, index) => {
    const rank = index + 1;
    const displayName = getDisplayName(entry.player);
    const points = isSummary ? null : calculateRankPoints(rank);
    table += formatTableRow(rank, displayName, entry.value, points, isSummary);
  });
  
  table += `</code>\n\n`;
  return table;
}

/**
 * Handle /season command
 */
async function handleSeason(msg) {
  try {
    const currentSeason = getCurrentSeason();
    const seasonData = await seasonService.getSeasonLeaderboard(currentSeason);
    
    if (!seasonData.summary || seasonData.summary.length === 0) {
      return {
        text: `📊 <b>Season ${currentSeason}</b>\n\nNo matches played this season yet. Start playing to see season statistics!`,
        parse_mode: 'HTML'
      };
    }
    
    let text = `📊 <b>Season ${currentSeason}</b>\n\n`;
    
    // Summary table
    text += createTable('🏆 Season Summary', seasonData.summary, 'Points', true);
    
    // Category tables
    const categoryConfigs = [
      { key: 'eloGains', title: '🏆 Most Elo Points Gained', valueName: ' Elo ' },
      { key: 'matchesPlayed', title: '🎮 Most Matches Played', valueName: 'Games' },
      { key: 'dryWins', title: '💪 Most Dry Wins', valueName: 'Wins ' },
      { key: 'totalWins', title: '🏅 Most Wins', valueName: 'Wins ' },
      { key: 'longestStreak', title: '🔥 Longest Win Streak', valueName: 'Games' }
    ];
    
    categoryConfigs.forEach(config => {
      const categoryData = seasonData.categories[config.key];
      if (categoryData && categoryData.length > 0) {
        text += createTable(config.title, categoryData, config.valueName, false);
      }
    });
    
    return {
      text: text.trim(),
      parse_mode: 'HTML'
    };
  } catch (error) {
    console.error('❌ Error in handleSeason:', error.message);
    throw error;
  }
}

/**
 * Handle /alias command
 */
async function handleAlias(msg) {
  try {
    const username = msg.from.username;
    
    if (!username) {
      return {
        text: '❌ You need to have a Telegram username to set an alias. Please set a username in your Telegram settings and try again.',
        parse_mode: 'HTML'
      };
    }
    
    // Extract alias from message text (format: /alias <new_alias>)
    const messageText = msg.text || '';
    const parts = messageText.split(' ');
    
    if (parts.length < 2) {
      return {
        text: '❌ <b>Usage:</b> <code>/alias &lt;your_alias&gt;</code>\n\nExample: <code>/alias ProPlayer</code>',
        parse_mode: 'HTML'
      };
    }
    
    const newAlias = parts[1].trim();
    
    if (newAlias.length === 0) {
      return {
        text: '❌ Alias cannot be empty. Please provide a valid alias.',
        parse_mode: 'HTML'
      };
    }
    
    if (newAlias.length > 15) {
      return {
        text: '❌ Alias is too long. Please use 15 characters or less.',
        parse_mode: 'HTML'
      };
    }
    
    // Update the player's alias
    const updatedPlayer = await playerService.updatePlayerAlias(username, newAlias);
    
    if (!updatedPlayer) {
      return {
        text: '❌ Player not found! You need to register first using /register.',
        parse_mode: 'HTML'
      };
    }
    
    return {
      text: `✅ <b>Alias updated!</b>\n\nYour alias is now: <b>${newAlias}</b>\n\nThis will be displayed on the leaderboard instead of your username.`,
      parse_mode: 'HTML'
    };
  } catch (error) {
    console.error('❌ Error in handleAlias:', error.message);
    throw error;
  }
}

/**
 * Handle /help command
 */
async function handleHelp(msg) {
  const helpText = `🤖 <b>Foosbot Commands</b>\n\n` +
                   `📝 <b>Registration:</b>\n` +
                   `• <code>/register</code> - Register yourself as a player\n` +
                   `• <code>/alias &lt;name&gt;</code> - Set your display name for the leaderboard\n\n` +
                   `🏆 <b>Match Recording:</b>\n` +
                   `• <code>/match</code> - Start interactive match creation\n` +
                   `• Select 2 winners and 2 losers using buttons\n\n` +
                   `📊 <b>Statistics:</b>\n` +
                   `• <code>/stats</code> - View your personal statistics\n` +
                   `• <code>/leaderboard</code> - View all-time leaderboard table with ELO, matches, and win rate\n` +
                   `• <code>/season</code> - View current season statistics with rankings\n\n` +
                   `🎲 <b>Play:</b>\n` +
                   `• <code>/play</code> - Invite players to join a match\n\n` +
                   `❓ <b>Help:</b>\n` +
                   `• <code>/help</code> - Show this help message\n\n` +
                   `<i>All players start with 1000 Elo rating. Matches are grouped into monthly seasons.</i>`;
  
  return {
    text: helpText,
    parse_mode: 'HTML'
  };
}

/**
 * Handle unknown commands
 */
async function handleUnknown(msg) {
  return {
    text: `❓ <b>Unknown command!</b>\n\nUse /help to see available commands.`,
    parse_mode: 'HTML'
  };
}

module.exports = {
  handleRegister,
  handleMatch,
  handlePlayerSelection,
  handleStats,
  handleLeaderboard,
  handleSeason,
  handleAlias,
  handleHelp,
  handleUnknown,
  handlePlay,
  playSession,
  // Helper functions for testing
  __getMatchCreationState: () => matchCreationState,
  __setMatchCreationState: (newState) => {
    // Clear the existing map and copy new entries
    matchCreationState.clear();
    if (newState instanceof Map) {
      for (const [key, value] of newState) {
        matchCreationState.set(key, value);
      }
    }
  }
};