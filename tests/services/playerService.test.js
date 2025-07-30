const playerService = require('../../src/services/playerService');
const Player = require('../../src/models/Player');
const Match = require('../../src/models/Match');

jest.mock('../../src/models/Player');
jest.mock('../../src/models/Match');

describe('playerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerPlayer', () => {
    it('should throw if player already exists', async () => {
      Player.findOne.mockResolvedValue({ username: 'user' });
      await expect(playerService.registerPlayer('user')).rejects.toThrow('Player already registered');
    });
    it('should create and save a new player', async () => {
      Player.findOne.mockResolvedValue(null);
      const saveMock = jest.fn().mockResolvedValue();
      Player.mockImplementation(() => ({ save: saveMock }));
      const result = await playerService.registerPlayer('user', 'User Name');
      expect(saveMock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getPlayerByUsername', () => {
    it('should return player if found', async () => {
      Player.findOne.mockResolvedValue({ username: 'user' });
      const result = await playerService.getPlayerByUsername('user');
      expect(result).toEqual({ username: 'user' });
    });
    it('should return null if not found', async () => {
      Player.findOne.mockResolvedValue(null);
      const result = await playerService.getPlayerByUsername('user');
      expect(result).toBeNull();
    });
  });

  describe('getPlayerById', () => {
    it('should return player by id', async () => {
      Player.findById.mockResolvedValue({ _id: '1' });
      const result = await playerService.getPlayerById('1');
      expect(result).toEqual({ _id: '1' });
    });
    it('should return null if not found', async () => {
      Player.findById.mockResolvedValue(null);
      const result = await playerService.getPlayerById('1');
      expect(result).toBeNull();
    });
  });

  describe('updatePlayerElo', () => {
    it('should update player elo', async () => {
      Player.findByIdAndUpdate.mockResolvedValue({ _id: '1', elo: 1100 });
      const result = await playerService.updatePlayerElo('1', 1100);
      expect(Player.findByIdAndUpdate).toHaveBeenCalledWith('1', { elo: 1100 }, { new: true });
      expect(result).toEqual({ _id: '1', elo: 1100 });
    });
  });

  describe('getAllPlayers', () => {
    it('should return all players sorted by elo', async () => {
      Player.find.mockReturnValue({ sort: () => Promise.resolve([{ elo: 1200 }, { elo: 1000 }]) });
      const result = await playerService.getAllPlayers();
      expect(result).toEqual([{ elo: 1200 }, { elo: 1000 }]);
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('should return leaderboard with season stats', async () => {
      const players = [
        { _id: '1', elo: 1200, toObject: function() { return this; } },
        { _id: '2', elo: 1000, toObject: function() { return this; } }
      ];
      Player.find.mockReturnValue({ sort: () => Promise.resolve(players) });
      Match.find.mockImplementation(({ season, players: playerId }) => {
        if (playerId === '1') {
          return { populate: () => Promise.resolve([{ winners: [{ _id: '1' }] }]) };
        } else {
          return { populate: () => Promise.resolve([{ winners: [{ _id: '2' }] }]) };
        }
      });
      const result = await playerService.getSeasonLeaderboard('2024-06');
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('seasonWins');
      expect(result[0]).toHaveProperty('seasonMatches');
      expect(result[0]).toHaveProperty('seasonWinRate');
    });
  });
}); 