const logger = require('../utils/logger');

class GameScheduler {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.isRunning = false;
        this.initialGameStarted = false;
        
        // Auto-start first game when server starts
        this.autoStartFirstGame = true;
        this.autoStartDelay = 10000; // 10 seconds after server start
    }
    
    initialize() {
        if (this.isRunning) {
            logger.warn('GameScheduler already initialized');
            return;
        }
        
        this.isRunning = true;
        logger.info('GameScheduler initialized with event-based timing');
        
        // Auto-start first game if enabled
        if (this.autoStartFirstGame && !this.initialGameStarted) {
            setTimeout(() => {
                this.startInitialGame();
            }, this.autoStartDelay);
        }
    }
    
    async startInitialGame() {
        if (this.initialGameStarted) {
            return;
        }
        
        logger.info('🚀 Starting initial game...');
        this.initialGameStarted = true;
        
        try {
            // Start with card selection period
            await this.gameEngine.startCardSelectionPeriod();
        } catch (error) {
            logger.error('Failed to start initial game:', error);
        }
    }
    
    async forceStartNewGame() {
        if (!this.isRunning) {
            throw new Error('GameScheduler not running');
        }
        
        logger.info('🔧 Force starting new game...');
        
        try {
            await this.gameEngine.startNewGame();
        } catch (error) {
            logger.error('Failed to force start game:', error);
        }
    }
    
    async forceEndCurrentGame() {
        logger.info('🛑 Force ending current game...');
        
        try {
            await this.gameEngine.endGameNoWinner();
        } catch (error) {
            logger.error('Failed to force end game:', error);
        }
    }
    
    async restartGameCycle() {
        logger.info('🔄 Restarting game cycle...');
        
        try {
            // End current game if any
            if (this.gameEngine.activeGame) {
                await this.gameEngine.endGameNoWinner();
            }
            
            // Start new cycle
            await this.gameEngine.startCardSelectionPeriod();
        } catch (error) {
            logger.error('Failed to restart game cycle:', error);
        }
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            initialGameStarted: this.initialGameStarted,
            gameEngineStatus: this.gameEngine.getStatus()
        };
    }
    
    shutdown() {
        this.isRunning = false;
        logger.info('GameScheduler shutdown');
    }
}

module.exports = GameScheduler;
