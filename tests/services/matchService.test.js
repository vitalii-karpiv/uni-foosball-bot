const matchService = require('../../src/services/matchService');
const playerService = require('../../src/services/playerService');
const seasonService = require('../../src/services/seasonService');
const Match = require('../../src/models/Match');

jest.mock('../../src/services/playerService');
jest.mock('../../src/services/seasonService');
jest.mock('../../src/models/Match');

describe('matchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMatch', () => {
    it('should throw if teams are not 2 players each', async () => {
      await expect(matchService.recordMatch(['a'], ['b', 'c'], 1)).rejects.toThrow('Each team must have exactly 2 players');
    });

    it('should throw if a player is not found', async () => {
      playerService.getPlayerByUsername.mockResolvedValueOnce({ _id: 1, elo: 1000 })
        .mockResolvedValueOnce({ _id: 2, elo: 1000 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: 4, elo: 1000 });
      await expect(matchService.recordMatch(['a', 'b'], ['c', 'd'], 1)).rejects.toThrow('Player @c not found. Please register first.');
    });

    it('should throw if players are not unique', async () => {
      const player = { _id: 1, elo: 1000 };
      playerService.getPlayerByUsername.mockResolvedValue(player);
      await expect(matchService.recordMatch(['a', 'a'], ['b', 'b'], 1)).rejects.toThrow('All players must be different');
    });

    it('should create and save a match, update Elo, and return result', async () => {
      const players = [
        { _id: '1', elo: 1000 },
        { _id: '2', elo: 1000 },
        { _id: '3', elo: 1000 },
        { _id: '4', elo: 1000 }
      ];
      playerService.getPlayerByUsername
        .mockResolvedValueOnce(players[0])
        .mockResolvedValueOnce(players[1])
        .mockResolvedValueOnce(players[2])
        .mockResolvedValueOnce(players[3]);
      playerService.updatePlayerElo.mockResolvedValue();
      const saveMock = jest.fn().mockResolvedValue();
      const populateMock = jest.fn().mockResolvedValue();
      Match.mockImplementation(() => ({
        save: saveMock,
        populate: populateMock
      }));
      seasonService.updateSeasonStats.mockResolvedValue();
      const result = await matchService.recordMatch(['a', 'b'], ['c', 'd'], 1);
      expect(saveMock).toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalledWith('players winners losers');
      expect(seasonService.updateSeasonStats).toHaveBeenCalled();
      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('eloResult');
      expect(result).toHaveProperty('winners');
      expect(result).toHaveProperty('losers');
    });
  });

  describe('getPlayerMatches', () => {
    it('should throw if player not found', async () => {
      playerService.getPlayerByUsername.mockResolvedValue(null);
      await expect(matchService.getPlayerMatches('user')).rejects.toThrow('Player not found');
    });
    it('should return matches for a player', async () => {
      playerService.getPlayerByUsername.mockResolvedValue({ _id: '1' });
      const matches = [{}, {}];
      Match.find.mockReturnValue({
        populate: () => ({ sort: () => ({ limit: () => Promise.resolve(matches) }) })
      });
      const result = await matchService.getPlayerMatches('user');
      expect(result).toEqual(matches);
    });
  });

  describe('getPlayerStats', () => {
    it('should throw if player not found', async () => {
      playerService.getPlayerByUsername.mockResolvedValue(null);
      await expect(matchService.getPlayerStats('user')).rejects.toThrow('Player not found');
    });
    it('should return stats for a player', async () => {
      const player = { _id: '1', elo: 1000 };
      playerService.getPlayerByUsername.mockResolvedValue(player);
      const matches = [
        { winners: [{ _id: '1' }], season: '2024-06' },
        { winners: [{ _id: '2' }], season: '2024-06' }
      ];
      Match.find.mockReturnValue({ populate: () => Promise.resolve(matches) });
      const stats = await matchService.getPlayerStats('user');
      expect(stats).toHaveProperty('player');
      expect(stats).toHaveProperty('totalMatches', 2);
      expect(stats).toHaveProperty('wins', 1);
      expect(stats).toHaveProperty('losses', 1);
      expect(stats).toHaveProperty('winRate');
      expect(stats).toHaveProperty('currentElo', 1000);
      expect(stats).toHaveProperty('seasonMatches');
      expect(stats).toHaveProperty('seasonWins');
      expect(stats).toHaveProperty('seasonWinRate');
      expect(stats).toHaveProperty('recentForm');
    });
  });

  describe('getRecentMatches', () => {
    it('should return recent matches', async () => {
      const matches = [{}, {}];
      Match.find.mockReturnValue({
        populate: () => ({ sort: () => ({ limit: () => Promise.resolve(matches) }) })
      });
      const result = await matchService.getRecentMatches();
      expect(result).toEqual(matches);
    });
  });

  describe('getSeasonMatches', () => {
    it('should return season matches', async () => {
      const matches = [{}, {}];
      Match.find.mockReturnValue({
        populate: () => ({ sort: () => Promise.resolve(matches) })
      });
      const result = await matchService.getSeasonMatches('2024-06');
      expect(result).toEqual(matches);
    });
  });
}); 