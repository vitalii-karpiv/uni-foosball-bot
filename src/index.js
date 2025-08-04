// Load environment variables first, before any other imports
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { connectToDatabase } = require('./config/database');
const {
  handleRegister,
  handleMatch,
  handlePlayerSelection,
  handleStats,
  handleLeaderboard,
  handleAlias,
  handleHelp,
  handleUnknown,
  handlePlay
} = require('./handlers/commandHandlers');
const playerService = require('./services/playerService');

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

// Function to send status updates to all users
async function sendPlayStatusUpdate(bot, playSession) {
  const playerService = require('./services/playerService');
  const players = await playerService.getAllPlayers();
  const usersWithChatId = players.filter(p => p.chatId);
  
  const acceptedUsernames = playSession.accepted.map(u => `@${u}`).join(', ');
  const declinedUsernames = playSession.declined.map(u => `@${u}`).join(', ');
  const pendingUsernames = playSession.invited.filter(u => 
    !playSession.accepted.includes(u) && !playSession.declined.includes(u)
  ).map(u => `@${u}`).join(', ');
  
  let statusText = '🎲 <b>Play Session Status</b>\n\n';
  statusText += `✅ <b>Accepted:</b> ${acceptedUsernames || 'None'}\n`;
  statusText += `❌ <b>Declined:</b> ${declinedUsernames || 'None'}\n`;
  if (pendingUsernames) {
    statusText += `⏳ <b>Pending:</b> ${pendingUsernames}\n`;
  }
  statusText += `\n📊 <b>Progress:</b> ${playSession.accepted.length}/4 players`;
  
  for (const player of usersWithChatId) {
    try {
      await bot.sendMessage(player.chatId, statusText, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Failed to send status update to ${player.username}:`, error);
    }
  }
}

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
bot.onText(/^\/match$/, async (msg) => {
  try {
    console.log('📨 Received /match command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleMatch(msg);
    await bot.sendMessage(chatId, response.text, { 
      parse_mode: response.parse_mode,
      reply_markup: response.reply_markup 
    });
  } catch (error) {
    console.error('Error handling /match command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while starting match creation. Please try again.');
  }
});

// Handle /play command
bot.onText(/^\/play$/, async (msg) => {
  try {
    console.log('📨 Received /play command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handlePlay(bot, msg);
    await bot.sendMessage(chatId, response.text, { 
      parse_mode: response.parse_mode,
      reply_markup: response.reply_markup 
    });
  } catch (error) {
    console.error('Error handling /play command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while starting play session. Please try again.');
  }
});

// Enhance callback_query handler for play_yes_ and play_no_
bot.on('callback_query', async (callbackQuery) => {
  try {
    const { data, from, message } = callbackQuery;
    if (data === 'cancel_play_session') {
      const { playSession } = require('./handlers/commandHandlers');
      playSession.active = false;
      playSession.invited = [];
      playSession.accepted = [];
      playSession.declined = [];
      playSession.messageIds = {};
      await bot.editMessageText('✅ Play session cancelled.', {
        chat_id: message.chat.id,
        message_id: message.message_id
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith('play_yes_') || data.startsWith('play_no_')) {
      const username = data.replace('play_yes_', '').replace('play_no_', '');
      const { playSession } = require('./handlers/commandHandlers');
      if (!playSession.active) return;
      if (data.startsWith('play_yes_')) {
        if (!playSession.accepted.includes(username)) playSession.accepted.push(username);
        playSession.declined = playSession.declined.filter(u => u !== username);
        await bot.editMessageText('✅ You have agreed to join the match!', {
          chat_id: message.chat.id,
          message_id: message.message_id
        });
      } else {
        if (!playSession.declined.includes(username)) playSession.declined.push(username);
        playSession.accepted = playSession.accepted.filter(u => u !== username);
        await bot.editMessageText('❌ You have declined to join the match.', {
          chat_id: message.chat.id,
          message_id: message.message_id
        });
      }
      
      // Send status update to all users
      await sendPlayStatusUpdate(bot, playSession);
      
      // If 4 accepted, notify all
      if (playSession.accepted.length === 4) {
        const acceptedUsernames = playSession.accepted.map(u => `@${u}`).join(', ');
        for (const uname of playSession.accepted) {
          const playerService = require('./services/playerService');
          const player = await playerService.getPlayerByUsername(uname);
          if (player && player.chatId) {
            await bot.sendMessage(player.chatId, `🏆 4 players have agreed! The match is scheduled.\n\nPlayers: ${acceptedUsernames}`);
          }
        }
        playSession.active = false;
      }
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    console.log('📨 Received callback query from:', callbackQuery.from.username);
    console.log('📝 Callback data:', callbackQuery.data);
    
    const response = await handlePlayerSelection(callbackQuery, bot);
    
    if (response) {
      await bot.editMessageText(response.text, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: response.parse_mode,
        reply_markup: response.reply_markup
      });
    }
    
    // Answer the callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ An error occurred. Please try again.',
      show_alert: true
    });
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

// Handle /alias command
bot.onText(/^\/alias (.+)$/, async (msg, match) => {
  try {
    console.log('📨 Received /alias command from:', msg.from.username);
    const chatId = msg.chat.id;
    const response = await handleAlias(msg);
    await bot.sendMessage(chatId, response.text, { parse_mode: response.parse_mode });
  } catch (error) {
    console.error('Error handling /alias command:', error);
    await bot.sendMessage(msg.chat.id, '❌ An error occurred while setting alias. Please try again.');
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
    // Patch chatId for any user message if missing
    if (msg.from && msg.from.username && msg.chat && msg.chat.id) {
      const player = await playerService.getPlayerByUsername(msg.from.username);
      if (player && !player.chatId) {
        await playerService.updatePlayerChatId(msg.from.username, msg.chat.id);
      }
    }
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