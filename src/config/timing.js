// Game Timing Configuration - DYNAMIC SYSTEM
module.exports = {
    // Number calling interval (5 seconds between numbers)
    numberCallInterval: 5000,      // 5 seconds in milliseconds
    
    // Winner announcement duration (5 seconds)
    winnerAnnouncement: 5000,      // 5 seconds
    
    // Card selection period (30 seconds)
    cardSelection: 30000,          // 30 seconds
    
    // Game start countdown (5 seconds)
    gameStartCountdown: 5000,      // 5 seconds
    
    // Maximum game duration if no winner (5 minutes)
    maxGameDuration: 300000,       // 5 minutes
    
    // Minimum time between games (ensures smooth transitions)
    minGameInterval: 1000,         // 1 second
    
    // Game settings
    game: {
        // Minimum players to start game
        minPlayers: 2,
        
        // Maximum players per game
        maxPlayers: 400,
        
        // Maximum cards available
        maxCards: 400,
        
        // Default bet amount
        betAmount: 10,
        
        // Prize pool percentage (85% to players)
        prizePercentage: 85,
        
        // House fee percentage (15%)
        houseFee: 15,
        
        // Numbers in bingo (1-75)
        totalNumbers: 75,
        
        // Numbers to draw before auto-ending (if no winner)
        maxNumbersToDraw: 50,
        
        // Card configuration (5x5 grid)
        cardSize: 5,
        columns: ['B', 'I', 'N', 'G', 'O'],
        columnRanges: {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        }
    },
    
    // Redis cache TTLs (in seconds)
    redis: {
        gameState: 3600,           // 1 hour
        playerSession: 1800,       // 30 minutes
        cardAvailability: 300,     // 5 minutes
        leaderboard: 3600          // 1 hour
    },
    
    // Socket.IO configuration
    socket: {
        pingInterval: 25000,       // 25 seconds
        pingTimeout: 20000,        // 20 seconds
        upgradeTimeout: 10000,     // 10 seconds
        maxHttpBufferSize: 1e6,    // 1 MB
        connectTimeout: 45000      // 45 seconds
    },
    
    // Game phases mapping
    phases: {
        IDLE: 'idle',
        WAITING: 'waiting',
        CARD_SELECTION: 'card_selection',
        COUNTDOWN: 'countdown',
        ACTIVE: 'active',
        ANNOUNCING_WINNERS: 'announcing_winners',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },
    
    // Winning patterns
    patterns: {
        HORIZONTAL: 'horizontal',
        VERTICAL: 'vertical',
        DIAGONAL: 'diagonal',
        FOUR_CORNERS: 'four_corners',
        FULL_HOUSE: 'full_house'
    },
    
    // Timing validation
    validate: function() {
        const errors = [];
        
        if (this.numberCallInterval < 1000 || this.numberCallInterval > 30000) {
            errors.push('Number call interval must be between 1 and 30 seconds');
        }
        
        if (this.winnerAnnouncement < 1000 || this.winnerAnnouncement > 30000) {
            errors.push('Winner announcement must be between 1 and 30 seconds');
        }
        
        if (this.cardSelection < 5000 || this.cardSelection > 120000) {
            errors.push('Card selection must be between 5 and 120 seconds');
        }
        
        if (this.gameStartCountdown < 1000 || this.gameStartCountdown > 30000) {
            errors.push('Game start countdown must be between 1 and 30 seconds');
        }
        
        if (this.maxGameDuration < 30000 || this.maxGameDuration > 600000) {
            errors.push('Max game duration must be between 30 seconds and 10 minutes');
        }
        
        if (this.game.minPlayers < 1 || this.game.minPlayers > this.game.maxPlayers) {
            errors.push('Minimum players must be between 1 and max players');
        }
        
        if (this.game.maxPlayers < 2 || this.game.maxPlayers > 1000) {
            errors.push('Maximum players must be between 2 and 1000');
        }
        
        if (errors.length > 0) {
            throw new Error(`Timing configuration errors:\n${errors.join('\n')}`);
        }
        
        return true;
    },
    
    // Calculate total cycle time
    getTotalCycleTime: function() {
        return this.winnerAnnouncement + this.cardSelection + this.gameStartCountdown;
    },
    
    // Get estimated games per hour
    getGamesPerHour: function(averageGameDuration = 120000) {
        const totalCycle = this.getTotalCycleTime();
        return Math.floor(3600000 / (averageGameDuration + totalCycle));
    },
    
    // Format timing for display
    formatForDisplay: function() {
        return {
            numberCallInterval: `${this.numberCallInterval / 1000} seconds`,
            winnerAnnouncement: `${this.winnerAnnouncement / 1000} seconds`,
            cardSelection: `${this.cardSelection / 1000} seconds`,
            gameStartCountdown: `${this.gameStartCountdown / 1000} seconds`,
            maxGameDuration: `${this.maxGameDuration / 1000} seconds`,
            totalCycleTime: `${this.getTotalCycleTime() / 1000} seconds`,
            estimatedGamesPerHour: this.getGamesPerHour(),
            minPlayers: this.game.minPlayers,
            maxPlayers: this.game.maxPlayers,
            betAmount: `${this.game.betAmount} ETB`,
            prizePercentage: `${this.game.prizePercentage}%`,
            houseFee: `${this.game.houseFee}%`
        };
    }
};

// Validate configuration on load
try {
    module.exports.validate();
    console.log('✅ Timing configuration validated successfully');
} catch (error) {
    console.error('❌ Timing configuration error:', error.message);
    process.exit(1);
}
