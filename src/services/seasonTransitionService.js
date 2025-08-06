const Season = require('../models/Season');
const Player = require('../models/Player');
const { getCurrentSeason } = require('../utils/elo');
const seasonService = require('./seasonService');

/**
 * Get the next season identifier based on current date
 * @returns {string} Next season in YYYY-MM format
 */
function getNextSeason() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If we're in December, next season is January of next year
  if (currentMonth === 12) {
    return `${currentYear + 1}-01`;
  } else {
    // Otherwise, next month of current year
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  }
}

/**
 * Get the previous season identifier
 * @returns {string} Previous season in YYYY-MM format
 */
function getPreviousSeason() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If we're in January, previous season is December of last year
  if (currentMonth === 1) {
    return `${currentYear - 1}-12`;
  } else {
    // Otherwise, previous month of current year
    return `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`;
  }
}

/**
 * Get season winners (top 3 players by total points)
 * @param {string} season - Season identifier
 * @returns {Promise<Array>} Array of winner objects with rank, player, and points
 */
async function getSeasonWinners(season) {
  try {
    const leaderboard = await seasonService.getSeasonLeaderboard(season);
    
    if (!leaderboard.summary || leaderboard.summary.length === 0) {
      return [];
    }
    
    // Return top 3 players
    return leaderboard.summary.slice(0, 3);
  } catch (error) {
    console.error('Error getting season winners:', error);
    return [];
  }
}

/**
 * Send notification to a player about season results
 * @param {Object} bot - Telegram bot instance
 * @param {Object} player - Player object
 * @param {Array} winners - Array of season winners
 * @param {string} season - Season identifier
 * @param {boolean} isWinner - Whether this player is a winner
 */
async function sendSeasonNotification(bot, player, winners, season, isWinner) {
  if (!player.chatId) {
    console.log(`No chatId for player ${player.username}, skipping notification`);
    return;
  }
  
  try {
    let message = `🏆 <b>Season ${season} Results</b>\n\n`;
    
    if (isWinner) {
      const winnerInfo = winners.find(w => w.player._id.toString() === player._id.toString());
      const rank = winnerInfo ? winnerInfo.rank : 0;
      const points = winnerInfo ? winnerInfo.value : 0;
      
      message += `🎉 <b>Congratulations!</b> You finished in <b>${rank}${getRankSuffix(rank)}</b> place!\n`;
      message += `📊 Total Points: <b>${points}</b>\n\n`;
    } else {
      message += `📊 Season ${season} has ended. Check the leaderboard to see how you performed!\n\n`;
    }
    
    // Add winner podium
    if (winners.length > 0) {
      message += `🏅 <b>Season Winners:</b>\n`;
      winners.forEach((winner, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        message += `${medal} ${index + 1}. @${winner.player.username} (${winner.value} pts)\n`;
      });
      message += '\n';
    }
    
    message += `🎮 A new season has started! Use /season to view current season stats.`;
    
    await bot.sendMessage(player.chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(`Failed to send season notification to ${player.username}:`, error);
  }
}

/**
 * Get rank suffix (1st, 2nd, 3rd, etc.)
 * @param {number} rank - Rank number
 * @returns {string} Rank suffix
 */
function getRankSuffix(rank) {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

/**
 * Ensure all players have season start Elo recorded for the new season
 * @param {string} season - Season identifier
 * @returns {Promise<void>}
 */
async function ensureAllPlayersSeasonStartElo(season) {
  try {
    const players = await Player.find({});
    
    for (const player of players) {
      await seasonService.ensureSeasonStartElo(player._id, season);
    }
    
    console.log(`✅ Ensured season start Elo for ${players.length} players in season ${season}`);
  } catch (error) {
    console.error('Error ensuring season start Elo for all players:', error);
  }
}

/**
 * Create a new season and notify players about the previous season results
 * @param {Object} bot - Telegram bot instance
 * @returns {Promise<void>}
 */
async function createNewSeasonAndNotify(bot) {
  try {
    const previousSeason = getPreviousSeason();
    const newSeason = getCurrentSeason();
    
    console.log(`🔄 Starting season transition: ${previousSeason} → ${newSeason}`);
    
    // Get winners from previous season
    const winners = await getSeasonWinners(previousSeason);
    
    // Create new season document
    const newSeasonDoc = new Season({ season: newSeason });
    await newSeasonDoc.save();
    console.log(`✅ Created new season: ${newSeason}`);
    
    // Ensure all players have season start Elo recorded for new season
    await ensureAllPlayersSeasonStartElo(newSeason);
    
    // Get all players to notify
    const allPlayers = await Player.find({});
    
    // Send notifications to all players
    for (const player of allPlayers) {
      const isWinner = winners.some(w => w.player._id.toString() === player._id.toString());
      await sendSeasonNotification(bot, player, winners, previousSeason, isWinner);
    }
    
    console.log(`✅ Season transition completed. Notified ${allPlayers.length} players.`);
    
  } catch (error) {
    console.error('❌ Error during season transition:', error);
  }
}

module.exports = {
  getNextSeason,
  getPreviousSeason,
  getSeasonWinners,
  sendSeasonNotification,
  ensureAllPlayersSeasonStartElo,
  createNewSeasonAndNotify
}; 