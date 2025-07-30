const Player = require('../../src/models/Player');

describe('Player Model', () => {
  it('should be defined', () => {
    expect(Player).toBeDefined();
  });

  it('should require a username and set default elo', async () => {
    const player = new Player({ username: 'testuser' });
    await expect(player.validate()).resolves.toBeUndefined();
    expect(player.elo).toBe(1000);
  });

  it('should fail validation if username is missing', async () => {
    const player = new Player({});
    await expect(player.validate()).rejects.toThrow();
  });
}); 