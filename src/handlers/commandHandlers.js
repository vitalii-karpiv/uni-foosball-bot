const playerService = require('../services/playerService');
const matchService = require('../services/matchService');
const { getCurrentSeason } = require('../utils/elo');

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
    
    await playerService.registerPlayer(username, name);
    
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
 * Handle /match command - Record a 2v2 match
 */
async function handleMatch(msg) {
  try {
    const text = msg.text;
    console.log('🔍 Parsing match command:', text);
    
    // Parse command: /match @p1 @p2 vs @p3 @p4 (first pair always wins)
    const match = text.match(/^\/match\s+@(\w+)\s+@(\w+)\s+vs\s+@(\w+)\s+@(\w+)$/i);
    
    if (!match) {
      console.log('❌ Invalid match format');
      return {
        text: `❌ <b>Invalid match format!</b>\n\nUse: <code>/match @p1 @p2 vs @p3 @p4</code>\n\nExample: <code>/match @john @jane vs @bob @alice</code>\n\n<i>The first pair (@p1 @p2) are the winners.</i>`,
        parse_mode: 'HTML'
      };
    }
    
    const [, p1, p2, p3, p4] = match;
    console.log('✅ Parsed players:', p1, p2, p3, p4, 'first pair wins');
    
    const team1Usernames = [p1, p2]; // First pair (winners)
    const team2Usernames = [p3, p4]; // Second pair (losers)
    const winnerTeam = 1; // First team always wins
    
    const result = await matchService.recordMatch(team1Usernames, team2Usernames, winnerTeam);
    
    const { match: matchRecord, eloResult, winners, losers } = result;
    
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
  } catch (error) {
    console.error('❌ Error in handleMatch:', error.message);
    if (error.message.includes('not found')) {
      return {
        text: `❌ <b>Player not found!</b>\n\nMake sure all players are registered using /register first.`,
        parse_mode: 'HTML'
      };
    }
    if (error.message.includes('must be different')) {
      return {
        text: `❌ <b>Invalid teams!</b>\n\nAll players must be different.`,
        parse_mode: 'HTML'
      };
    }
    throw error;
  }
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
                   `• <code>/match @p1 @p2 vs @p3 @p4</code> - Record a 2v2 match\n` +
                   `• Example: <code>/match @john @jane vs @bob @alice</code>\n` +
                   `• <i>The first pair (@p1 @p2) are the winners</i>\n\n` +
                   `📊 <b>Statistics:</b>\n` +
                   `• <code>/stats</code> - View your personal statistics\n` +
                   `• <code>/leaderboard</code> - View current season leaderboard\n\n` +
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
  handleStats,
  handleLeaderboard,
  handleHelp,
  handleUnknown
}; 