const mongoose = require('mongoose');
const seasonService = require('../../src/services/seasonService');
const Season = require('../../src/models/Season');
const Match = require('../../src/models/Match');
const Player = require('../../src/models/Player');

// Mock the dependencies
jest.mock('../../src/models/Season');
jest.mock('../../src/models/Match');
jest.mock('../../src/models/Player');

describe('seasonService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSeasonStats', () => {
    it('should return existing season document', async () => {
      const mockSeason = { season: '2024-06', playerStats: new Map() };
      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSeason)
      });

      const result = await seasonService.getSeasonStats('2024-06');

      expect(Season.findOne).toHaveBeenCalledWith({ season: '2024-06' });
      expect(result).toEqual(mockSeason);
    });

    it('should create new season document if not exists', async () => {
      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const mockNewSeason = { season: '2024-06', playerStats: new Map() };
      Season.mockImplementation(() => mockNewSeason);
      mockNewSeason.save = jest.fn().mockResolvedValue(mockNewSeason);

      const result = await seasonService.getSeasonStats('2024-06');

      expect(Season).toHaveBeenCalledWith({ season: '2024-06' });
      expect(mockNewSeason.save).toHaveBeenCalled();
      expect(result).toEqual(mockNewSeason);
    });
  });

  describe('calculateCategoryPoints', () => {
    it('should assign correct points for rankings', () => {
      const playerStats = [
        { eloGains: 100 },
        { eloGains: 80 },
        { eloGains: 60 },
        { eloGains: 40 }
      ];

      seasonService.calculateCategoryPoints(playerStats, 'eloGains');

      expect(playerStats[0].eloGainsPoints).toBe(3); // 1st place
      expect(playerStats[1].eloGainsPoints).toBe(2); // 2nd place
      expect(playerStats[2].eloGainsPoints).toBe(1); // 3rd place
      expect(playerStats[3].eloGainsPoints).toBe(0); // 4th place
    });

    it('should handle ties correctly', () => {
      const playerStats = [
        { eloGains: 100 },
        { eloGains: 100 }, // Tie with 1st
        { eloGains: 60 },
        { eloGains: 40 }
      ];

      seasonService.calculateCategoryPoints(playerStats, 'eloGains');

      expect(playerStats[0].eloGainsPoints).toBe(3); // 1st place (tie)
      expect(playerStats[1].eloGainsPoints).toBe(3); // 1st place (tie)
      expect(playerStats[2].eloGainsPoints).toBe(1); // 3rd place
      expect(playerStats[3].eloGainsPoints).toBe(0); // 4th place
    });
  });

  describe('calculateTotalPoints', () => {
    it('should sum points from all categories', () => {
      const playerStats = [
        { eloGains: 100, matchesPlayed: 10, dryWins: 2, totalWins: 7, longestStreak: 3 }
      ];

      // Mock calculateCategoryPoints to assign 3 points to each category
      jest.spyOn(seasonService, 'calculateCategoryPoints').mockImplementation((stats, category) => {
        stats.forEach(stat => {
          stat[`${category}Points`] = 3; // Mock all getting 3 points
        });
        return stats;
      });

      seasonService.calculateTotalPoints(playerStats);

      expect(playerStats[0].totalPoints).toBe(15); // 3 points * 5 categories
    });
  });

  describe('calculateWinStreak', () => {
    it('should calculate longest consecutive win streak', () => {
      const playerId = 'player1';
      const matches = [
        {
          playedAt: new Date('2024-06-01'),
          winners: [{ _id: playerId }],
          losers: [{ _id: 'player2' }]
        },
        {
          playedAt: new Date('2024-06-02'),
          winners: [{ _id: playerId }],
          losers: [{ _id: 'player3' }]
        },
        {
          playedAt: new Date('2024-06-03'),
          winners: [{ _id: 'player4' }],
          losers: [{ _id: playerId }]
        },
        {
          playedAt: new Date('2024-06-04'),
          winners: [{ _id: playerId }],
          losers: [{ _id: 'player5' }]
        }
      ];

      const result = seasonService.calculateWinStreak(matches, playerId);

      expect(result).toBe(2); // Longest streak is 2 wins
    });

    it('should return 0 for no matches', () => {
      const result = seasonService.calculateWinStreak([], 'player1');
      expect(result).toBe(0);
    });

    it('should return 0 for no wins', () => {
      const playerId = 'player1';
      const matches = [
        {
          playedAt: new Date('2024-06-01'),
          winners: [{ _id: 'player2' }],
          losers: [{ _id: playerId }]
        }
      ];

      const result = seasonService.calculateWinStreak(matches, playerId);
      expect(result).toBe(0);
    });
  });

  describe('detectDryWin', () => {
    it('should detect dry win when losers lose significant Elo', () => {
      const match = {
        eloChanges: {
          winners: [10, 10],
          losers: [-20, -20] // Average -20, which is < -15
        }
      };

      const result = seasonService.detectDryWin(match);
      expect(result).toBe(true);
    });

    it('should not detect dry win when losers lose minimal Elo', () => {
      const match = {
        eloChanges: {
          winners: [5, 5],
          losers: [-10, -10] // Average -10, which is > -15
        }
      };

      const result = seasonService.detectDryWin(match);
      expect(result).toBe(false);
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('should return empty data when no season stats', async () => {
      const mockSeason = { 
        season: '2024-06', 
        playerStats: new Map(),
        getPlayerStatsArray: jest.fn().mockReturnValue([]),
        populate: jest.fn().mockResolvedValue({ season: '2024-06', playerStats: new Map() })
      };
      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSeason)
      });

      const result = await seasonService.getSeasonLeaderboard('2024-06');

      expect(result.season).toBe('2024-06');
      expect(result.summary).toEqual([]);
      expect(result.categories.eloGains).toEqual([]);
    });

    it('should return formatted leaderboard data', async () => {
      const mockPlayer = { _id: 'player1', username: 'player1', alias: null };
      const mockPlayerStats = [{
        playerId: mockPlayer,
        eloGains: 100,
        matchesPlayed: 10,
        dryWins: 2,
        totalWins: 7,
        longestStreak: 3,
        totalPoints: 15
      }];
      const mockSeason = {
        season: '2024-06',
        playerStats: new Map(),
        getPlayerStatsArray: jest.fn().mockReturnValue(mockPlayerStats),
        populate: jest.fn().mockResolvedValue({
          season: '2024-06',
          playerStats: new Map(),
          getPlayerStatsArray: jest.fn().mockReturnValue(mockPlayerStats)
        })
      };

      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSeason)
      });

      // Mock Player.find to return the mock player
      Player.find.mockResolvedValue([mockPlayer]);

      const result = await seasonService.getSeasonLeaderboard('2024-06');

      expect(result.season).toBe('2024-06');
      expect(result.summary).toHaveLength(1);
      expect(result.summary[0].player).toEqual(mockPlayer);
      expect(result.summary[0].value).toBe(15);
      expect(result.categories.eloGains).toHaveLength(1);
      expect(result.categories.eloGains[0].value).toBe(100);
    });
  });

  describe('Elo gains calculation', () => {
    it('should calculate Elo gains based on season start Elo', async () => {
      // Mock a player with season start Elo
      const mockPlayer = {
        _id: 'player1',
        username: 'player1',
        elo: 1080, // Current Elo
        seasonStartElo: new Map([['2024-06', 1050]]) // Season start Elo
      };
      
      Player.findById.mockResolvedValue(mockPlayer);
      
      // Mock matches for the player
      const mockMatches = [
        {
          _id: 'match1',
          season: '2024-06',
          winners: [{ _id: 'player1' }],
          losers: [{ _id: 'player2' }],
          eloChanges: {
            winners: [30],
            losers: [-30]
          },
          isDryWin: false,
          playedAt: new Date()
        }
      ];
      
      Match.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockMatches)
        })
      });
      
      const seasonDoc = new Season({ season: '2024-06' });
      // Ensure playerStats is a Map
      seasonDoc.playerStats = new Map();
      seasonDoc.addOrUpdatePlayerStats = jest.fn().mockImplementation((playerId, stats) => {
        const playerIdStr = playerId.toString();
        if (seasonDoc.playerStats.has(playerIdStr)) {
          const existingStats = seasonDoc.playerStats.get(playerIdStr);
          Object.keys(stats).forEach(key => {
            existingStats[key] = stats[key];
          });
        } else {
          seasonDoc.playerStats.set(playerIdStr, { playerId, ...stats });
        }
      });
      seasonDoc.getPlayerStatsArray = jest.fn().mockReturnValue(Array.from(seasonDoc.playerStats.values()));
      seasonDoc.getPlayerStatsArray = jest.fn().mockImplementation(() => {
        return Array.from(seasonDoc.playerStats.values());
      });
      seasonDoc.save = jest.fn().mockResolvedValue(seasonDoc);
      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(seasonDoc)
      });
      
      // Call updateSeasonStats
      await seasonService.updateSeasonStats({
        season: '2024-06',
        winners: [mockPlayer],
        losers: [{ _id: 'player2' }],
        players: [mockPlayer, { _id: 'player2' }]
      });
      
      // Verify that Elo gains is calculated as current_elo - season_start_elo
      const playerStatsArray = seasonDoc.getPlayerStatsArray();
      expect(playerStatsArray).toHaveLength(2); // player1 and player2
      const player1Stats = playerStatsArray.find(stat => stat.playerId === 'player1');
      expect(player1Stats.eloGains).toBe(30); // 1080 - 1050 = 30
    });
  });

  describe('Player stats duplication prevention', () => {
    it('should update existing player stats instead of creating duplicates', async () => {
      // Mock a player
      const mockPlayer = {
        _id: 'player1',
        username: 'player1',
        elo: 1080,
        seasonStartElo: new Map([['2024-06', 1050]])
      };
      
      Player.findById.mockResolvedValue(mockPlayer);
      
      // Mock matches for the player
      const mockMatches = [
        {
          _id: 'match1',
          season: '2024-06',
          winners: [{ _id: 'player1' }],
          losers: [{ _id: 'player2' }],
          eloChanges: {
            winners: [30],
            losers: [-30]
          },
          isDryWin: false,
          playedAt: new Date()
        },
        {
          _id: 'match2',
          season: '2024-06',
          winners: [{ _id: 'player1' }],
          losers: [{ _id: 'player3' }],
          eloChanges: {
            winners: [25],
            losers: [-25]
          },
          isDryWin: true,
          playedAt: new Date()
        }
      ];
      
      Match.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockMatches)
        })
      });
      
      const seasonDoc = new Season({ season: '2024-06' });
      // Ensure playerStats is a Map
      seasonDoc.playerStats = new Map();
      seasonDoc.addOrUpdatePlayerStats = jest.fn().mockImplementation((playerId, stats) => {
        const playerIdStr = playerId.toString();
        if (seasonDoc.playerStats.has(playerIdStr)) {
          const existingStats = seasonDoc.playerStats.get(playerIdStr);
          Object.keys(stats).forEach(key => {
            existingStats[key] = stats[key];
          });
        } else {
          seasonDoc.playerStats.set(playerIdStr, { playerId, ...stats });
        }
      });
      seasonDoc.getPlayerStatsArray = jest.fn().mockReturnValue(Array.from(seasonDoc.playerStats.values()));
      seasonDoc.getPlayerStatsArray = jest.fn().mockImplementation(() => {
        return Array.from(seasonDoc.playerStats.values());
      });
      seasonDoc.save = jest.fn().mockResolvedValue(seasonDoc);
      Season.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(seasonDoc)
      });
      
      // Call updateSeasonStats twice (simulating two matches)
      await seasonService.updateSeasonStats({
        season: '2024-06',
        winners: [mockPlayer, { _id: 'player2' }],
        losers: [{ _id: 'player3' }, { _id: 'player4' }],
        players: [mockPlayer, { _id: 'player2' }, { _id: 'player3' }, { _id: 'player4' }]
      });
      
      await seasonService.updateSeasonStats({
        season: '2024-06',
        winners: [mockPlayer, { _id: 'player5' }],
        losers: [{ _id: 'player6' }, { _id: 'player7' }],
        players: [mockPlayer, { _id: 'player5' }, { _id: 'player6' }, { _id: 'player7' }]
      });
      
      // Verify that addOrUpdatePlayerStats was called for each player in each match
      // 2 matches × 4 players per match = 8 calls
      expect(seasonDoc.addOrUpdatePlayerStats).toHaveBeenCalledTimes(8);
      
      // Verify that we have exactly 7 unique players in the stats (player1 appears in both matches)
      expect(seasonDoc.playerStats.size).toBe(7);
    });
  });
}); 