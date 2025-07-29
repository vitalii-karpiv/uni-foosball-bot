const Match = require('../models/Match');
const { calculateTeamEloChanges, getCurrentSeason } = require('../utils/elo');
const playerService = require('./playerService');

/**
 * Record a new 2v2 match
 * @param {Array} team1Usernames - Array of 2 player usernames for team 1
 * @param {Array} team2Usernames - Array of 2 player usernames for team 2
 * @param {number} winnerTeam - 1 for team1 wins, 2 for team2 wins
 * @returns {Promise<Object>} Created match object
 */
async function recordMatch(team1Usernames, team2Usernames, winnerTeam) {
  try {
    // Validate teams
    if (team1Usernames.length !== 2 || team2Usernames.length !== 2) {
      throw new Error('Each team must have exactly 2 players');
    }

    // Get all players
    const allUsernames = [...team1Usernames, ...team2Usernames];
    const players = [];
    for (const username of allUsernames) {
      const player = await playerService.getPlayerByUsername(username);
      if (!player) {
        throw new Error(`Player @${username} not found. Please register first.`);
      }
      players.push(player);
    }

    // Check for duplicate players
    const uniquePlayers = [...new Set(players.map(p => p._id.toString()))];
    if (uniquePlayers.length !== 4) {
      throw new Error('All players must be different');
    }

    // Determine winners and losers
    const team1Players = players.slice(0, 2);
    const team2Players = players.slice(2, 4);
    
    const winners = winnerTeam === 1 ? team1Players : team2Players;
    const losers = winnerTeam === 1 ? team2Players : team1Players;

    // Get current Elo ratings
    const team1Ratings = team1Players.map(p => p.elo);
    const team2Ratings = team2Players.map(p => p.elo);

    // Calculate Elo changes
    const eloResult = calculateTeamEloChanges(team1Ratings, team2Ratings, winnerTeam);

    // Determine Elo changes for winners and losers
    const winnerChanges = winnerTeam === 1 ? eloResult.team1Changes : eloResult.team2Changes;
    const loserChanges = winnerTeam === 1 ? eloResult.team2Changes : eloResult.team1Changes;

    // Create match record
    const match = new Match({
      players: players.map(p => p._id),
      winners: winners.map(p => p._id),
      losers: losers.map(p => p._id),
      season: getCurrentSeason(),
      eloChanges: {
        winners: winnerChanges,
        losers: loserChanges
      }
    });

    await match.save();

    // Update player Elo ratings
    for (let i = 0; i < 2; i++) {
      await playerService.updatePlayerElo(winners[i]._id, winners[i].elo + winnerChanges[i]);
      await playerService.updatePlayerElo(losers[i]._id, losers[i].elo + loserChanges[i]);
    }

    // Populate references for response
    await match.populate('players winners losers');

    return {
      match,
      eloResult,
      winners,
      losers
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get player's match history
 * @param {string} username - Player's username
 * @param {number} limit - Number of matches to return (default: 10)
 * @returns {Promise<Array>} Array of matches
 */
async function getPlayerMatches(username, limit = 10) {
  try {
    const player = await playerService.getPlayerByUsername(username);
    if (!player) {
      throw new Error('Player not found');
    }

    const matches = await Match.find({
      players: player._id
    })
    .populate('players winners losers')
    .sort({ playedAt: -1 })
    .limit(limit);

    return matches;
  } catch (error) {
    throw error;
  }
}

/**
 * Get player's statistics
 * @param {string} username - Player's username
 * @returns {Promise<Object>} Player statistics
 */
async function getPlayerStats(username) {
  try {
    const player = await playerService.getPlayerByUsername(username);
    if (!player) {
      throw new Error('Player not found');
    }

    const allMatches = await Match.find({
      players: player._id
    }).populate('players winners losers');

    const totalMatches = allMatches.length;
    const wins = allMatches.filter(match => 
      match.winners.some(p => p._id.toString() === player._id.toString())
    ).length;

    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? (wins / totalMatches * 100).toFixed(1) : 0;

    // Get current season stats
    const currentSeason = getCurrentSeason();
    const seasonMatches = allMatches.filter(match => match.season === currentSeason);
    const seasonWins = seasonMatches.filter(match => 
      match.winners.some(p => p._id.toString() === player._id.toString())
    ).length;
    const seasonWinRate = seasonMatches.length > 0 ? 
      (seasonWins / seasonMatches.length * 100).toFixed(1) : 0;

    // Get recent form (last 5 matches)
    const recentMatches = allMatches.slice(0, 5);
    const recentWins = recentMatches.filter(match => 
      match.winners.some(p => p._id.toString() === player._id.toString())
    ).length;

    return {
      player,
      totalMatches,
      wins,
      losses,
      winRate,
      currentElo: player.elo,
      seasonMatches: seasonMatches.length,
      seasonWins,
      seasonWinRate,
      recentForm: recentWins
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get recent matches
 * @param {number} limit - Number of matches to return (default: 10)
 * @returns {Promise<Array>} Array of recent matches
 */
async function getRecentMatches(limit = 10) {
  try {
    return await Match.find()
      .populate('players winners losers')
      .sort({ playedAt: -1 })
      .limit(limit);
  } catch (error) {
    throw error;
  }
}

/**
 * Get season matches
 * @param {string} season - Season identifier (YYYY-MM)
 * @returns {Promise<Array>} Array of season matches
 */
async function getSeasonMatches(season) {
  try {
    return await Match.find({ season })
      .populate('players winners losers')
      .sort({ playedAt: -1 });
  } catch (error) {
    throw error;
  }
}

module.exports = {
  recordMatch,
  getPlayerMatches,
  getPlayerStats,
  getRecentMatches,
  getSeasonMatches
}; 