const commandHandlers = require('../../src/handlers/commandHandlers');
const playerService = require('../../src/services/playerService');
const matchService = require('../../src/services/matchService');
const seasonService = require('../../src/services/seasonService');

jest.mock('../../src/services/playerService');
jest.mock('../../src/services/matchService');
jest.mock('../../src/services/seasonService');

describe('commandHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock updatePlayerChatId to return the player as-is
    playerService.updatePlayerChatId = jest.fn().mockImplementation((username, chatId) => 
      Promise.resolve({ username, chatId })
    );
    // Mock getAllTimeLeaderboard
    playerService.getAllTimeLeaderboard = jest.fn();
    // Mock updatePlayerAlias
    playerService.updatePlayerAlias = jest.fn();
  });

  describe('handleRegister', () => {
    it('should return error if no username', async () => {
      const msg = { from: { username: undefined } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/You need to have a Telegram username/);
    });
    it('should register player and return welcome', async () => {
      playerService.registerPlayer.mockResolvedValue();
      const msg = { from: { username: 'user', first_name: 'First', last_name: 'Last' }, chat: { id: 123 } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/Welcome to Foosbot/);
    });
    it('should return already registered if error thrown', async () => {
      playerService.registerPlayer.mockRejectedValue(new Error('Player already registered'));
      const msg = { from: { username: 'user', first_name: 'First' }, chat: { id: 123 } };
      const result = await commandHandlers.handleRegister(msg);
      expect(result.text).toMatch(/already registered/);
    });
  });

  describe('handleMatch', () => {
    it('should return error if match creation already in progress', async () => {
      // Mock that there's already a match creation in progress
      const mockMap = new Map();
      mockMap.set(123, { userId: 456, step: 'select_winners' });
      
      // Mock the matchCreationState Map
      const originalMap = commandHandlers.__getMatchCreationState();
      commandHandlers.__setMatchCreationState(mockMap);
      
      const msg = { chat: { id: 123 }, from: { id: 789 } };
      const result = await commandHandlers.handleMatch(msg);
      
      expect(result.text).toMatch(/Match creation already in progress/);
      
      // Restore original map
      commandHandlers.__setMatchCreationState(originalMap);
    });

    it('should return error if not enough players registered', async () => {
      playerService.getAllPlayers.mockResolvedValue([
        { username: 'player1', name: 'Player 1' },
        { username: 'player2', name: 'Player 2' },
        { username: 'player3', name: 'Player 3' }
      ]);
      
      const msg = { chat: { id: 123 }, from: { id: 456 } };
      const result = await commandHandlers.handleMatch(msg);
      
      expect(result.text).toMatch(/Not enough players registered/);
    });

    it('should start match creation with player selection keyboard', async () => {
      const mockPlayers = [
        { username: 'player1', name: 'Player 1' },
        { username: 'player2', name: 'Player 2' },
        { username: 'player3', name: 'Player 3' },
        { username: 'player4', name: 'Player 4' }
      ];
      
      playerService.getAllPlayers.mockResolvedValue(mockPlayers);
      
      const msg = { chat: { id: 123 }, from: { id: 456 } };
      const result = await commandHandlers.handleMatch(msg);
      
      expect(result.text).toMatch(/Creating New Match/);
      expect(result.text).toMatch(/Please select <b>2 winners<\/b>/);
      expect(result.reply_markup).toBeDefined();
      expect(result.reply_markup.inline_keyboard).toBeDefined();
      
      // Check that keyboard has player buttons
      const keyboard = result.reply_markup.inline_keyboard;
      expect(keyboard.length).toBeGreaterThan(0);
      expect(keyboard[0][0].text).toBe('Player 1');
      expect(keyboard[0][0].callback_data).toBe('player_player1');
    });
  });

  describe('handlePlayerSelection', () => {
    beforeEach(() => {
      // Clear any existing match creation state
      const mockMap = new Map();
      commandHandlers.__setMatchCreationState(mockMap);
    });

    it('should return error for invalid action', async () => {
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'player_player1'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Invalid action/);
    });

    it('should return error for expired session', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_winners',
        winners: [],
        losers: [],
        timestamp: Date.now() - 6 * 60 * 1000 // 6 minutes ago
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'player_player1'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Match creation session expired/);
    });

    it('should handle reset selection', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_winners',
        winners: [{ username: 'player1', name: 'Player 1' }],
        losers: [],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const mockPlayers = [
        { username: 'player1', name: 'Player 1' },
        { username: 'player2', name: 'Player 2' },
        { username: 'player3', name: 'Player 3' },
        { username: 'player4', name: 'Player 4' }
      ];
      playerService.getAllPlayers.mockResolvedValue(mockPlayers);
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'reset_selection'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Please select <b>2 winners<\/b>/);
      expect(result.reply_markup.inline_keyboard).toBeDefined();
    });

    it('should handle player selection for winners', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_winners',
        winners: [],
        losers: [],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const mockPlayers = [
        { username: 'player1', name: 'Player 1', chatId: '123' },
        { username: 'player2', name: 'Player 2', chatId: '456' },
        { username: 'player3', name: 'Player 3', chatId: '789' },
        { username: 'player4', name: 'Player 4', chatId: '012' }
      ];
      playerService.getAllPlayers.mockResolvedValue(mockPlayers);
      playerService.getPlayerByUsername.mockResolvedValue({ username: 'player1', name: 'Player 1', chatId: '123' });
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'player_player1'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Selected: Player 1/);
      expect(result.reply_markup.inline_keyboard).toBeDefined();
    });

    it('should prevent selecting more than 2 winners', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_winners',
        winners: [
          { username: 'player1', name: 'Player 1', chatId: '123' },
          { username: 'player2', name: 'Player 2', chatId: '456' }
        ],
        losers: [],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const mockPlayers = [
        { username: 'player1', name: 'Player 1', chatId: '123' },
        { username: 'player2', name: 'Player 2', chatId: '456' },
        { username: 'player3', name: 'Player 3', chatId: '789' },
        { username: 'player4', name: 'Player 4', chatId: '012' }
      ];
      playerService.getAllPlayers.mockResolvedValue(mockPlayers);
      playerService.getPlayerByUsername.mockResolvedValue({ username: 'player3', name: 'Player 3', chatId: '789' });
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'player_player3'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Maximum 2 winners selected/);
    });

    it('should continue to losers selection when 2 winners selected', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_winners',
        winners: [
          { username: 'player1', name: 'Player 1', chatId: '123' },
          { username: 'player2', name: 'Player 2', chatId: '456' }
        ],
        losers: [],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const mockPlayers = [
        { username: 'player1', name: 'Player 1', chatId: '123' },
        { username: 'player2', name: 'Player 2', chatId: '456' },
        { username: 'player3', name: 'Player 3', chatId: '789' },
        { username: 'player4', name: 'Player 4', chatId: '012' }
      ];
      playerService.getAllPlayers.mockResolvedValue(mockPlayers);
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'continue_selection'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Winners selected: Player 1, Player 2/);
      expect(result.text).toMatch(/Please select <b>2 losers<\/b>/);
    });

    it('should ask about dry win when losers selection is complete', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'select_losers',
        winners: [
          { username: 'player1', name: 'Player 1', chatId: '123' },
          { username: 'player2', name: 'Player 2', chatId: '456' }
        ],
        losers: [
          { username: 'player3', name: 'Player 3', chatId: '789' },
          { username: 'player4', name: 'Player 4', chatId: '012' }
        ],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'continue_selection'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Was this a dry win/);
      expect(result.text).toMatch(/Winners: Player 1, Player 2/);
      expect(result.text).toMatch(/Losers: Player 3, Player 4/);
    });

    it('should record match when dry win is selected', async () => {
      const mockMap = new Map();
      mockMap.set(123, {
        userId: 456,
        step: 'ask_dry_win',
        winners: [
          { username: 'player1', name: 'Player 1', chatId: '123' },
          { username: 'player2', name: 'Player 2', chatId: '456' }
        ],
        losers: [
          { username: 'player3', name: 'Player 3', chatId: '789' },
          { username: 'player4', name: 'Player 4', chatId: '012' }
        ],
        timestamp: Date.now()
      });
      commandHandlers.__setMatchCreationState(mockMap);
      
      matchService.recordMatch.mockResolvedValue({
        match: {
          winners: [{ username: 'player1' }, { username: 'player2' }],
          losers: [{ username: 'player3' }, { username: 'player4' }]
        },
        eloResult: {
          team1Changes: [10, 12],
          team2Changes: [-10, -12]
        }
      });
      
      const callbackQuery = {
        message: { chat: { id: 123 } },
        from: { id: 456 },
        data: 'dry_win_yes'
      };
      
      const result = await commandHandlers.handlePlayerSelection(callbackQuery);
      
      expect(result.text).toMatch(/Match Recorded/);
      expect(result.text).toMatch(/Dry Win/);
      expect(matchService.recordMatch).toHaveBeenCalledWith(
        ['player1', 'player2'],
        ['player3', 'player4'],
        1,
        true
      );
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
      playerService.getAllTimeLeaderboard.mockResolvedValue([]);
      const msg = {};
      const result = await commandHandlers.handleLeaderboard(msg);
      expect(result.text).toMatch(/No players registered yet/);
    });
    it('should return leaderboard with players', async () => {
      playerService.getAllTimeLeaderboard.mockResolvedValue([
        { username: 'a', name: 'A', elo: 1200, totalMatches: 10, totalWins: 7, winRate: 70.0 },
        { username: 'b', name: 'B', elo: 1100, totalMatches: 8, totalWins: 4, winRate: 50.0 }
      ]);
      const msg = {};
      const result = await commandHandlers.handleLeaderboard(msg);
      expect(result.text).toMatch(/All-Time Leaderboard/);
      expect(result.text).toMatch(/# \| Player/);
      expect(result.text).toMatch(/a/);
      expect(result.text).toMatch(/b/);
      expect(result.text).toMatch(/1200/);
      expect(result.text).toMatch(/1100/);
      expect(result.text).toMatch(/70%/);
      expect(result.text).toMatch(/50%/);
    });
    it('should display alias instead of username when available', async () => {
      playerService.getAllTimeLeaderboard.mockResolvedValue([
        { username: 'a', alias: 'ProPlayer', name: 'A', elo: 1200, totalMatches: 10, totalWins: 7, winRate: 70.0 },
        { username: 'b', name: 'B', elo: 1100, totalMatches: 8, totalWins: 4, winRate: 50.0 }
      ]);
      const msg = {};
      const result = await commandHandlers.handleLeaderboard(msg);
      expect(result.text).toMatch(/ProPlayer/);
      expect(result.text).toMatch(/b/);
    });
  });

  describe('handleSeason', () => {
    it('should return empty season message when no matches', async () => {
      seasonService.getSeasonLeaderboard.mockResolvedValue({
        season: '2024-06',
        summary: [],
        categories: {
          eloGains: [],
          matchesPlayed: [],
          dryWins: [],
          totalWins: [],
          longestStreak: []
        }
      });
      const msg = {};
      const result = await commandHandlers.handleSeason(msg);
      expect(result.text).toMatch(/No matches played this season yet/);
    });

    it('should return season statistics with tables including points column', async () => {
      const mockPlayer = { username: 'player1', alias: null };
      seasonService.getSeasonLeaderboard.mockResolvedValue({
        season: '2025-08',
        summary: [
          { rank: 1, player: mockPlayer, value: 15 }
        ],
        categories: {
          eloGains: [
            { rank: 1, player: mockPlayer, value: 100 }
          ],
          matchesPlayed: [
            { rank: 1, player: mockPlayer, value: 10 }
          ],
          dryWins: [
            { rank: 1, player: mockPlayer, value: 2 }
          ],
          totalWins: [
            { rank: 1, player: mockPlayer, value: 7 }
          ],
          longestStreak: [
            { rank: 1, player: mockPlayer, value: 3 }
          ]
        }
      });
      const msg = {};
      const result = await commandHandlers.handleSeason(msg);
      expect(result.text).toMatch(/Season 2025-08/);
      expect(result.text).toMatch(/Season Summary/);
      expect(result.text).toMatch(/Most Elo Points Gained/);
      expect(result.text).toMatch(/Most Matches Played/);
      expect(result.text).toMatch(/Most Dry Wins/);
      expect(result.text).toMatch(/Most Wins/);
      expect(result.text).toMatch(/Longest Win Streak/);
      expect(result.text).toMatch(/player1/);
      expect(result.text).toMatch(/Points/);
      expect(result.text).toMatch(/Elo/);
      expect(result.text).toMatch(/Games/);
      expect(result.text).toMatch(/Wins/);
    });

    it('should display alias instead of username when available', async () => {
      const mockPlayer = { username: 'player1', alias: 'ProPlayer' };
      seasonService.getSeasonLeaderboard.mockResolvedValue({
        season: '2024-06',
        summary: [
          { rank: 1, player: mockPlayer, value: 15 }
        ],
        categories: {
          eloGains: [],
          matchesPlayed: [],
          dryWins: [],
          totalWins: [],
          longestStreak: []
        }
      });
      const msg = {};
      const result = await commandHandlers.handleSeason(msg);
      expect(result.text).toMatch(/ProPlayer/);
    });
  });

  describe('handleAlias', () => {
    it('should return error if no username', async () => {
      const msg = { from: { username: undefined }, text: '/alias TestAlias' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/You need to have a Telegram username/);
    });
    it('should return error if no alias provided', async () => {
      const msg = { from: { username: 'user' }, text: '/alias' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/Usage:/);
    });
    it('should return error if alias is empty', async () => {
      const msg = { from: { username: 'user' }, text: '/alias   ' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/Alias cannot be empty/);
    });
    it('should return error if alias is too long', async () => {
      const msg = { from: { username: 'user' }, text: '/alias ThisAliasIsWayTooLongForTheLimit' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/Alias is too long/);
    });
    it('should update alias successfully', async () => {
      playerService.updatePlayerAlias.mockResolvedValue({ username: 'user', alias: 'TestAlias' });
      const msg = { from: { username: 'user' }, text: '/alias TestAlias' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/Alias updated!/);
      expect(result.text).toMatch(/TestAlias/);
      expect(playerService.updatePlayerAlias).toHaveBeenCalledWith('user', 'TestAlias');
    });
    it('should return player not found error', async () => {
      playerService.updatePlayerAlias.mockResolvedValue(null);
      const msg = { from: { username: 'user' }, text: '/alias TestAlias' };
      const result = await commandHandlers.handleAlias(msg);
      expect(result.text).toMatch(/Player not found/);
    });
  });

  describe('handleHelp', () => {
    it('should return help text', async () => {
      const msg = {};
      const result = await commandHandlers.handleHelp(msg);
      expect(result.text).toMatch(/Foosbot Commands/);
      expect(result.text).toMatch(/interactive match creation/);
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