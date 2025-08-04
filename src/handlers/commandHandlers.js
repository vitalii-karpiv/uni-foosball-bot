const playerService = require('../services/playerService');
const matchService = require('../services/matchService');
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
 */
async function handlePlayerSelection(callbackQuery) {
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
       // Patch chatId if missing
       if (player && !player.chatId && callbackQuery.from && callbackQuery.message && callbackQuery.message.chat && callbackQuery.message.chat.id) {
         player = await playerService.updatePlayerChatId(player.username, callbackQuery.message.chat.id);
       }
       
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
       const keyboard = createPlayerSelectionKeyboard(players, currentSelectionForKeyboard);
       
       // Add continue button if 2 players selected
       if (currentSelectionForKeyboard.length === 2) {
        keyboard.push([{
          text: '➡️ Continue',
          callback_data: 'continue_selection'
        }]);
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
      } else {
        if (state.losers.length !== 2) {
          return {
            text: '❌ <b>Please select exactly 2 losers!</b>',
            parse_mode: 'HTML'
          };
        }
        
        // Record the match
        const winnerUsernames = state.winners.map(p => p.username);
        const loserUsernames = state.losers.map(p => p.username);
        
        const result = await matchService.recordMatch(winnerUsernames, loserUsernames, 1);
        
        // Clear the state
        matchCreationState.delete(chatId);
        
        const { match: matchRecord, eloResult } = result;
        
        // Format Elo changes with + or - sign
        const formatEloChange = (change) => change >= 0 ? `+${change}` : `${change}`;
        
        return {
          text: `🏆 <b>Match Recorded!</b>\n\n` +
                `<b>Teams:</b>\n` +
                `Winners: @${matchRecord.winners[0].username} + @${matchRecord.winners[1].username}\n` +
                `Losers: @${matchRecord.losers[0].username} + @${matchRecord.losers[1].username}\n\n` +
                `📊 <b>Elo Changes:</b>\n` +
                `Winners: ${formatEloChange(eloResult.team1Changes[0])}, ${formatEloChange(eloResult.team1Changes[1])}\n` +
                `Losers: ${formatEloChange(eloResult.team2Changes[0])}, ${formatEloChange(eloResult.team2Changes[1])}`,
          parse_mode: 'HTML'
        };
      }
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
    const currentSeason = getCurrentSeason();
    const leaderboard = await playerService.getSeasonLeaderboard(currentSeason);
    
    if (leaderboard.length === 0) {
      return {
        text: `📊 <b>Season ${currentSeason} Leaderboard</b>\n\nNo players registered yet. Use /register to join!`,
        parse_mode: 'HTML'
      };
    }
    
    let text = `📊 <b>Season ${currentSeason} Leaderboard</b>\n\n`;
    
    leaderboard.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const name = player.name || player.username;
      
      text += `${medal} <b>@${player.username}</b> (${name})\n`;
      text += `   Elo: <b>${player.elo}</b> | Season: ${player.seasonWins}W/${player.seasonMatches}M (${player.seasonWinRate}%)\n\n`;
    });
    
    return {
      text: text.trim(),
      parse_mode: 'HTML'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle /help command
 */
async function handleHelp(msg) {
  const helpText = `🤖 <b>Foosbot Commands</b>\n\n` +
                   `📝 <b>Registration:</b>\n` +
                   `• <code>/register</code> - Register yourself as a player\n\n` +
                   `🏆 <b>Match Recording:</b>\n` +
                   `• <code>/match</code> - Start interactive match creation\n` +
                   `• Select 2 winners and 2 losers using buttons\n\n` +
                   `📊 <b>Statistics:</b>\n` +
                   `• <code>/stats</code> - View your personal statistics\n` +
                   `• <code>/leaderboard</code> - View current season leaderboard\n\n` +
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