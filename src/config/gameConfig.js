module.exports = {
  // Game settings
  game: {
    minPlayers: 2,
    maxPlayers: 50,
    betAmount: 10,
    roundDuration: 30, // seconds
    countdownDuration: 10, // seconds before game starts
    prizePoolPercentage: 85, // 85% of total bets go to prize pool
    houseFeePercentage: 15, // 15% house fee
    
    // Bingo card configuration
    card: {
      size: 5, // 5x5 grid
      minNumber: 1,
      maxNumber: 75,
      numbersPerColumn: 15,
      columns: ['B', 'I', 'N', 'G', 'O']
    },
    
    // Winning patterns
    patterns: [
      'line',        // Any horizontal line
      'vertical',    // Any vertical line
      'diagonal',    // Any diagonal
      'fourcorners', // Four corners
      'fullhouse'    // All numbers marked
    ]
  },
  
  // Withdrawal settings
  withdrawal: {
    minAmount: 50,
    maxAmount: 10000,
    processingFee: 0, // percentage
    dailyLimit: 50000
  },
  
  // Deposit settings
  deposit: {
    minAmount: 10,
    maxAmount: 50000,
    autoVerify: true
  }
};
