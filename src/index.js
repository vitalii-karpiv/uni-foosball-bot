// Load environment variables first, before any other imports
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { connectToDatabase } = require('./config/database');
const {
  handleRegister,
  handleMatch,
  handleStats,
  handleLeaderboard,
  handleHelp,
  handleUnknown
} = require('./handlers/commandHandlers');

// Check for required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN environment variable is not set');
  console.log('💡 Make sure you have:');
  console.log('   1. Created a .env file from env.example');
  console.log('   2. Set your Telegram bot token from @BotFather');
  console.log('   3. The .env file is in the project root directory');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.log('💡 Make sure you have:');
  console.log('   1. Created a .env file from env.example');
  console.log('   2. Set your MongoDB Atlas connection string');
  console.log('   3. The .env file is in the project root directory');
  process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🤖 Foosbot starting...');
console.log('🔧 Environment check passed');

// Connect to database
connectToDatabase();

// Handle /start command
bot.onText(/^\/start$/, async (msg) => {
  try {
    console.log('📨 Received /start command from:', msg.from.username);
    const chatId = msg.chat.id;
    const welcomeMessage = `🎮 <b>Welcome to Foosbot!</b>\n\n` +
                          `I'm here to help you manage 2v2 foosball games at work with Elo ratings and seasonal tracking.\n\n` +
                          `Use /register to get started, or /help to see all available commands.`;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error handling /start command:', error);
  }
});

// Handle /register command
bot.onText(/^\/register$/, async (msg) => {
  try {
    console.log('📨 Received /register command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleRegister(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /register command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while registering. Please try again.');
  }
});

// Handle /match command
bot.onText(/^\/match/, async (msg) => {
  try {
    console.log('📨 Received /match command from:', msg.from.username);
    console.log('📝 Command text:', msg.text);
    const chatId = msg.chat.id;
    const response = await handleMatch(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /match command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while recording the match. Please try again.');
  }
});

// Handle /stats command
bot.onText(/^\/stats$/, async (msg) => {
  try {
    console.log('📨 Received /stats command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleStats(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /stats command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while fetching stats. Please try again.');
  }
});

// Handle /leaderboard command
bot.onText(/^\/leaderboard$/, async (msg) => {
  try {
    console.log('📨 Received /leaderboard command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleLeaderboard(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /leaderboard command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while fetching the leaderboard. Please try again.');
  }
});

// Handle /help command
bot.onText(/^\/help$/, async (msg) => {
  try {
    console.log('📨 Received /help command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleHelp(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /help command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while showing help. Please try again.');
  }
});

// Handle all other messages (including unknown commands)
bot.on('message', async (msg) => {
  try {
    // Only respond to commands that start with /
    if (msg.text && !msg.text.startsWith('/')) {
      console.log('📨 Received unknown command from:', msg.from.username);
      console.log('📝 Command text:', msg.text);
      console.log('🔍 This command was not handled by any specific handler');
      
      const chatId = msg.chat.id;
      const response = await handleUnknown(msg);
      await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
    }
    
    // For non-command messages, just log them but don't respond
    console.log('📨 Received non-command message from:', msg.from.username, 'Text:', msg.text);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Handle bot errors
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Foosbot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Foosbot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('✅ Foosbot is running!');
console.log('📝 Use /help to see available commands'); 