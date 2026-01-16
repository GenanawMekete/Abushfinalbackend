const config = require('../config/gameConfig');

class WinChecker {
  checkBingo(card, markedNumbers) {
    const size = card.length;
    
    // Check all winning patterns
    for (const pattern of config.game.patterns) {
      if (this.checkPattern(pattern, card, markedNumbers)) {
        return true;
      }
    }
    
    return false;
  }
  
  checkPattern(pattern, card, markedNumbers) {
    switch (pattern) {
      case 'line':
        return this.checkLines(card, markedNumbers);
      case 'vertical':
        return this.checkColumns(card, markedNumbers);
      case 'diagonal':
        return this.checkDiagonals(card, markedNumbers);
      case 'fourcorners':
        return this.checkFourCorners(card, markedNumbers);
      case 'fullhouse':
        return this.checkFullHouse(card, markedNumbers);
      default:
        return false;
    }
  }
  
  checkLines(card, markedNumbers) {
    const size = card.length;
    
    for (let row = 0; row < size; row++) {
      let complete = true;
      
      for (let col = 0; col < size; col++) {
        const num = card[col][row];
        if (num !== 'FREE' && !markedNumbers.includes(num)) {
          complete = false;
          break;
        }
      }
      
      if (complete) return true;
    }
    
    return false;
  }
  
  checkColumns(card, markedNumbers) {
    const size = card.length;
    
    for (let col = 0; col < size; col++) {
      let complete = true;
      
      for (let row = 0; row < size; row++) {
        const num = card[col][row];
        if (num !== 'FREE' && !markedNumbers.includes(num)) {
          complete = false;
          break;
        }
      }
      
      if (complete) return true;
    }
    
    return false;
  }
  
  checkDiagonals(card, markedNumbers) {
    const size = card.length;
    let mainComplete = true;
    let antiComplete = true;
    
    // Main diagonal
    for (let i = 0; i < size; i++) {
      const num = card[i][i];
      if (num !== 'FREE' && !markedNumbers.includes(num)) {
        mainComplete = false;
        break;
      }
    }
    
    // Anti-diagonal
    for (let i = 0; i < size; i++) {
      const num = card[size - 1 - i][i];
      if (num !== 'FREE' && !markedNumbers.includes(num)) {
        antiComplete = false;
        break;
      }
    }
    
    return mainComplete || antiComplete;
  }
  
  checkFourCorners(card, markedNumbers) {
    const size = card.length;
    const corners = [
      card[0][0],                    // Top-left
      card[0][size - 1],             // Top-right
      card[size - 1][0],             // Bottom-left
      card[size - 1][size - 1]       // Bottom-right
    ];
    
    for (const corner of corners) {
      if (corner !== 'FREE' && !markedNumbers.includes(corner)) {
        return false;
      }
    }
    
    return true;
  }
  
  checkFullHouse(card, markedNumbers) {
    const size = card.length;
    const totalCells = size * size;
    let markedCount = 0;
    
    for (let col = 0; col < size; col++) {
      for (let row = 0; row < size; row++) {
        const num = card[col][row];
        if (num === 'FREE' || markedNumbers.includes(num)) {
          markedCount++;
        }
      }
    }
    
    return markedCount === totalCells;
  }
  
  // Get all winning patterns for a card
  getWinningPatterns(card, markedNumbers) {
    const winningPatterns = [];
    
    for (const pattern of config.game.patterns) {
      if (this.checkPattern(pattern, card, markedNumbers)) {
        winningPatterns.push(pattern);
      }
    }
    
    return winningPatterns;
  }
}

module.exports = new WinChecker();
