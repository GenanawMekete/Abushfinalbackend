const config = require('../config/gameConfig');

class DrawEngine {
  drawNumber(drawnNumbers) {
    const availableNumbers = [];
    
    // Generate all possible numbers
    for (let i = config.game.card.minNumber; i <= config.game.card.maxNumber; i++) {
      if (!drawnNumbers.has(i)) {
        availableNumbers.push(i);
      }
    }
    
    if (availableNumbers.length === 0) {
      return null; // All numbers drawn
    }
    
    // Pick random number
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    return availableNumbers[randomIndex];
  }
  
  drawNumbers(count, exclude = []) {
    const drawn = [];
    const excludedSet = new Set(exclude);
    
    while (drawn.length < count) {
      const num = this.drawNumber(excludedSet);
      if (num === null) break;
      
      drawn.push(num);
      excludedSet.add(num);
    }
    
    return drawn;
  }
  
  // For testing: draw specific patterns
  drawPattern(patternName, card) {
    switch (patternName) {
      case 'line':
        return this.getLinePattern(card, 0); // First row
      case 'vertical':
        return this.getColumnPattern(card, 0); // First column
      case 'diagonal':
        return this.getDiagonalPattern(card, true); // Main diagonal
      case 'fourcorners':
        return [
          card[0][0],
          card[0][card[0].length - 1],
          card[card.length - 1][0],
          card[card.length - 1][card[0].length - 1]
        ].filter(n => n !== 'FREE');
      default:
        return [];
    }
  }
  
  getLinePattern(card, row) {
    const numbers = [];
    for (let col = 0; col < card.length; col++) {
      if (card[col][row] !== 'FREE') {
        numbers.push(card[col][row]);
      }
    }
    return numbers;
  }
  
  getColumnPattern(card, col) {
    const numbers = [];
    for (let row = 0; row < card[col].length; row++) {
      if (card[col][row] !== 'FREE') {
        numbers.push(card[col][row]);
      }
    }
    return numbers;
  }
  
  getDiagonalPattern(card, main = true) {
    const numbers = [];
    const size = card.length;
    
    for (let i = 0; i < size; i++) {
      const col = main ? i : size - 1 - i;
      const row = i;
      
      if (card[col][row] !== 'FREE') {
        numbers.push(card[col][row]);
      }
    }
    
    return numbers;
  }
}

module.exports = new DrawEngine();
