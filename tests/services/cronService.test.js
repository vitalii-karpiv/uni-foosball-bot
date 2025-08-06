// Mock dependencies
jest.mock('../../src/services/seasonTransitionService');
jest.mock('node-cron');

describe('Cron Service', () => {
  const mockBot = { sendMessage: jest.fn() };
  const mockCronJob = {
    start: jest.fn(),
    stop: jest.fn(),
    running: false,
    nextDate: jest.fn().mockReturnValue(new Date('2024-02-01T00:01:00Z'))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the module state
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeCronService', () => {
    it('should initialize cron service with bot instance', () => {
      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockCronJob);
      
      const cronService = require('../../src/services/cronService');
      cronService.initializeCronService(mockBot);
      
      expect(cron.schedule).toHaveBeenCalledWith(
        '1 0 1 * *',
        expect.any(Function),
        {
          scheduled: false,
          timezone: "UTC"
        }
      );
    });
  });

  describe('startCronJobs', () => {
    it('should start cron jobs when initialized', () => {
      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockCronJob);
      
      const cronService = require('../../src/services/cronService');
      cronService.initializeCronService(mockBot);
      cronService.startCronJobs();
      
      expect(mockCronJob.start).toHaveBeenCalled();
    });

    it('should log error when cron jobs not initialized', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const cronService = require('../../src/services/cronService');
      cronService.startCronJobs();
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ Cron jobs not initialized. Call initializeCronService first.');
      consoleSpy.mockRestore();
    });
  });

  describe('stopCronJobs', () => {
    it('should stop cron jobs when initialized', () => {
      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockCronJob);
      
      const cronService = require('../../src/services/cronService');
      cronService.initializeCronService(mockBot);
      cronService.stopCronJobs();
      
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should handle stopping when not initialized', () => {
      // Should not throw error when not initialized
      const cronService = require('../../src/services/cronService');
      expect(() => cronService.stopCronJobs()).not.toThrow();
    });
  });

  describe('getCronStatus', () => {
    it('should return status when initialized', () => {
      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockCronJob);
      
      const cronService = require('../../src/services/cronService');
      cronService.initializeCronService(mockBot);
      const status = cronService.getCronStatus();
      
      expect(status).toEqual({
        seasonTransitionJob: {
          running: false,
          nextRun: new Date('2024-02-01T00:01:00Z')
        }
      });
    });

    it('should return status when not initialized', () => {
      const cronService = require('../../src/services/cronService');
      const status = cronService.getCronStatus();
      
      expect(status).toEqual({
        seasonTransitionJob: {
          running: false,
          nextRun: null
        }
      });
    });
  });

  describe('manualSeasonTransition', () => {
    it('should call season transition service when bot is available', async () => {
      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockCronJob);
      
      const cronService = require('../../src/services/cronService');
      const seasonTransitionService = require('../../src/services/seasonTransitionService');
      cronService.initializeCronService(mockBot);
      await cronService.manualSeasonTransition();
      
      expect(seasonTransitionService.createNewSeasonAndNotify).toHaveBeenCalledWith(mockBot);
    });

    it('should throw error when bot is not available', async () => {
      const cronService = require('../../src/services/cronService');
      await expect(cronService.manualSeasonTransition()).rejects.toThrow(
        'Bot instance not available. Initialize cron service first.'
      );
    });
  });

  describe('cron job execution', () => {
    it('should execute season transition when cron job runs', async () => {
      const cron = require('node-cron');
      let cronCallback;
      
      cron.schedule.mockImplementation((schedule, callback) => {
        cronCallback = callback;
        return mockCronJob;
      });
      
      const cronService = require('../../src/services/cronService');
      const seasonTransitionService = require('../../src/services/seasonTransitionService');
      cronService.initializeCronService(mockBot);
      
      // Simulate cron job execution
      await cronCallback();
      
      expect(seasonTransitionService.createNewSeasonAndNotify).toHaveBeenCalledWith(mockBot);
    });

    it('should handle errors in cron job execution', async () => {
      const cron = require('node-cron');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const seasonTransitionService = require('../../src/services/seasonTransitionService');
      seasonTransitionService.createNewSeasonAndNotify.mockRejectedValue(new Error('Test error'));
      
      let cronCallback;
      cron.schedule.mockImplementation((schedule, callback) => {
        cronCallback = callback;
        return mockCronJob;
      });
      
      const cronService = require('../../src/services/cronService');
      cronService.initializeCronService(mockBot);
      
      // Simulate cron job execution
      await cronCallback();
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ Error in season transition cron job:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
}); 