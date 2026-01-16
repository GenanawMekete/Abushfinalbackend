class GameState {
  constructor() {
    this.activeGame = null;
    this.waitingPlayers = [];
    this.drawnNumbers = new Set();
    this.gameInterval = null;
    this.countdownInterval = null;
    this.io = null;
  }
  
  setSocketIO(io) {
    this.io = io;
  }
  
  createNewGame() {
    const gameId = `BINGO${Date.now()}${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
    
    this.activeGame = {
      gameId,
      status: 'waiting',
      players: [],
      drawnNumbers: [],
      totalPrizePool: 0,
      winnerCount: 0,
      startTime: null,
      endTime: null,
      scheduledStart: new Date(Date.now() + config.game.countdownDuration * 1000),
      roundDuration: config.game.roundDuration,
      betAmount: config.game.betAmount
    };
    
    return this.activeGame;
  }
  
  addPlayer(player) {
    if (!this.activeGame) {
      this.createNewGame();
    }
    
    // Check if player already joined
    const existingPlayer = this.activeGame.players.find(p => p.user.toString() === player.user.toString());
    if (existingPlayer) {
      return { success: false, message: 'Already joined this game' };
    }
    
    // Check max players
    if (this.activeGame.players.length >= config.game.maxPlayers) {
      return { success: false, message: 'Game is full' };
    }
    
    // Generate card for player
    const card = cardGenerator.generateCard();
    player.card = card;
    player.markedNumbers = [];
    player.hasBingo = false;
    player.joinedAt = new Date();
    
    this.activeGame.players.push(player);
    this.activeGame.totalPrizePool += this.activeGame.betAmount * (config.game.prizePoolPercentage / 100);
    
    // Broadcast player joined
    if (this.io) {
      this.io.emit('playerJoined', {
        gameId: this.activeGame.gameId,
        playerCount: this.activeGame.players.length,
        totalPrizePool: this.activeGame.totalPrizePool
      });
    }
    
    return { success: true, game: this.activeGame };
  }
  
  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    
    let countdown = config.game.countdownDuration;
    
    this.countdownInterval = setInterval(() => {
      if (this.io) {
        this.io.emit('countdown', { seconds: countdown });
      }
      
      if (countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.startGame();
      }
      
      countdown--;
    }, 1000);
  }
  
  startGame() {
    if (!this.activeGame || this.activeGame.players.length < config.game.minPlayers) {
      // Not enough players, cancel game
      this.cancelGame();
      return;
    }
    
    this.activeGame.status = 'active';
    this.activeGame.startTime = new Date();
    this.activeGame.endTime = new Date(Date.now() + this.activeGame.roundDuration * 1000);
    
    // Start number drawing
    this.startDrawing();
    
    if (this.io) {
      this.io.emit('gameStarted', {
        gameId: this.activeGame.gameId,
        startTime: this.activeGame.startTime,
        endTime: this.activeGame.endTime,
        playerCount: this.activeGame.players.length,
        totalPrizePool: this.activeGame.totalPrizePool
      });
    }
  }
  
  startDrawing() {
    let drawCount = 0;
    const maxDraws = config.game.card.maxNumber;
    const drawInterval = this.activeGame.roundDuration * 1000 / 20; // Draw 20 numbers per game
    
    this.gameInterval = setInterval(() => {
      if (drawCount >= 20 || this.activeGame.winnerCount > 0) {
        clearInterval(this.gameInterval);
        this.endGame();
        return;
      }
      
      const number = drawEngine.drawNumber(this.drawnNumbers);
      if (!number) return;
      
      this.activeGame.drawnNumbers.push(number);
      this.drawnNumbers.add(number);
      
      // Check for wins
      this.checkWins();
      
      if (this.io) {
        this.io.emit('numberDrawn', {
          number,
          drawnNumbers: this.activeGame.drawnNumbers,
          drawCount: drawCount + 1
        });
      }
      
      drawCount++;
    }, drawInterval);
  }
  
  checkWins() {
    const latestNumber = this.activeGame.drawnNumbers[this.activeGame.drawnNumbers.length - 1];
    
    this.activeGame.players.forEach(player => {
      if (player.hasBingo) return;
      
      // Mark number on card
      for (let i = 0; i < player.card.length; i++) {
        const colIndex = player.card[i].indexOf(latestNumber);
        if (colIndex !== -1) {
          if (!player.markedNumbers.includes(latestNumber)) {
            player.markedNumbers.push(latestNumber);
          }
          break;
        }
      }
      
      // Check for winning patterns
      if (player.markedNumbers.length >= config.game.card.size) {
        const hasBingo = winChecker.checkBingo(player.card, player.markedNumbers);
        
        if (hasBingo) {
          player.hasBingo = true;
          player.bingoAt = new Date();
          this.activeGame.winnerCount++;
          
          // Calculate prize
          player.prizeAmount = this.calculatePrize();
          
          if (this.io) {
            this.io.emit('bingo', {
              gameId: this.activeGame.gameId,
              player: {
                username: player.username,
                prizeAmount: player.prizeAmount
              },
              winnerCount: this.activeGame.winnerCount
            });
          }
        }
      }
    });
  }
  
  calculatePrize() {
    if (this.activeGame.winnerCount === 0) return 0;
    
    const totalPrize = this.activeGame.totalPrizePool;
    
    // Split equally among winners
    return totalPrize / this.activeGame.winnerCount;
  }
  
  async endGame() {
    this.activeGame.status = 'completed';
    this.activeGame.endTime = new Date();
    
    // Save game to database
    await gameService.saveGame(this.activeGame);
    
    // Distribute prizes
    await this.distributePrizes();
    
    // Reset state
    const completedGame = { ...this.activeGame };
    this.activeGame = null;
    this.drawnNumbers.clear();
    
    if (this.io) {
      this.io.emit('gameEnded', {
        gameId: completedGame.gameId,
        winners: completedGame.players.filter(p => p.hasBingo).map(p => ({
          username: p.username,
          prizeAmount: p.prizeAmount
        })),
        totalPrizePool: completedGame.totalPrizePool
      });
    }
  }
  
  async distributePrizes() {
    for (const player of this.activeGame.players) {
      if (player.hasBingo && player.prizeAmount > 0) {
        await walletService.updateBalance(player.user, player.prizeAmount);
      }
    }
  }
  
  cancelGame() {
    if (this.activeGame) {
      this.activeGame.status = 'cancelled';
      
      // Refund bets
      this.activeGame.players.forEach(async (player) => {
        await walletService.updateBalance(player.user, this.activeGame.betAmount);
      });
      
      if (this.io) {
        this.io.emit('gameCancelled', {
          gameId: this.activeGame.gameId,
          reason: 'Not enough players'
        });
      }
      
      this.activeGame = null;
      this.drawnNumbers.clear();
    }
  }
}

module.exports = new GameState();
