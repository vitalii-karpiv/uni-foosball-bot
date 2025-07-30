const elo = require('../../src/utils/elo');

describe('elo utils', () => {
  it('should export calculateTeamEloChanges', () => {
    expect(typeof elo.calculateTeamEloChanges).toBe('function');
  });
  it('should export getCurrentSeason', () => {
    expect(typeof elo.getCurrentSeason).toBe('function');
  });
  it('should export K_FACTOR', () => {
    expect(typeof elo.K_FACTOR).toBe('number');
  });

  it('should calculate Elo changes for a 2v2 match', () => {
    const team1 = [1000, 1000];
    const team2 = [1000, 1000];
    const result = elo.calculateTeamEloChanges(team1, team2, 1);
    expect(result).toHaveProperty('newTeam1Ratings');
    expect(result).toHaveProperty('newTeam2Ratings');
    expect(result).toHaveProperty('team1Changes');
    expect(result).toHaveProperty('team2Changes');
    expect(result.team1Changes[0]).toBeGreaterThan(0);
    expect(result.team2Changes[0]).toBeLessThan(0);
  });

  it('should return current season in YYYY-MM format', () => {
    const season = elo.getCurrentSeason();
    expect(season).toMatch(/^\d{4}-\d{2}$/);
  });
}); 