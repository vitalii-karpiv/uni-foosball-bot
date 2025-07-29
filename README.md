# Foosbot - Telegram 2v2 Foosball Game Manager

A Node.js Telegram bot for managing 2v2 foosball games at work with Elo rating system and seasonal tracking.

## Features

- **Player Registration**: Register players using `/register`
- **2v2 Match Recording**: Record matches using `/match @p1 @p2 vs @p3 @p4` (first pair wins)
- **Elo Rating System**: Automatic Elo rating calculations based on team average ratings
- **Seasonal Organization**: Matches are grouped into monthly seasons
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
- `/match @p1 @p2 vs @p3 @p4` - Record a 2v2 match (first pair wins)
- `/stats` - View your personal statistics
- `/leaderboard` - View current season leaderboard
- `/help` - Show available commands

### Examples

```
/register
/match @john @jane vs @bob @alice
/stats
/leaderboard
```

## Database Models

### Player
- `username`: Telegram username (unique)
- `name`: Optional full name
- `elo`: Current Elo rating (default: 1000)
- `createdAt`: Registration date

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

## Workflow

1. **Register Players**: All players must register using `/register`
2. **Record Matches**: Record 2v2 matches using `/match` (first pair always wins)
3. **Track Stats**: View personal and season statistics
4. **View Leaderboards**: Check current season standings

## License

MIT 