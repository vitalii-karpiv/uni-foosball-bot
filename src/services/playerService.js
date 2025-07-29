const Player = require('../models/Player');
const Match = require('../models/Match');

/**
 * Register a new player
 * @param {string} username - Telegram username
 * @param {string} name - Optional full name
 * @returns {Promise<Object>} Created player object
 */
async function registerPlayer(username, name = null) {
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
      elo: 1000
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

module.exports = {
  registerPlayer,
  getPlayerByUsername,
  getPlayerById,
  updatePlayerElo,
  getAllPlayers,
  getSeasonLeaderboard
}; 