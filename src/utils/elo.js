/**
 * Team Elo Rating System Utilities
 * Uses standard Elo formula with K-factor of 32 for team-based matches
 */

const K_FACTOR = 32; // Standard for amateur play

/**
 * Calculate expected score for a team based on average team rating
 * @param {number} teamARating - Average rating of team A
 * @param {number} teamBRating - Average rating of team B
 * @returns {number} Expected score for team A (0-1)
 */
function getExpectedTeamScore(teamARating, teamBRating) {
  return 1 / (1 + Math.pow(10, (teamBRating - teamARating) / 400));
}

/**
 * Update team Elo ratings based on match result
 * @param {Array} teamARatings - Array of 2 player ratings for team A
 * @param {Array} teamBRatings - Array of 2 player ratings for team B
 * @param {boolean} teamAWins - True if team A wins, false if team B wins
 * @param {number} k - K-factor (default: 32)
 * @returns {Array} Array containing [newTeamARatings, newTeamBRatings]
 */
function updateTeamElo(teamARatings, teamBRatings, teamAWins, k = 32) {
  const avgA = (teamARatings[0] + teamARatings[1]) / 2;
  const avgB = (teamBRatings[0] + teamBRatings[1]) / 2;
  const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
  const resultA = teamAWins ? 1 : 0;

  const deltaA = k * (resultA - expectedA);
  const deltaB = k * ((1 - resultA) - (1 - expectedA));

  const newTeamARatings = teamARatings.map(r => Math.round(r + deltaA));
  const newTeamBRatings = teamBRatings.map(r => Math.round(r + deltaB));

  return [newTeamARatings, newTeamBRatings];
}

/**
 * Calculate Elo changes for a 2v2 match
 * @param {Array} team1Ratings - Array of 2 player ratings for team 1
 * @param {Array} team2Ratings - Array of 2 player ratings for team 2
 * @param {number} winnerTeam - 1 if team1 wins, 2 if team2 wins
 * @returns {object} Object with new ratings and changes
 */
function calculateTeamEloChanges(team1Ratings, team2Ratings, winnerTeam) {
  const team1Wins = winnerTeam === 1;
  
  const [newTeam1Ratings, newTeam2Ratings] = updateTeamElo(
    team1Ratings,
    team2Ratings,
    team1Wins,
    K_FACTOR
  );
  
  // Calculate individual Elo changes
  const team1Changes = newTeam1Ratings.map((newRating, index) => 
    newRating - team1Ratings[index]
  );
  
  const team2Changes = newTeam2Ratings.map((newRating, index) => 
    newRating - team2Ratings[index]
  );
  
  return {
    newTeam1Ratings,
    newTeam2Ratings,
    team1Changes,
    team2Changes,
    expectedTeam1Score: getExpectedTeamScore(
      (team1Ratings[0] + team1Ratings[1]) / 2,
      (team2Ratings[0] + team2Ratings[1]) / 2
    )
  };
}

/**
 * Get current season identifier (YYYY-MM format)
 * @returns {string} Current season
 */
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

module.exports = {
  calculateTeamEloChanges,
  getCurrentSeason,
  K_FACTOR
}; 