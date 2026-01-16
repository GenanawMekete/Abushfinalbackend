const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

class GameEngine extends EventEmitter {
    constructor(io, redis) {
        super();
        this.io = io;
        this.redis = redis;
        
        // Active game state
        this.activeGame = null;
        this.gamePhase = 'idle'; // idle, card_selection, countdown, active, announcing
        this.waitingPlayers = new Map();
        this.userConnections = new Map();
        
        // Timing intervals
        this.numberCallInterval = null;
        this.winnerAnnouncementTimeout = null;
        this.cardSelectionTimeout = null;
        this.gameStartCountdown = null;
        
        // Game configuration
        this.config = {
            numberCallInterval: 5000,      // 5 seconds between numbers
            winnerAnnouncement: 5000,      // 5 seconds to announce winners
            cardSelectionDuration: 30000,   // 30 seconds for card selection
            gameStartCountdown: 5000,      // 5 seconds before game starts
            maxGameDuration: 300000,       // 5 minutes maximum if no winner
            minPlayers: 2,
            maxPlayers: 400,
            betAmount: 10,
            prizePercentage: 85,
            houseFee: 15
        };
        
        this.initialize();
    }
    
    async initialize() {
        logger.info('Game Engine initialized with dynamic timing');
        logger.info(`Number call interval: ${this.config.numberCallInterval/1000}s`);
        logger.info(`Card selection duration: ${this.config.cardSelectionDuration/1000}s`);
        logger.info(`Winner announcement: ${this.config.winnerAnnouncement/1000}s`);
        
        // Load any active game from database
        await this.loadActiveGame();
    }
    
    async loadActiveGame() {
        // Load active game from database if exists
        // This would be implemented with your database model
    }
    
    // ========== MAIN GAME FLOW METHODS ==========
    
    async startNewGame() {
        if (this.gamePhase !== 'idle' && this.gamePhase !== 'card_selection') {
            logger.warn(`Cannot start new game. Current phase: ${this.gamePhase}`);
            return;
        }
        
        logger.info('🎮 Starting new game...');
        
        // Create new game instance
        this.activeGame = this.createGameInstance();
        this.gamePhase = 'countdown';
        
        // Notify all players
        this.io.emit('gamePhaseChanged', {
            phase: 'countdown',
            message: 'New game starting soon!'
        });
        
        // Start 5-second countdown
        await this.startGameCountdown();
        
        // After countdown, start the game
        setTimeout(() => {
            this.startGamePlay();
        }, this.config.gameStartCountdown);
    }
    
    async startGameCountdown() {
        let countdown = this.config.gameStartCountdown / 1000;
        
        logger.info(`⏱️ Starting ${countdown}s countdown to game start`);
        
        // Emit countdown every second
        const countdownInterval = setInterval(() => {
            this.io.emit('gameCountdown', {
                seconds: countdown,
                phase: 'starting',
                message: `Game starts in ${countdown} seconds...`
            });
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
            }
            countdown--;
        }, 1000);
        
