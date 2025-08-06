const Season = require('../models/Season');
const Match = require('../models/Match');
const Player = require('../models/Player');
const { getCurrentSeason } = require('../utils/elo');

/**
 * Get or create season statistics for a given season
 * @param {string} season - Season identifier (YYYY-MM)
 * @returns {Promise<Object>} Season document
 */
async function getSeasonStats(season) {
  try {
    let seasonDoc = await Season.findOne({ season }).populate('playerStats.playerId');
    
    if (!seasonDoc) {
      // Create new season document
      seasonDoc = new Season({ season });
      await seasonDoc.save();
    }
    
    return seasonDoc;
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate points for players based on their ranking in a category
 * @param {Array} playerStats - Array of player stats for a category
 * @param {string} category - Category name (eloGains, matchesPlayed, etc.)
 * @returns {Array} Array of player stats with points added
 */
function calculateCategoryPoints(playerStats, category) {
  // Sort by category value descending
  const sortedStats = [...playerStats].sort((a, b) => b[category] - a[category]);
  
  // Assign points: 1st=3, 2nd=2, 3rd=1, others=0
  let currentRank = 1;
  let currentValue = null;
  let currentPoints = 3;
  
  sortedStats.forEach((stat, index) => {
    if (index === 0) {
      // First player
      stat[`${category}Points`] = 3;
      currentValue = stat[category];
    } else {
      // Check if tied with previous player
      if (stat[category] === currentValue) {
        // Same rank, same points
        stat[`${category}Points`] = currentPoints;
      } else {
        // New rank
        currentRank = index + 1;
        currentPoints = currentRank <= 3 ? (4 - currentRank) : 0;
        stat[`${category}Points`] = currentPoints;
        currentValue = stat[category];
      }
    }
  });
  
  return sortedStats;
}

/**
 * Calculate total points for all categories
 * @param {Array} playerStats - Array of player stats (modified in place)
 */
function calculateTotalPoints(playerStats) {
  const categories = ['eloGains', 'matchesPlayed', 'dryWins', 'totalWins', 'longestStreak'];
  
  // Calculate points for each category
  categories.forEach(category => {
    calculateCategoryPoints(playerStats, category);
  });
  
  // Sum up total points for each player
  playerStats.forEach(stat => {
    stat.totalPoints = categories.reduce((sum, category) => {
      return sum + (stat[`${category}Points`] || 0);
    }, 0);
  });
  
  // Sort the array in place by total points (descending)
  playerStats.sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Calculate longest consecutive win streak for a player in a season
 * @param {Array} matches - Array of matches for the player in the season
 * @param {string} playerId - Player ID
 * @returns {number} Longest consecutive win streak
 */
function calculateWinStreak(matches, playerId) {
  if (!matches || matches.length === 0) return 0;
  
  // Sort matches by playedAt ascending
  const sortedMatches = matches.sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
  
  let currentStreak = 0;
  let longestStreak = 0;
  
  sortedMatches.forEach(match => {
    const isWinner = match.winners.some(p => p._id.toString() === playerId.toString());
    
    if (isWinner) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  return longestStreak;
}

/**
 * Detect if a match was a dry win (losing team scored 0 goals)
 * Note: Since we don't track goals, we'll use a different approach
 * For now, we'll consider it a dry win if the losing team's Elo change is very negative
 * This is a placeholder - in a real implementation, you'd track actual goals
 * @param {Object} match - Match object
 * @returns {boolean} True if it was a dry win
 */
function detectDryWin(match) {
  // For now, we'll consider it a dry win if the losing team lost significant Elo
  // This is a simplified approach - in reality, you'd track actual goals
  const loserEloChanges = match.eloChanges.losers;
  const avgLoserChange = loserEloChanges.reduce((sum, change) => sum + change, 0) / loserEloChanges.length;
  
  // Consider it a dry win if average loser lost more than 15 Elo points
  return avgLoserChange < -15;
}

/**
 * Ensure player has season start Elo recorded
 * @param {string} playerId - Player ID
 * @param {string} season - Season identifier
 * @returns {Promise<void>}
 */
async function ensureSeasonStartElo(playerId, season) {
  try {
    const player = await Player.findById(playerId);
    if (!player) return;
    
    // Initialize seasonStartElo map if it doesn't exist
    if (!player.seasonStartElo) {
      player.seasonStartElo = new Map();
    }
    
    // If this player doesn't have a season start Elo for this season, record it
    if (!player.seasonStartElo.has(season)) {
      player.seasonStartElo.set(season, player.elo);
      await player.save();
    }
  } catch (error) {
    console.error('Error ensuring season start Elo:', error);
  }
}

/**
 * Update season statistics after a match is recorded
 * @param {Object} match - Match object with populated players, winners, losers
 * @returns {Promise<Object>} Updated season document
 */
async function updateSeasonStats(match) {
  try {
    const season = match.season;
    let seasonDoc = await getSeasonStats(season);
    
    // Get all players involved in the match
    const allPlayers = [...match.winners, ...match.losers];
    
    // Update stats for each player
    for (const player of allPlayers) {
      const playerId = player._id;
      
      // Get all matches for this player in this season
      const playerMatches = await Match.find({
        season,
        players: playerId
      }).populate('players winners losers').sort({ playedAt: 1 });
      
      // Calculate player stats
      const matchesPlayed = playerMatches.length;
      const wins = playerMatches.filter(m => 
        m.winners.some(p => p._id.toString() === playerId.toString())
      ).length;
      
      const dryWins = playerMatches.filter(m => 
        m.isDryWin && m.winners.some(p => p._id.toString() === playerId.toString())
      ).length;
      
      // Ensure season start Elo is recorded
      await ensureSeasonStartElo(playerId, season);
      
      // Calculate Elo gains as difference between current Elo and season start Elo
      const playerDoc = await Player.findById(playerId);
      const seasonStartElo = playerDoc.seasonStartElo.get(season) || playerDoc.elo;
      const eloGains = Math.max(0, playerDoc.elo - seasonStartElo); // Only count positive gains
      
      // Calculate longest win streak
      const longestStreak = calculateWinStreak(playerMatches, playerId);
      
      // Update or add player stats
      seasonDoc.addOrUpdatePlayerStats(playerId, {
        eloGains,
        matchesPlayed,
        dryWins,
        totalWins: wins,
        longestStreak
      });
    }
    
    // Calculate total points for all players
    const playerStatsArray = seasonDoc.getPlayerStatsArray();
    calculateTotalPoints(playerStatsArray);
    
    // Update the Map with calculated total points
    playerStatsArray.forEach(stat => {
      seasonDoc.playerStats.set(stat.playerId.toString(), stat);
    });
    
    await seasonDoc.save();
    return seasonDoc;
  } catch (error) {
    throw error;
  }
}

/**
 * Get formatted season leaderboard data
 * @param {string} season - Season identifier (YYYY-MM)
 * @returns {Promise<Object>} Formatted leaderboard data
 */
async function getSeasonLeaderboard(season) {
  try {
    const seasonDoc = await getSeasonStats(season);
    
    // Get player stats as array
    const playerStatsArray = seasonDoc.getPlayerStatsArray();
    
    if (!playerStatsArray || playerStatsArray.length === 0) {
      return {
        season,
        summary: [],
        categories: {
          eloGains: [],
          matchesPlayed: [],
          dryWins: [],
          totalWins: [],
          longestStreak: []
        }
      };
    }
    
    // Manually populate player references
    const Player = require('../models/Player');
    const playerIds = playerStatsArray.map(stat => stat.playerId);
    const players = await Player.find({ _id: { $in: playerIds } });
    const playerMap = new Map(players.map(player => [player._id.toString(), player]));
    
    // Attach player objects to stats
    playerStatsArray.forEach(stat => {
      stat.playerId = playerMap.get(stat.playerId.toString()) || stat.playerId;
    });
    
    // Sort players by total points for summary
    const summary = playerStatsArray
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((stat, index) => ({
        rank: index + 1,
        player: stat.playerId,
        value: stat.totalPoints
      }));
    
    // Create category tables
    const categories = {
      eloGains: playerStatsArray
        .sort((a, b) => b.eloGains - a.eloGains)
        .map((stat, index) => ({
          rank: index + 1,
          player: stat.playerId,
          value: stat.eloGains
        })),
      matchesPlayed: playerStatsArray
        .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
        .map((stat, index) => ({
          rank: index + 1,
          player: stat.playerId,
          value: stat.matchesPlayed
        })),
      dryWins: playerStatsArray
        .sort((a, b) => b.dryWins - a.dryWins)
        .map((stat, index) => ({
          rank: index + 1,
          player: stat.playerId,
          value: stat.dryWins
        })),
      totalWins: playerStatsArray
        .sort((a, b) => b.totalWins - a.totalWins)
        .map((stat, index) => ({
          rank: index + 1,
          player: stat.playerId,
          value: stat.totalWins
        })),
      longestStreak: playerStatsArray
        .sort((a, b) => b.longestStreak - a.longestStreak)
        .map((stat, index) => ({
          rank: index + 1,
          player: stat.playerId,
          value: stat.longestStreak
        }))
    };
    
    return {
      season,
      summary,
      categories
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getSeasonStats,
  updateSeasonStats,
  calculateCategoryPoints,
  calculateTotalPoints,
  calculateWinStreak,
  detectDryWin,
  getSeasonLeaderboard,
  ensureSeasonStartElo
}; 