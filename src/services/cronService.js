const cron = require('node-cron');
const seasonTransitionService = require('./seasonTransitionService');

let botInstance = null;
let seasonTransitionJob = null;

/**
 * Initialize the cron service with bot instance
 * @param {Object} bot - Telegram bot instance
 */
function initializeCronService(bot) {
  botInstance = bot;
  console.log('⏰ Initializing cron service...');
  
  // Schedule season transition job to run on the 1st of every month at 00:01
  // This ensures the previous month's season is properly closed and new season starts
  seasonTransitionJob = cron.schedule('1 0 1 * *', async () => {
    console.log('🕐 Season transition cron job triggered');
    try {
      await seasonTransitionService.createNewSeasonAndNotify(botInstance);
    } catch (error) {
      console.error('❌ Error in season transition cron job:', error);
    }
  }, {
    scheduled: false, // Don't start immediately, we'll start it manually
    timezone: "UTC" // Use UTC timezone
  });
  
  console.log('✅ Cron service initialized');
}

/**
 * Start the cron jobs
 */
function startCronJobs() {
  if (seasonTransitionJob) {
    seasonTransitionJob.start();
    console.log('▶️ Season transition cron job started (runs 1st of every month at 00:01 UTC)');
  } else {
    console.error('❌ Cron jobs not initialized. Call initializeCronService first.');
  }
}

/**
 * Stop the cron jobs
 */
function stopCronJobs() {
  if (seasonTransitionJob) {
    seasonTransitionJob.stop();
    console.log('⏹️ Season transition cron job stopped');
  }
}

/**
 * Get the status of cron jobs
 * @returns {Object} Status of cron jobs
 */
function getCronStatus() {
  return {
    seasonTransitionJob: {
      running: seasonTransitionJob ? seasonTransitionJob.running : false,
      nextRun: seasonTransitionJob ? seasonTransitionJob.nextDate() : null
    }
  };
}

/**
 * Manually trigger season transition (for testing or manual execution)
 * @returns {Promise<void>}
 */
async function manualSeasonTransition() {
  if (!botInstance) {
    throw new Error('Bot instance not available. Initialize cron service first.');
  }
  
  console.log('🔧 Manually triggering season transition...');
  await seasonTransitionService.createNewSeasonAndNotify(botInstance);
}

module.exports = {
  initializeCronService,
  startCronJobs,
  stopCronJobs,
  getCronStatus,
  manualSeasonTransition
}; 