        this.gameStartCountdown = countdownInterval;
    }
    
    async startGamePlay() {
        this.gamePhase = 'active';
        this.activeGame.startTime = new Date();
        this.activeGame.status = 'active';
        
        logger.info(`🎯 Game ${this.activeGame.gameId} started with ${this.activeGame.players.length} players`);
        
        // Broadcast game start
        this.io.emit('gameStarted', {
            gameId: this.activeGame.gameId,
            startTime: this.activeGame.startTime,
            playerCount: this.activeGame.players.length,
            prizePool: this.activeGame.prizePool,
            betAmount: this.config.betAmount
        });
        
        // Start number calling with 5-second intervals
        this.startNumberCalling();
        
        // Set maximum game duration (5 minutes)
        setTimeout(() => {
            if (this.gamePhase === 'active') {
                this.endGameNoWinner();
            }
        }, this.config.maxGameDuration);
    }
    
    async startNumberCalling() {
        let callNumber = 1;
        
        const callNextNumber = async () => {
            // Check if game ended
            if (this.gamePhase !== 'active') {
                clearInterval(this.numberCallInterval);
                return;
            }
            
            // Draw number
            const number = this.drawNumber();
            if (!number) {
                this.endGameNoWinner();
                return;
            }
            
            // Add to drawn numbers
            this.activeGame.drawnNumbers.push(number);
            
            // Get letter for number
            const letter = this.getLetterForNumber(number);
            
            // Broadcast number call
            this.io.emit('numberCalled', {
                number,
                letter,
                callNumber: callNumber,
                totalCalled: this.activeGame.drawnNumbers.length,
                timestamp: new Date()
            });
            
            logger.info(`🔢 Number called: ${letter}-${number} (Call #${callNumber})`);
            
            // Check for winners after each number
            const winners = await this.checkForWinners();
            
            if (winners.length > 0) {
                // Game ends immediately when someone wins
                await this.endGameWithWinners(winners);
                return;
            }
            
            callNumber++;
            
            // Schedule next number call after 5 seconds
            this.numberCallInterval = setTimeout(callNextNumber, this.config.numberCallInterval);
        };
        
        // Start first number call immediately
        callNextNumber();
    }
    
    async endGameWithWinners(winners) {
        // Clear timers
        this.clearAllTimers();
        
        logger.info(`🎉 Game ended with ${winners.length} winner(s)!`);
        
        // Update game state
        this.gamePhase = 'announcing';
        this.activeGame.endTime = new Date();
        this.activeGame.winners = winners;
        this.activeGame.winnerCount = winners.length;
        this.activeGame.status = 'completed';
        
        // Calculate prizes
        this.calculatePrizes(winners);
        
        // Broadcast game end
        this.io.emit('gameEnded', {
            gameId: this.activeGame.gameId,
            winners: winners,
            endTime: this.activeGame.endTime,
            totalPrizePool: this.activeGame.prizePool,
            drawnNumbers: this.activeGame.drawnNumbers,
            message: `${winners.length} player(s) won!`
        });
        
        // Start winner announcement phase (5 seconds)
        await this.announceWinners(winners);
        
        // After announcement, start card selection period
        setTimeout(() => {
            this.startCardSelectionPeriod();
        }, this.config.winnerAnnouncement);
    }
    
    async endGameNoWinner() {
        // Clear timers
        this.clearAllTimers();
        
        logger.info('🏁 Game ended with no winner');
        
        // Update game state
        this.gamePhase = 'announcing';
        this.activeGame.endTime = new Date();
        this.activeGame.status = 'completed';
        
        // Broadcast game end with no winner
        this.io.emit('gameEnded', {
            gameId: this.activeGame.gameId,
            winners: [],
            endTime: this.activeGame.endTime,
            totalPrizePool: this.activeGame.prizePool,
            drawnNumbers: this.activeGame.drawnNumbers,
            message: 'No winner this round!'
        });
        
        // Start card selection immediately (no winner to announce)
        setTimeout(() => {
            this.startCardSelectionPeriod();
        }, 2000); // 2 second delay
    }
    
    async announceWinners(winners) {
        logger.info(`📣 Announcing ${winners.length} winner(s) for 5 seconds`);
        
        // Format winner information
        const announcement = winners.map(winner => ({
            username: winner.username || `Player ${winner.userId.slice(-4)}`,
            cardNumber: winner.cardNumber,
            prizeAmount: winner.prizeAmount,
            winningPattern: winner.winningPattern,
            winningNumbers: winner.winningNumbers,
            userId: winner.userId
        }));
        
        // Broadcast winner announcement
        this.io.emit('winnerAnnouncement', {
            winners: announcement,
            duration: this.config.winnerAnnouncement / 1000,
            gameId: this.activeGame.gameId
        });
        
        // Update winners in database
        await this.saveWinnersToDatabase(announcement);
        
        // Return promise that resolves after announcement duration
        return new Promise(resolve => {
            setTimeout(resolve, this.config.winnerAnnouncement);
        });
    }
    
    async startCardSelectionPeriod() {
        this.gamePhase = 'card_selection';
        
        logger.info('📋 Starting 30-second card selection period');
        
        // Create new game instance for next round
        const nextGame = this.createGameInstance();
        
        // Broadcast card selection period start
        this.io.emit('cardSelectionStarted', {
            duration: this.config.cardSelectionDuration / 1000,
            nextGameId: nextGame.gameId,
            endsAt: new Date(Date.now() + this.config.cardSelectionDuration),
            message: 'Select your card for the next game!'
        });
        
        // Start countdown timer
        let timeLeft = this.config.cardSelectionDuration / 1000;
        
        const selectionTimer = setInterval(() => {
            timeLeft--;
            
            this.io.emit('cardSelectionUpdate', {
                secondsLeft: timeLeft,
                progress: ((this.config.cardSelectionDuration / 1000) - timeLeft) / (this.config.cardSelectionDuration / 1000) * 100
            });
            
            if (timeLeft <= 0) {
                clearInterval(selectionTimer);
                
                logger.info('⏰ Card selection period ended');
                
                // Start next game after card selection ends
                setTimeout(() => {
                    this.startNewGame();
                }, 1000);
            }
        }, 1000);
        
        this.cardSelectionTimeout = selectionTimer;
    }
    
    // ========== GAME INSTANCE MANAGEMENT ==========
    
    createGameInstance() {
        const gameId = `BINGO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
        
        const game = {
            gameId,
            status: 'waiting',
            players: [],
            drawnNumbers: [],
            prizePool: 0,
            winners: [],
            winnerCount: 0,
            startTime: null,
            endTime: null,
            createdAt: new Date(),
            settings: {
                betAmount: this.config.betAmount,
                prizePercentage: this.config.prizePercentage,
                maxPlayers: this.config.maxPlayers
            }
        };
        
        logger.info(`🆕 Created new game instance: ${gameId}`);
        return game;
    }
    
    async addPlayerToGame(userId, userData, cardNumber = null) {
        if (!this.activeGame) {
            throw new Error('No active game available');
        }
        
        // Check if player already in game
        const existingPlayer = this.activeGame.players.find(p => p.userId === userId);
        if (existingPlayer) {
            return { success: false, message: 'Already in game' };
        }
        
        // Check max players
        if (this.activeGame.players.length >= this.config.maxPlayers) {
            return { success: false, message: 'Game is full' };
        }
        
        // Generate or validate card
        let card;
        if (cardNumber) {
            // Check if card is already taken
            const cardTaken = this.activeGame.players.some(p => p.cardNumber === cardNumber);
            if (cardTaken) {
                return { success: false, message: 'Card already taken' };
            }
            card = this.generateCardFromNumber(cardNumber);
        } else {
            // Assign random available card
            cardNumber = this.getAvailableCardNumber();
            card = this.generateCardFromNumber(cardNumber);
        }
        
        // Create player object
        const player = {
            userId,
            username: userData.username || userData.firstName || `User${userId.slice(-4)}`,
            firstName: userData.firstName,
            lastName: userData.lastName,
            telegramId: userData.telegramId,
            cardNumber,
            card,
            markedNumbers: [],
            hasBingo: false,
            autoMark: true,
            joinedAt: new Date(),
            betAmount: this.config.betAmount
        };
        
        // Add player to game
        this.activeGame.players.push(player);
        
        // Update prize pool
        this.activeGame.prizePool += this.config.betAmount * (this.config.prizePercentage / 100);
        
        logger.info(`👤 Player ${player.username} joined game ${this.activeGame.gameId} with card #${cardNumber}`);
        
        // Broadcast player joined
        this.io.emit('playerJoined', {
            playerCount: this.activeGame.players.length,
            totalPrizePool: this.activeGame.prizePool,
            username: player.username
        });
        
        return {
            success: true,
            player,
            game: this.activeGame
        };
    }
    
    // ========== GAME LOGIC METHODS ==========
    
    drawNumber() {
        if (!this.activeGame) return null;
        
        const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
        const availableNumbers = allNumbers.filter(n => !this.activeGame.drawnNumbers.includes(n));
        
        if (availableNumbers.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        return availableNumbers[randomIndex];
    }
    
    getLetterForNumber(number) {
        if (number >= 1 && number <= 15) return 'B';
        if (number >= 16 && number <= 30) return 'I';
        if (number >= 31 && number <= 45) return 'N';
        if (number >= 46 && number <= 60) return 'G';
        if (number >= 61 && number <= 75) return 'O';
        return '';
    }
    
    async checkForWinners() {
        if (!this.activeGame || !this.activeGame.players) return [];
        
        const winners = [];
        
        for (const player of this.activeGame.players) {
            if (player.hasBingo || !player.card || player.markedNumbers.length < 5) {
                continue;
            }
            
            const winningPattern = this.checkBingoPattern(player.card, player.markedNumbers);
            
            if (winningPattern) {
                player.hasBingo = true;
                player.winningPattern = winningPattern.pattern;
                player.winningNumbers = winningPattern.numbers;
                player.bingoAt = new Date();
                
                winners.push({
                    userId: player.userId,
                    username: player.username,
                    cardNumber: player.cardNumber,
                    card: player.card,
                    winningPattern: winningPattern.pattern,
                    winningNumbers: winningPattern.numbers,
                    bingoAt: player.bingoAt,
                    prizeAmount: 0 // Will be calculated later
                });
                
                logger.info(`🏆 Player ${player.username} got BINGO with pattern: ${winningPattern.pattern}`);
            }
        }
        
        return winners;
    }
    
    checkBingoPattern(card, markedNumbers) {
        const patterns = [
            this.checkHorizontalLines(card, markedNumbers),
            this.checkVerticalLines(card, markedNumbers),
            this.checkDiagonals(card, markedNumbers),
            this.checkFourCorners(card, markedNumbers),
            this.checkFullHouse(card, markedNumbers)
        ];
        
        return patterns.find(pattern => pattern !== null);
    }
    
    calculatePrizes(winners) {
        if (winners.length === 0 || this.activeGame.prizePool <= 0) return;
        
        const totalPrize = this.activeGame.prizePool;
        const prizePerWinner = totalPrize / winners.length;
        
        winners.forEach(winner => {
            winner.prizeAmount = Math.floor(prizePerWinner * 100) / 100; // Round to 2 decimals
        });
        
        logger.info(`💰 Prize distribution: ${winners.length} winners each get ${prizePerWinner.toFixed(2)} ETB`);
    }
    
    // ========== CARD GENERATION ==========
    
    generateCardFromNumber(cardNumber) {
        const card = [];
        const letters = ['B', 'I', 'N', 'G', 'O'];
        const ranges = {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        };
        
        // Use card number as seed for deterministic generation
        let seed = cardNumber;
        
        for (let col = 0; col < 5; col++) {
            const column = [];
            const letter = letters[col];
            const range = ranges[letter];
            
            while (column.length < 5) {
                // Deterministic random based on seed
                seed = (seed * 9301 + 49297) % 233280;
                const randomValue = seed / 233280;
                
                const number = Math.floor(randomValue * (range.max - range.min + 1)) + range.min;
                
                if (!column.includes(number)) {
                    column.push(number);
                }
            }
            
            column.sort((a, b) => a - b);
            card.push(column);
        }
        
        // Set free space in middle
        if (card[2] && card[2][2]) {
            card[2][2] = 'FREE';
        }
        
        return card;
    }
    
    getAvailableCardNumber() {
        // Find first available card number (1-400)
        const takenCards = this.activeGame.players.map(p => p.cardNumber);
        
        for (let i = 1; i <= 400; i++) {
            if (!takenCards.includes(i)) {
                return i;
            }
        }
        
        // If all cards taken, return random
        return Math.floor(Math.random() * 400) + 1;
    }
    
    // ========== BINGO PATTERN CHECKING ==========
    
    checkHorizontalLines(card, markedNumbers) {
        for (let row = 0; row < 5; row++) {
            const rowNumbers = [];
            let complete = true;
            
            for (let col = 0; col < 5; col++) {
                const num = card[col][row];
                if (row === 2 && col === 2) continue; // Free space
                
                rowNumbers.push(num);
                if (!markedNumbers.includes(num)) {
                    complete = false;
                }
            }
            
            if (complete) {
                return {
                    pattern: `horizontal-line-${row + 1}`,
                    numbers: rowNumbers
                };
            }
        }
        return null;
    }
    
    checkVerticalLines(card, markedNumbers) {
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        for (let col = 0; col < 5; col++) {
            const colNumbers = [];
            let complete = true;
            
            for (let row = 0; row < 5; row++) {
                const num = card[col][row];
                if (row === 2 && col === 2) continue; // Free space
                
                colNumbers.push(num);
                if (!markedNumbers.includes(num)) {
                    complete = false;
                }
            }
            
            if (complete) {
                return {
                    pattern: `vertical-line-${letters[col]}`,
                    numbers: colNumbers
                };
            }
        }
        return null;
    }
    
    checkDiagonals(card, markedNumbers) {
        // Main diagonal
        const mainDiagonal = [];
        let mainComplete = true;
        
        for (let i = 0; i < 5; i++) {
            const num = card[i][i];
            if (i === 2) continue; // Free space
            
            mainDiagonal.push(num);
            if (!markedNumbers.includes(num)) {
                mainComplete = false;
            }
        }
        
        if (mainComplete) {
            return {
                pattern: 'diagonal-main',
                numbers: mainDiagonal
            };
        }
        
        // Anti-diagonal
        const antiDiagonal = [];
        let antiComplete = true;
        
        for (let i = 0; i < 5; i++) {
            const num = card[4 - i][i];
            if (i === 2) continue; // Free space
            
            antiDiagonal.push(num);
            if (!markedNumbers.includes(num)) {
                antiComplete = false;
            }
        }
        
        if (antiComplete) {
            return {
                pattern: 'diagonal-anti',
                numbers: antiDiagonal
            };
        }
        
        return null;
    }
    
    checkFourCorners(card, markedNumbers) {
        const corners = [
            card[0][0],     // Top-left
            card[4][0],     // Top-right
            card[0][4],     // Bottom-left
            card[4][4]      // Bottom-right
        ];
        
        const allMarked = corners.every(corner => markedNumbers.includes(corner));
        
        if (allMarked) {
            return {
                pattern: 'four-corners',
                numbers: corners
            };
        }
        
        return null;
    }
    
    checkFullHouse(card, markedNumbers) {
        for (let col = 0; col < 5; col++) {
            for (let row = 0; row < 5; row++) {
                const num = card[col][row];
                if (row === 2 && col === 2) continue; // Free space
                
                if (!markedNumbers.includes(num)) {
                    return null;
                }
            }
        }
        
        return {
            pattern: 'full-house',
            numbers: markedNumbers
        };
    }
    
    // ========== PLAYER ACTIONS ==========
    
    async handleMarkNumber(userId, number) {
        const player = this.activeGame?.players.find(p => p.userId === userId);
        
        if (!player || !this.activeGame || this.gamePhase !== 'active') {
            return { success: false, message: 'Cannot mark number at this time' };
        }
        
        // Check if number is valid
        if (number < 1 || number > 75) {
            return { success: false, message: 'Invalid number' };
        }
        
        // Check if number is already marked
        if (player.markedNumbers.includes(number)) {
            return { success: false, message: 'Number already marked' };
        }
        
        // Mark the number
        player.markedNumbers.push(number);
        
        // Check for bingo
        const winningPattern = this.checkBingoPattern(player.card, player.markedNumbers);
        
        if (winningPattern && !player.hasBingo) {
            player.hasBingo = true;
            player.winningPattern = winningPattern.pattern;
            player.winningNumbers = winningPattern.numbers;
            player.bingoAt = new Date();
            
            // Game ends immediately when someone wins
            await this.endGameWithWinners([{
                userId: player.userId,
                username: player.username,
                cardNumber: player.cardNumber,
                winningPattern: winningPattern.pattern,
                winningNumbers: winningPattern.numbers,
                bingoAt: player.bingoAt
            }]);
        }
        
        return {
            success: true,
            markedNumbers: player.markedNumbers,
            hasBingo: player.hasBingo
        };
    }
    
    async handleClaimBingo(userId) {
        const player = this.activeGame?.players.find(p => p.userId === userId);
        
        if (!player || !player.hasBingo) {
            return { success: false, message: 'No bingo to claim' };
        }
        
        logger.info(`🎉 Player ${player.username} claimed BINGO!`);
        
        // Broadcast bingo claim
        this.io.emit('bingoClaimed', {
            userId: player.userId,
            username: player.username,
            cardNumber: player.cardNumber,
            winningPattern: player.winningPattern,
            timestamp: new Date()
        });
        
        return {
            success: true,
            prizeAmount: 0, // Will be calculated when game ends
            winningPattern: player.winningPattern
        };
    }
    
    // ========== HELPER METHODS ==========
    
    clearAllTimers() {
        if (this.numberCallInterval) {
            clearTimeout(this.numberCallInterval);
            this.numberCallInterval = null;
        }
        
        if (this.winnerAnnouncementTimeout) {
            clearTimeout(this.winnerAnnouncementTimeout);
            this.winnerAnnouncementTimeout = null;
        }
        
        if (this.cardSelectionTimeout) {
            clearInterval(this.cardSelectionTimeout);
            this.cardSelectionTimeout = null;
        }
        
        if (this.gameStartCountdown) {
            clearInterval(this.gameStartCountdown);
            this.gameStartCountdown = null;
        }
    }
    
    async saveWinnersToDatabase(winners) {
        // Save winners to database
        // Implementation depends on your database setup
        logger.info(`💾 Saving ${winners.length} winners to database`);
    }
    
    getGameState() {
        return {
            phase: this.gamePhase,
            activeGame: this.activeGame ? {
                gameId: this.activeGame.gameId,
                status: this.activeGame.status,
                playerCount: this.activeGame.players.length,
                prizePool: this.activeGame.prizePool,
                drawnNumbers: this.activeGame.drawnNumbers,
                startTime: this.activeGame.startTime,
                endTime: this.activeGame.endTime
            } : null,
            timing: {
                numberCallInterval: this.config.numberCallInterval / 1000,
                winnerAnnouncement: this.config.winnerAnnouncement / 1000,
                cardSelection: this.config.cardSelectionDuration / 1000,
                gameStartCountdown: this.config.gameStartCountdown / 1000
            }
        };
    }
    
    getStatus() {
        return {
            gamePhase: this.gamePhase,
            activeGame: !!this.activeGame,
            playerCount: this.activeGame?.players.length || 0,
            drawnNumbers: this.activeGame?.drawnNumbers.length || 0,
            prizePool: this.activeGame?.prizePool || 0
        };
    }
}

module.exports = GameEngine;
