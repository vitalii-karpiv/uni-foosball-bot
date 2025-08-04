const Player = require('../models/Player');
const Match = require('../models/Match');

/**
 * Register a new player
 * @param {string} username - Telegram username
 * @param {string} name - Optional full name
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} Created player object
 */
async function registerPlayer(username, name = null, chatId = null, alias = null) {
  try {
    // Remove @ if present
    const cleanUsername = username.replace('@', '');
    
    // Check if player already exists
    const existingPlayer = await Player.findOne({ username: cleanUsername });
    if (existingPlayer) {
      throw new Error('Player already registered');
    }
    
    // Create new player
    const player = new Player({
      username: cleanUsername,
      name: name || cleanUsername,
      alias: alias,
      elo: 1000,
      chatId: chatId
    });
    
    await player.save();
    return player;
  } catch (error) {
    throw error;
  }
}

/**
 * Get player by username
 * @param {string} username - Telegram username
 * @returns {Promise<Object|null>} Player object or null
 */
async function getPlayerByUsername(username) {
  try {
    const cleanUsername = username.replace('@', '');
    return await Player.findOne({ username: cleanUsername });
  } catch (error) {
    throw error;
  }
}

/**
 * Get player by ID
 * @param {string} playerId - Player ID
 * @returns {Promise<Object|null>} Player object or null
 */
async function getPlayerById(playerId) {
  try {
    return await Player.findById(playerId);
  } catch (error) {
    throw error;
  }
}

/**
 * Update player's Elo rating
 * @param {string} playerId - Player ID
 * @param {number} newElo - New Elo rating
 * @returns {Promise<Object>} Updated player object
 */
async function updatePlayerElo(playerId, newElo) {
  try {
    return await Player.findByIdAndUpdate(
      playerId,
      { elo: newElo },
      { new: true }
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Update player's chatId by username
 * @param {string} username - Telegram username
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} Updated player object
 */
async function updatePlayerChatId(username, chatId) {
  const cleanUsername = username.replace('@', '');
  return await Player.findOneAndUpdate(
    { username: cleanUsername },
    { chatId },
    { new: true }
  );
}

/**
 * Update player's alias by username
 * @param {string} username - Telegram username
 * @param {string} alias - New alias
 * @returns {Promise<Object>} Updated player object
 */
async function updatePlayerAlias(username, alias) {
  const cleanUsername = username.replace('@', '');
  return await Player.findOneAndUpdate(
    { username: cleanUsername },
    { alias },
    { new: true }
  );
}

/**
 * Get all players sorted by Elo rating
 * @returns {Promise<Array>} Array of players
 */
async function getAllPlayers() {
  try {
    return await Player.find().sort({ elo: -1 });
  } catch (error) {
    throw error;
  }
}

/**
 * Get players for current season leaderboard
 * @param {string} season - Season identifier (YYYY-MM)
 * @returns {Promise<Array>} Array of players with season stats
 */
async function getSeasonLeaderboard(season) {
  try {
    // Get all players with their current Elo
    const players = await Player.find().sort({ elo: -1 });
    
    // Get season matches for each player
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const seasonMatches = await Match.find({
          season,
          players: player._id
        }).populate('players winners losers');
        
        const wins = seasonMatches.filter(match => 
          match.winners.some(p => p._id.toString() === player._id.toString())
        ).length;
        
        const totalMatches = seasonMatches.length;
        
        return {
          ...player.toObject(),
          seasonWins: wins,
          seasonMatches: totalMatches,
          seasonWinRate: totalMatches > 0 ? (wins / totalMatches * 100).toFixed(1) : 0
        };
      })
    );
    
    return playersWithStats.sort((a, b) => b.elo - a.elo);
  } catch (error) {
    throw error;
  }
}

/**
 * Get players for all-time leaderboard with comprehensive stats
 * @returns {Promise<Array>} Array of players with all-time stats
 */
async function getAllTimeLeaderboard() {
  try {
    // Get all players with their current Elo
    const players = await Player.find().sort({ elo: -1 });
    
    // Get all matches for each player
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const allMatches = await Match.find({
          players: player._id
        }).populate('players winners losers');
        
        const wins = allMatches.filter(match => 
          match.winners.some(p => p._id.toString() === player._id.toString())
        ).length;
        
        const totalMatches = allMatches.length;
        const winRate = totalMatches > 0 ? (wins / totalMatches * 100).toFixed(1) : 0;
        
        return {
          ...player.toObject(),
          totalWins: wins,
          totalMatches: totalMatches,
          winRate: winRate
        };
      })
    );
    
    return playersWithStats.sort((a, b) => b.elo - a.elo);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  registerPlayer,
  getPlayerByUsername,
  getPlayerById,
  updatePlayerElo,
  getAllPlayers,
  getSeasonLeaderboard,
  getAllTimeLeaderboard,
  updatePlayerChatId,
  updatePlayerAlias
}; 