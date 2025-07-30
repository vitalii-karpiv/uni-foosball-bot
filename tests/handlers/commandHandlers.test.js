const commandHandlers = require('../../src/handlers/commandHandlers');
const playerService = require('../../src/services/playerService');
const matchService = require('../../src/services/matchService');

jest.mock('../../src/services/playerService');
jest.mock('../../src/services/matchService');

describe('commandHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRegister', () => {
    it('should return error if no username', async () => {
      const msg = { from: { username: undefined } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/You need to have a Telegram username/);
    });
    it('should register player and return welcome', async () => {
      playerService.registerPlayer.mockResolvedValue();
      const msg = { from: { username: 'user', first_name: 'First', last_name: 'Last' } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/Welcome to Foosbot/);
    });
    it('should return already registered if error thrown', async () => {
      playerService.registerPlayer.mockRejectedValue(new Error('Player already registered'));
      const msg = { from: { username: 'user', first_name: 'First' } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/already registered/);
    });
  });

  describe('handleMatch', () => {
    it('should return error for invalid match format', async () => {
      const msg = { text: '/match @a @b @c @d' };
      const result = await commandHandlers.handleMatch(msg);
      expect(result.text).toMatch(/Invalid match format/);
    });
    it('should record match and return summary', async () => {
      matchService.recordMatch.mockResolvedValue({
        match: { winners: [{ username: 'a' }, { username: 'b' }], losers: [{ username: 'c' }, { username: 'd' }] },
        eloResult: { team1Changes: [10, 12], team2Changes: [-10, -12] },
        winners: [{ username: 'a' }, { username: 'b' }],
        losers: [{ username: 'c' }, { username: 'd' }]
      });
      const msg = { text: '/match @a @b vs @c @d' };
      const result = await commandHandlers.handleMatch(msg);
      expect(result.text).toMatch(/Match Recorded/);
    });
    it('should return player not found error', async () => {
      matchService.recordMatch.mockRejectedValue(new Error('Player @c not found. Please register first.'));
      const msg = { text: '/match @a @b vs @c @d' };
      const result = await commandHandlers.handleMatch(msg);
      expect(result.text).toMatch(/Player not found/);
    });
    it('should return invalid teams error', async () => {
      matchService.recordMatch.mockRejectedValue(new Error('All players must be different'));
      const msg = { text: '/match @a @b vs @a @b' };
      const result = await commandHandlers.handleMatch(msg);
      expect(result.text).toMatch(/Invalid teams/);
    });
  });

  describe('handleStats', () => {
    it('should return error if no username', async () => {
      const msg = { from: { username: undefined } };
      const result = await commandHandlers.handleStats(msg);
      expect(result.text).toMatch(/You need to have a Telegram username/);
    });
    it('should return stats for user', async () => {
      matchService.getPlayerStats.mockResolvedValue({
        totalMatches: 2, wins: 1, losses: 1, winRate: 50, currentElo: 1000, seasonMatches: 2, seasonWins: 1, seasonWinRate: 50, recentForm: 1
      });
      const msg = { from: { username: 'user' } };
      const result = await commandHandlers.handleStats(msg);
      expect(result.text).toMatch(/Stats for @user/);
    });
    it('should return player not found error', async () => {
      matchService.getPlayerStats.mockRejectedValue(new Error('Player not found'));
      const msg = { from: { username: 'user' } };
      const result = await commandHandlers.handleStats(msg);
      expect(result.text).toMatch(/Player not found/);
    });
  });

  describe('handleLeaderboard', () => {
    it('should return empty leaderboard message', async () => {
      playerService.getSeasonLeaderboard.mockResolvedValue([]);
      const msg = {};
      const result = await commandHandlers.handleLeaderboard(msg);
      expect(result.text).toMatch(/No players registered yet/);
    });
    it('should return leaderboard with players', async () => {
      playerService.getSeasonLeaderboard.mockResolvedValue([
        { username: 'a', name: 'A', elo: 1200, seasonWins: 2, seasonMatches: 3, seasonWinRate: 66.7 },
        { username: 'b', name: 'B', elo: 1100, seasonWins: 1, seasonMatches: 3, seasonWinRate: 33.3 }
      ]);
      const msg = {};
      const result = await commandHandlers.handleLeaderboard(msg);
      expect(result.text).toMatch(/Leaderboard/);
      expect(result.text).toMatch(/@a/);
      expect(result.text).toMatch(/@b/);
    });
  });

  describe('handleHelp', () => {
    it('should return help text', async () => {
      const msg = {};
      const result = await commandHandlers.handleHelp(msg);
      expect(result.text).toMatch(/Foosbot Commands/);
    });
  });

  describe('handleUnknown', () => {
    it('should return unknown command text', async () => {
      const msg = {};
      const result = await commandHandlers.handleUnknown(msg);
      expect(result.text).toMatch(/Unknown command/);
    });
  });
}); 