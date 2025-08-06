const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  // All 4 players in the match
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  }],
  // Winning team players (2 players)
  winners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  }],
  // Losing team players (2 players)
  losers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  }],
  season: {
    type: String,
    required: true,
    // Format: YYYY-MM
    match: /^\d{4}-\d{2}$/
  },
  // Elo changes for each player
  eloChanges: {
    winners: [Number], // Elo changes for winning players
    losers: [Number]   // Elo changes for losing players
  },
  playedAt: {
    type: Date,
    default: Date.now
  },
  isDryWin: {
    type: Boolean,
    default: false
  }
});

// Indexes for efficient queries
matchSchema.index({ season: 1, playedAt: -1 });
matchSchema.index({ 'players': 1, playedAt: -1 });
matchSchema.index({ 'winners': 1, playedAt: -1 });
matchSchema.index({ 'losers': 1, playedAt: -1 });

module.exports = mongoose.model('Match', matchSchema); 