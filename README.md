# Foosbot - Telegram 2v2 Foosball Game Manager

A Node.js Telegram bot for managing 2v2 foosball games at work with Elo rating system and seasonal tracking.

## Features

- **Player Registration**: Register players using `/register`
- **Interactive Match Creation**: Create matches with button-based player selection
- **Elo Rating System**: Automatic Elo rating calculations based on team average ratings
- **Seasonal Organization**: Matches are grouped into monthly seasons
- **Season Statistics**: Track player performance with points system and rankings
- **MongoDB Storage**: All data stored in MongoDB Atlas
- **Leaderboards**: View current standings and season statistics

## Setup

### Prerequisites

1. **Node.js** (v16 or higher)
2. **MongoDB Atlas** account
3. **Telegram Bot** (create via @BotFather)

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd foosbot
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `BOT_USERNAME`: Your bot's username (optional)

5. Start the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage

### Commands

- `/register` - Register yourself as a player
- `/alias <name>` - Set your display name for the leaderboard
- `/match` - Start interactive match creation (select winners and losers with buttons)
- `/stats` - View your personal statistics
- `/leaderboard` - View all-time leaderboard table with ELO, matches played, and win rate
- `/season` - View current season statistics with rankings and points
- `/newseason` - Manually trigger season transition (admin command)
- `/help` - Show available commands

### Interactive Match Creation

The new `/match` command provides a user-friendly way to create matches:

1. **Start Match Creation**: Type `/match`
2. **Select Winners**: Click buttons to select 2 winners
3. **Select Losers**: Click buttons to select 2 losers (winners are excluded)
4. **Confirm Match**: The match is automatically recorded with Elo changes

**Features:**
- ✅ Visual feedback for selected players
- 🔄 Reset selection option
- ⏰ 5-minute session timeout for security
- 🚫 Prevents duplicate player selection
- ➡️ Continue button when 2 players selected

### Examples

```
/register
/match  # Interactive match creation
/stats
/leaderboard
```

## Automated Season Management

The bot includes automated season transitions that run on a schedule:

### Automatic Season Transitions
- **Schedule**: Runs on the 1st of every month at 00:01 UTC
- **Process**: 
  1. Creates a new season document for the current month
  2. Records season start Elo ratings for all players
  3. Notifies all players about the previous season's results
  4. Announces season winners (top 3 players by points)

### Season Winner Notifications
Players receive personalized notifications including:
- 🏆 Season results summary
- 🎉 Congratulations for winners (1st, 2nd, 3rd place)
- 🏅 Winner podium with medals
- 📊 Individual performance details

### Manual Season Transition
Use `/newseason` command to manually trigger season transition (useful for testing or special events).

### Season Start Elo Tracking
Each player's Elo rating at the start of a season is automatically recorded, allowing for:
- Season-specific Elo gains calculation
- Fair comparison of performance across seasons
- Historical tracking of player progression

## Database Models

### Player
- `username`: Telegram username (unique)
- `alias`: Optional display name for leaderboard (falls back to username if not set)
- `name`: Optional full name
- `elo`: Current Elo rating (default: 1000)
- `chatId`: Telegram chat ID (used for messaging)
- `createdAt`: Registration date

> Note: If a user was registered before the chatId attribute was added, the bot will automatically update their chatId the next time they interact with the bot (e.g., by using /stats or participating in a match). This ensures all users can receive direct messages from the bot.

### Match
- `players`: Array of 4 player references
- `winners`: Array of 2 winning player references
- `losers`: Array of 2 losing player references
- `season`: Season identifier (YYYY-MM format)
- `eloChanges`: Elo changes for winners and losers
- `playedAt`: Match timestamp

## Elo Rating System

The bot uses a team-based Elo rating system:
- K-factor: 32 (standard for amateur play)
- Initial rating: 1000
- Team ratings calculated as average of individual player ratings
- Rating changes applied equally to all team members

### Team Elo Calculation Logic

```javascript
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
```

## Play Feature

- Use the <code>/play</code> command to invite all users with a chatId to join a foosball match.
- Each invited user receives a message with Yes/No buttons to indicate if they want to play.
- When 4 users agree, all of them receive a message that the match is scheduled.
- Only one play session can be active at a time.

## Workflow

1. **Register Players**: All players must register using `/register`
2. **Create Matches**: Use interactive `/match` command to select players
3. **Track Stats**: View personal and season statistics
4. **View Leaderboards**: Check all-time standings with comprehensive statistics

## Testing

Run the test suite:
```bash
npm test
```

The test suite includes:
- Unit tests for all handlers and services
- Integration tests for the complete match creation flow
- Coverage reporting for all modules

## License

MIT 