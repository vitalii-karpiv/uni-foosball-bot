const commandHandlers = require('../../src/handlers/commandHandlers');
const playerService = require('../../src/services/playerService');
const matchService = require('../../src/services/matchService');

jest.mock('../../src/services/playerService');
jest.mock('../../src/services/matchService');

describe('Match Creation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear match creation state
    commandHandlers.__setMatchCreationState(new Map());
    // Mock updatePlayerChatId to return the player as-is
    playerService.updatePlayerChatId = jest.fn().mockImplementation((username, chatId) => 
      Promise.resolve({ username, chatId })
    );
  });

  it('should complete full match creation flow', async () => {
    // Mock players
    const mockPlayers = [
      { username: 'player1', name: 'Player 1', chatId: '123' },
      { username: 'player2', name: 'Player 2', chatId: '456' },
      { username: 'player3', name: 'Player 3', chatId: '789' },
      { username: 'player4', name: 'Player 4', chatId: '012' }
    ];
    
    playerService.getAllPlayers.mockResolvedValue(mockPlayers);
    playerService.getPlayerByUsername.mockImplementation((username) => {
      return Promise.resolve(mockPlayers.find(p => p.username === username));
    });
    
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

    // Step 1: Start match creation
    const startMsg = { chat: { id: 123 }, from: { id: 456 } };
    const startResult = await commandHandlers.handleMatch(startMsg);
    
    expect(startResult.text).toMatch(/Creating New Match/);
    expect(startResult.text).toMatch(/Please select <b>2 winners<\/b>/);
    expect(startResult.reply_markup.inline_keyboard).toBeDefined();

    // Step 2: Select first winner
    const selectWinner1Query = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player1'
    };
    
    const winner1Result = await commandHandlers.handlePlayerSelection(selectWinner1Query);
    expect(winner1Result.text).toMatch(/Selected: Player 1/);

    // Step 3: Select second winner
    const selectWinner2Query = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player2'
    };
    
    const winner2Result = await commandHandlers.handlePlayerSelection(selectWinner2Query);
    expect(winner2Result.text).toMatch(/Selected: Player 1, Player 2/);
    expect(winner2Result.reply_markup.inline_keyboard).toContainEqual([
      { text: '➡️ Continue', callback_data: 'continue_selection' }
    ]);

    // Step 4: Continue to losers selection
    const continueQuery = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'continue_selection'
    };
    
    const continueResult = await commandHandlers.handlePlayerSelection(continueQuery);
    expect(continueResult.text).toMatch(/Winners selected: Player 1, Player 2/);
    expect(continueResult.text).toMatch(/Please select <b>2 losers<\/b>/);

    // Step 5: Select first loser
    const selectLoser1Query = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player3'
    };
    
    const loser1Result = await commandHandlers.handlePlayerSelection(selectLoser1Query);
    expect(loser1Result.text).toMatch(/Selected: Player 3/);

    // Step 6: Select second loser
    const selectLoser2Query = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player4'
    };
    
    const loser2Result = await commandHandlers.handlePlayerSelection(selectLoser2Query);
    expect(loser2Result.text).toMatch(/Selected: Player 3, Player 4/);

    // Step 7: Complete match recording
    const finalContinueQuery = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'continue_selection'
    };
    
    const finalResult = await commandHandlers.handlePlayerSelection(finalContinueQuery);
    expect(finalResult.text).toMatch(/Match Recorded/);
    expect(finalResult.text).toMatch(/Winners: @player1 \+ @player2/);
    expect(finalResult.text).toMatch(/Losers: @player3 \+ @player4/);
    expect(finalResult.text).toMatch(/Winners: \+10, \+12/);
    expect(finalResult.text).toMatch(/Losers: -10, -12/);

    // Verify match was recorded with correct parameters
    expect(matchService.recordMatch).toHaveBeenCalledWith(
      ['player1', 'player2'],
      ['player3', 'player4'],
      1
    );

    // Verify state was cleared
    const state = commandHandlers.__getMatchCreationState();
    expect(state.has(123)).toBe(false);
  });

  it('should handle deselection of players', async () => {
    const mockPlayers = [
      { username: 'player1', name: 'Player 1', chatId: '123' },
      { username: 'player2', name: 'Player 2', chatId: '456' },
      { username: 'player3', name: 'Player 3', chatId: '789' },
      { username: 'player4', name: 'Player 4', chatId: '012' }
    ];
    
    playerService.getAllPlayers.mockResolvedValue(mockPlayers);
    playerService.getPlayerByUsername.mockImplementation((username) => {
      return Promise.resolve(mockPlayers.find(p => p.username === username));
    });

    // Start match creation
    const startMsg = { chat: { id: 123 }, from: { id: 456 } };
    await commandHandlers.handleMatch(startMsg);

    // Select a player
    const selectQuery = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player1'
    };
    
    const selectResult = await commandHandlers.handlePlayerSelection(selectQuery);
    expect(selectResult.text).toMatch(/Selected: Player 1/);

    // Deselect the same player
    const deselectResult = await commandHandlers.handlePlayerSelection(selectQuery);
    expect(deselectResult.text).toMatch(/Selected: None/);
  });

  it('should handle session timeout', async () => {
    const mockPlayers = [
      { username: 'player1', name: 'Player 1', chatId: '123' },
      { username: 'player2', name: 'Player 2', chatId: '456' },
      { username: 'player3', name: 'Player 3', chatId: '789' },
      { username: 'player4', name: 'Player 4', chatId: '012' }
    ];
    
    playerService.getAllPlayers.mockResolvedValue(mockPlayers);

    // Start match creation
    const startMsg = { chat: { id: 123 }, from: { id: 456 } };
    await commandHandlers.handleMatch(startMsg);

    // Manually set expired timestamp
    const state = commandHandlers.__getMatchCreationState();
    const chatState = state.get(123);
    chatState.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    state.set(123, chatState);

    // Try to interact with expired session
    const expiredQuery = {
      message: { chat: { id: 123 } },
      from: { id: 456 },
      data: 'player_player1'
    };
    
    const expiredResult = await commandHandlers.handlePlayerSelection(expiredQuery);
    expect(expiredResult.text).toMatch(/Match creation session expired/);
  });
}); 