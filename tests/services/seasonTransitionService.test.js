const seasonTransitionService = require('../../src/services/seasonTransitionService');
const Season = require('../../src/models/Season');
const Player = require('../../src/models/Player');
const seasonService = require('../../src/services/seasonService');

// Mock the bot object
const mockBot = {
  sendMessage: jest.fn()
};

// Mock dependencies
jest.mock('../../src/services/seasonService');
jest.mock('../../src/models/Season');
jest.mock('../../src/models/Player');

describe('Season Transition Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNextSeason', () => {
    it('should return next month for current month', () => {
      const originalDate = global.Date;
      const mockDate = new Date('2024-01-15');
      global.Date = jest.fn(() => mockDate);
      global.Date.getFullYear = mockDate.getFullYear.bind(mockDate);
      global.Date.getMonth = mockDate.getMonth.bind(mockDate);
      
      const result = seasonTransitionService.getNextSeason();
      expect(result).toBe('2024-02');
      
      global.Date = originalDate;
    });

    it('should handle December to January transition', () => {
      const originalDate = global.Date;
      const mockDate = new Date('2024-12-15');
      global.Date = jest.fn(() => mockDate);
      global.Date.getFullYear = mockDate.getFullYear.bind(mockDate);
      global.Date.getMonth = mockDate.getMonth.bind(mockDate);
      
      const result = seasonTransitionService.getNextSeason();
      expect(result).toBe('2025-01');
      
      global.Date = originalDate;
    });
  });

  describe('getPreviousSeason', () => {
    it('should return previous month for current month', () => {
      const originalDate = global.Date;
      const mockDate = new Date('2024-02-15');
      global.Date = jest.fn(() => mockDate);
      global.Date.getFullYear = mockDate.getFullYear.bind(mockDate);
      global.Date.getMonth = mockDate.getMonth.bind(mockDate);
      
      const result = seasonTransitionService.getPreviousSeason();
      expect(result).toBe('2024-01');
      
      global.Date = originalDate;
    });

    it('should handle January to December transition', () => {
      const originalDate = global.Date;
      const mockDate = new Date('2024-01-15');
      global.Date = jest.fn(() => mockDate);
      global.Date.getFullYear = mockDate.getFullYear.bind(mockDate);
      global.Date.getMonth = mockDate.getMonth.bind(mockDate);
      
      const result = seasonTransitionService.getPreviousSeason();
      expect(result).toBe('2023-12');
      
      global.Date = originalDate;
    });
  });

  describe('getSeasonWinners', () => {
    it('should return top 3 players from leaderboard', async () => {
      const mockLeaderboard = {
        summary: [
          { rank: 1, player: { _id: '1', username: 'player1' }, value: 15 },
          { rank: 2, player: { _id: '2', username: 'player2' }, value: 12 },
          { rank: 3, player: { _id: '3', username: 'player3' }, value: 10 },
          { rank: 4, player: { _id: '4', username: 'player4' }, value: 8 }
        ]
      };
      
      seasonService.getSeasonLeaderboard.mockResolvedValue(mockLeaderboard);
      
      const result = await seasonTransitionService.getSeasonWinners('2024-01');
      
      expect(result).toHaveLength(3);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('should return empty array when no leaderboard data', async () => {
      seasonService.getSeasonLeaderboard.mockResolvedValue({ summary: [] });
      
      const result = await seasonTransitionService.getSeasonWinners('2024-01');
      
      expect(result).toEqual([]);
    });
  });

  describe('sendSeasonNotification', () => {
    it('should send winner notification', async () => {
      const player = { _id: '1', username: 'player1', chatId: '123' };
      const winners = [
        { rank: 1, player: { _id: '1', username: 'player1' }, value: 15 }
      ];
      
      await seasonTransitionService.sendSeasonNotification(mockBot, player, winners, '2024-01', true);
      
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('Congratulations'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send regular notification for non-winners', async () => {
      const player = { _id: '2', username: 'player2', chatId: '456' };
      const winners = [
        { rank: 1, player: { _id: '1', username: 'player1' }, value: 15 }
      ];
      
      await seasonTransitionService.sendSeasonNotification(mockBot, player, winners, '2024-01', false);
      
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '456',
        expect.stringContaining('Season 2024-01 has ended'),
        { parse_mode: 'HTML' }
      );
    });

    it('should skip notification for players without chatId', async () => {
      const player = { _id: '1', username: 'player1' }; // No chatId
      const winners = [];
      
      await seasonTransitionService.sendSeasonNotification(mockBot, player, winners, '2024-01', false);
      
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('ensureAllPlayersSeasonStartElo', () => {
    it('should ensure season start Elo for all players', async () => {
      const mockPlayers = [
        { _id: '1', username: 'player1' },
        { _id: '2', username: 'player2' }
      ];
      
      Player.find.mockResolvedValue(mockPlayers);
      seasonService.ensureSeasonStartElo.mockResolvedValue();
      
      await seasonTransitionService.ensureAllPlayersSeasonStartElo('2024-01');
      
      expect(seasonService.ensureSeasonStartElo).toHaveBeenCalledTimes(2);
      expect(seasonService.ensureSeasonStartElo).toHaveBeenCalledWith('1', '2024-01');
      expect(seasonService.ensureSeasonStartElo).toHaveBeenCalledWith('2', '2024-01');
    });
  });

  describe('createNewSeasonAndNotify', () => {
    it('should create new season and notify all players', async () => {
      const mockWinners = [
        { rank: 1, player: { _id: '1', username: 'player1' }, value: 15 }
      ];
      const mockPlayers = [
        { _id: '1', username: 'player1', chatId: '123' },
        { _id: '2', username: 'player2', chatId: '456' }
      ];
      
      // Mock the date functions
      const originalDate = global.Date;
      const mockDate = new Date('2024-02-15');
      global.Date = jest.fn(() => mockDate);
      global.Date.getFullYear = mockDate.getFullYear.bind(mockDate);
      global.Date.getMonth = mockDate.getMonth.bind(mockDate);
      
      seasonService.getSeasonLeaderboard.mockResolvedValue({ summary: mockWinners });
      Player.find.mockResolvedValue(mockPlayers);
      seasonService.ensureSeasonStartElo.mockResolvedValue();
      
      const mockSeasonDoc = { save: jest.fn() };
      Season.mockImplementation(() => mockSeasonDoc);
      
      await seasonTransitionService.createNewSeasonAndNotify(mockBot);
      
      expect(Season).toHaveBeenCalledWith({ season: '2024-02' });
      expect(mockSeasonDoc.save).toHaveBeenCalled();
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2);
      
      global.Date = originalDate;
    });
  });
}); 