const mongoose = require('mongoose');
const Match = require('../../src/models/Match');

describe('Match Model', () => {
  it('should be defined', () => {
    expect(Match).toBeDefined();
  });

  it('should require 4 players, 2 winners, 2 losers, and a valid season', async () => {
    const match = new Match({
      players: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      winners: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      losers: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      season: '2024-06',
      eloChanges: { winners: [10, 12], losers: [-10, -12] }
    });
    await expect(match.validate()).resolves.toBeUndefined();
  });

  it('should fail validation if season format is invalid', async () => {
    const match = new Match({
      players: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      winners: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      losers: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      season: '202406',
      eloChanges: { winners: [10, 12], losers: [-10, -12] }
    });
    await expect(match.validate()).rejects.toThrow();
  });
}); 