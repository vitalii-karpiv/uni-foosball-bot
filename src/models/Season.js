const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema({
  season: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/
  },
  playerStats: {
    type: Map,
    of: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
      },
      eloGains: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
      dryWins: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 }
    },
    default: new Map()
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
seasonSchema.index({ season: 1 });

// Method to add or update player stats using player ID as key
seasonSchema.methods.addOrUpdatePlayerStats = function(playerId, stats) {
  const playerIdStr = playerId.toString();
  
  if (this.playerStats.has(playerIdStr)) {
    // Update existing player stats
    const existingStats = this.playerStats.get(playerIdStr);
    Object.keys(stats).forEach(key => {
      existingStats[key] = stats[key];
    });
  } else {
    // Add new player stats
    this.playerStats.set(playerIdStr, { playerId, ...stats });
  }
  
  this.lastUpdated = new Date();
  return this;
};

// Method to get player stats as an array (for backward compatibility)
seasonSchema.methods.getPlayerStatsArray = function() {
  return Array.from(this.playerStats.values());
};

// Method to get a specific player's stats
seasonSchema.methods.getPlayerStats = function(playerId) {
  const playerIdStr = playerId.toString();
  return this.playerStats.get(playerIdStr) || null;
};

module.exports = mongoose.model('Season', seasonSchema); 