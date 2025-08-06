const mongoose = require('mongoose');
const Season = require('../../src/models/Season');

// Mock mongoose connection
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    close: jest.fn().mockResolvedValue({})
  }
}));

describe('Season Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should create a valid season document', () => {
      const seasonData = {
        season: '2024-06'
      };

      const season = new Season(seasonData);

      expect(season.season).toBe('2024-06');
      expect(season.playerStats).toBeInstanceOf(Map);
      expect(season.playerStats.size).toBe(0);
      expect(season.lastUpdated).toBeInstanceOf(Date);
    });

    it('should validate season format', () => {
      const invalidSeason = new Season({ season: 'invalid' });
      
      // Test the schema validation
      const validationError = invalidSeason.validateSync();
      expect(validationError).toBeTruthy();
      expect(validationError.errors.season).toBeTruthy();
    });

    it('should require season field', () => {
      const seasonWithoutSeason = new Season({});
      
      // Test the schema validation
      const validationError = seasonWithoutSeason.validateSync();
      expect(validationError).toBeTruthy();
      expect(validationError.errors.season).toBeTruthy();
    });
  });

  describe('addOrUpdatePlayerStats method', () => {
    it('should add new player stats', () => {
      const season = new Season({ season: '2024-06' });
      const playerId = new mongoose.Types.ObjectId();
      
      const stats = {
        eloGains: 50,
        matchesPlayed: 10,
        dryWins: 2,
        totalWins: 7,
        longestStreak: 3
      };

      season.addOrUpdatePlayerStats(playerId, stats);

      expect(season.playerStats.size).toBe(1);
      const playerStat = season.playerStats.get(playerId.toString());
      expect(playerStat.playerId).toEqual(playerId);
      expect(playerStat.eloGains).toBe(50);
      expect(playerStat.matchesPlayed).toBe(10);
    });

    it('should update existing player stats', () => {
      const playerId = new mongoose.Types.ObjectId();
      const season = new Season({ season: '2024-06' });
      
      // Add initial stats
      season.addOrUpdatePlayerStats(playerId, {
        eloGains: 30,
        matchesPlayed: 5,
        dryWins: 1,
        totalWins: 3,
        longestStreak: 2,
        totalPoints: 0
      });

      const updatedStats = {
        eloGains: 80,
        matchesPlayed: 15
      };

      season.addOrUpdatePlayerStats(playerId, updatedStats);
      expect(season.playerStats.size).toBe(1);
      const playerStat = season.playerStats.get(playerId.toString());
      expect(playerStat.eloGains).toBe(80);
      expect(playerStat.matchesPlayed).toBe(15);
      expect(playerStat.dryWins).toBe(1); // Should preserve existing value
      expect(playerStat.totalWins).toBe(3); // Should preserve existing value
      expect(playerStat.longestStreak).toBe(2); // Should preserve existing value
    });

    it('should update lastUpdated timestamp', () => {
      const season = new Season({ season: '2024-06' });
      const originalDate = season.lastUpdated;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        const playerId = new mongoose.Types.ObjectId();
        season.addOrUpdatePlayerStats(playerId, { eloGains: 50 });
        
        expect(season.lastUpdated.getTime()).toBeGreaterThan(originalDate.getTime());
      }, 10);
    });
  });

  describe('Indexes', () => {
    it('should have season index defined in schema', () => {
      const indexes = Season.schema.indexes();
      const seasonIndex = indexes.find(index => 
        Object.keys(index[0]).includes('season')
      );
      expect(seasonIndex).toBeTruthy();
    });
  });

  describe('Helper methods', () => {
    it('should get player stats as array', () => {
      const season = new Season({ season: '2024-06' });
      const playerId1 = new mongoose.Types.ObjectId();
      const playerId2 = new mongoose.Types.ObjectId();
      
      season.addOrUpdatePlayerStats(playerId1, { eloGains: 50 });
      season.addOrUpdatePlayerStats(playerId2, { eloGains: 30 });
      
      const playerStatsArray = season.getPlayerStatsArray();
      expect(playerStatsArray).toHaveLength(2);
      expect(playerStatsArray.map(stat => stat.playerId)).toContain(playerId1);
      expect(playerStatsArray.map(stat => stat.playerId)).toContain(playerId2);
    });

    it('should get specific player stats', () => {
      const season = new Season({ season: '2024-06' });
      const playerId = new mongoose.Types.ObjectId();
      
      season.addOrUpdatePlayerStats(playerId, { eloGains: 50 });
      
      const playerStats = season.getPlayerStats(playerId);
      expect(playerStats).toBeTruthy();
      expect(playerStats.eloGains).toBe(50);
      
      const nonExistentPlayerId = new mongoose.Types.ObjectId();
      const nonExistentStats = season.getPlayerStats(nonExistentPlayerId);
      expect(nonExistentStats).toBeNull();
    });
  });
}); 