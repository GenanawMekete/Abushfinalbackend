const config = require('../config/gameConfig');

class CardGenerator {
  generateCard() {
    const card = [];
    const { size, minNumber, maxNumber, numbersPerColumn, columns } = config.game.card;
    
    for (let col = 0; col < size; col++) {
      const columnNumbers = [];
      const start = minNumber + (col * numbersPerColumn);
      const end = start + numbersPerColumn - 1;
      
      // Generate unique numbers for this column
      while (columnNumbers.length < size) {
        const num = Math.floor(Math.random() * (end - start + 1)) + start;
        if (!columnNumbers.includes(num)) {
          columnNumbers.push(num);
        }
      }
      
      // Sort numbers
      columnNumbers.sort((a, b) => a - b);
      card.push(columnNumbers);
    }
    
    // Free space in the middle (for 5x5 grid)
    if (size === 5) {
      card[Math.floor(size/2)][Math.floor(size/2)] = 'FREE';
    }
    
    return card;
  }
  
  // Deterministic card generation based on seed
  generateCardFromSeed(seed, gameId, userId) {
    // Use combination of seed, gameId and userId for deterministic generation
    const combined = `${seed}-${gameId}-${userId}`;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use hash as seed for Math.random
    const rng = this.seededRandom(hash);
    const card = this.generateCardWithRNG(rng);
    
    return card;
  }
  
  seededRandom(seed) {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
  
  generateCardWithRNG(rng) {
    const card = [];
    const { size, minNumber, maxNumber, numbersPerColumn, columns } = config.game.card;
    
    for (let col = 0; col < size; col++) {
      const columnNumbers = [];
      const start = minNumber + (col * numbersPerColumn);
      const end = start + numbersPerColumn - 1;
      
      while (columnNumbers.length < size) {
        const num = Math.floor(rng() * (end - start + 1)) + start;
        if (!columnNumbers.includes(num)) {
          columnNumbers.push(num);
        }
      }
      
      columnNumbers.sort((a, b) => a - b);
      card.push(columnNumbers);
    }
    
    if (size === 5) {
      card[Math.floor(size/2)][Math.floor(size/2)] = 'FREE';
    }
    
    return card;
  }
  
  validateCard(card) {
    if (!Array.isArray(card) || card.length !== config.game.card.size) {
      return false;
    }
    
    for (let i = 0; i < card.length; i++) {
      if (!Array.isArray(card[i]) || card[i].length !== config.game.card.size) {
        return false;
      }
      
      // Check numbers are in correct range for column
      const start = config.game.card.minNumber + (i * config.game.card.numbersPerColumn);
      const end = start + config.game.card.numbersPerColumn - 1;
      
      for (let j = 0; j < card[i].length; j++) {
        if (i === Math.floor(config.game.card.size/2) && j === Math.floor(config.game.card.size/2)) {
          if (card[i][j] !== 'FREE') return false;
        } else {
          const num = card[i][j];
          if (typeof num !== 'number' || num < start || num > end) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}

module.exports = new CardGenerator();
