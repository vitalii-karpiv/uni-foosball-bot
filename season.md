# Season Command Implementation Plan

## Overview
Implement a `/season` command that displays season statistics with 6 tables: 1 summary table and 5 category tables showing player rankings for the current season.

## Requirements
- **Season**: Current season only (YYYY-MM format)
- **Points System**: Simple ranking (1st=3pts, 2nd=2pts, 3rd=1pt)
- **Dry Win**: Win where losing team scored 0 goals (new boolean field in Match schema)
- **Win Streak**: Longest streak of consecutive wins during the season
- **Table Format**: 3 columns (# | Player | Value), sorted by value descending
- **Summary**: Total points across all categories
- **Data Storage**: Separate Season schema to reduce runtime calculations

## Database Schema Changes

### 1. Match Schema Update
```javascript
// Add to existing Match schema
isDryWin: {
  type: Boolean,
  default: false
}
```

### 2. New Season Schema
```javascript
const seasonSchema = new mongoose.Schema({
  season: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/
  },
  playerStats: [{
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    eloGains: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    dryWins: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Indexes
seasonSchema.index({ season: 1 });
seasonSchema.index({ 'playerStats.playerId': 1 });
```

## Implementation To-Do List

### Phase 1: Database & Models
- [x] **Create Season model** (`src/models/Season.js`)
  - [x] Define schema with playerStats array
  - [x] Add proper indexes
  - [x] Add validation methods
  - [x] Write unit tests for Season model

- [x] **Update Match model** (`src/models/Match.js`)
  - [x] Add `isDryWin` boolean field with default false
  - [x] Update existing tests
  - [x] Add validation for dry win detection

### Phase 2: Service Layer
- [x] **Create seasonService.js** (`src/services/seasonService.js`)
  - [x] `getSeasonStats(season)` - Get or create season statistics
  - [x] `updateSeasonStats(match)` - Update stats after match recording
  - [x] `calculatePlayerPoints(playerStats)` - Calculate ranking points (3-2-1 system)
  - [x] `getSeasonLeaderboard(season)` - Get formatted leaderboard data
  - [x] `detectDryWin(match)` - Determine if match was a dry win
  - [x] `calculateWinStreak(matches)` - Calculate longest consecutive win streak
  - [x] Write comprehensive unit tests

- [x] **Update matchService.js**
  - [x] Modify `recordMatch()` to detect dry wins
  - [x] Add call to `updateSeasonStats()` after match recording
  - [x] Update existing tests
  - [x] Add dry win detection logic

### Phase 3: Command Handler
- [x] **Add handleSeason to commandHandlers.js**
  - [x] Implement `handleSeason(msg)` function
  - [x] Format 6 tables (summary + 5 categories)
  - [x] Use same table format as leaderboard
  - [x] Handle edge cases (no matches, ties, etc.)
  - [x] Add proper error handling
  - [x] Write unit tests for handler

### Phase 4: Bot Integration
- [x] **Update index.js**
  - [x] Add `/season` command handler
  - [x] Register command with bot
  - [x] Add error handling

- [x] **Update help command**
  - [x] Add `/season` to help text
  - [x] Update command descriptions

### Phase 5: Testing & Validation
- [x] **Unit Tests**
  - [x] Test Season model operations
  - [x] Test seasonService methods
  - [x] Test dry win detection
  - [x] Test points calculation
  - [x] Test win streak calculation
  - [x] Test command handler

- [x] **Integration Tests**
  - [x] Test complete `/season` command flow
  - [x] Test season stats update after match recording
  - [x] Test with multiple players and matches
  - [x] Test edge cases (ties, no matches, etc.)

### Phase 6: Documentation & Cleanup
- [x] **Update README.md**
  - [x] Add `/season` command documentation
  - [x] Update features list
  - [x] Add usage examples

- [x] **Code Review & Cleanup**
  - [x] Review all new code
  - [x] Ensure consistent code style
  - [x] Add proper comments
  - [x] Remove any debug code

### Phase 7: Additional Updates (Completed)
- [x] **Dry Win Flow Update**
  - [x] Modified match creation to ask about dry wins instead of auto-detecting
  - [x] Added third step in match creation flow: winners → losers → dry win question
  - [x] Updated matchService to accept isDryWin parameter
  - [x] Updated tests to reflect new flow

- [x] **Elo Points Calculation Update**
  - [x] Added seasonStartElo field to Player model to track Elo at season start
  - [x] Modified Elo gains calculation to use: current_elo - season_start_elo
  - [x] Added ensureSeasonStartElo function to record season start Elo
  - [x] Updated tests to verify correct calculation

- [x] **Season Tables Format Update**
  - [x] Added fourth column to all season tables showing points earned (3, 2, 1, 0)
  - [x] Updated summary table to show "Points | Earned" columns
  - [x] Updated category tables to show "Value | Points" columns
  - [x] Updated tests to verify new table format

## Data Flow
1. **Match Recording**: `recordMatch()` → Detect dry win → Update season stats
2. **Season Command**: `/season` → Get season stats → Calculate points → Format tables
3. **Real-time Updates**: Season document updated immediately after each match

## Points Calculation Logic
```javascript
// For each category (eloGains, matchesPlayed, dryWins, totalWins, longestStreak)
// Sort players by value descending
// Assign points: 1st=3, 2nd=2, 3rd=1, others=0
// Handle ties: Same rank gets same points
// Sum all category points for totalPoints
```

## Table Format Example
```
📊 Season Summary (2024-06)

# | Player     | Points | Earned
--|------------|--------|-------
1 | PlayerA    |     12 |     12
2 | PlayerB    |      8 |      8
3 | PlayerC    |      6 |      6

🏆 Most Elo Points Gained

# | Player     | Points | Points
--|------------|--------|-------
1 | PlayerA    |     45 |      3
2 | PlayerB    |     32 |      2
3 | PlayerC    |     28 |      1
```

## Success Criteria
- [x] `/season` command works correctly
- [x] All 6 tables display properly
- [x] Points calculation is accurate
- [x] Dry wins are asked during match creation
- [x] Win streaks are calculated properly
- [x] Season stats update after each match
- [x] All tests pass
- [x] No performance issues with large datasets
- [x] Elo gains calculated from season start
- [x] Fourth column shows points earned in each category 