const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  alias: {
    type: String,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  elo: {
    type: Number,
    default: 1000,
    min: 0
  },
  chatId: {
    type: String,
    required: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
playerSchema.index({ username: 1 });
playerSchema.index({ elo: -1 });

module.exports = mongoose.model('Player', playerSchema); 