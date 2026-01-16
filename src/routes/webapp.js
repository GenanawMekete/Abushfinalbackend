const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const gameState = require('../engine/gameState');

// Get available cards for current game
router.get('/cards/available', async (req, res) => {
    try {
        const game = gameState.activeGame;
        if (!game) {
            return res.json({ availableCards: Array.from({ length: 400 }, (_, i) => i + 1) });
        }
        
        // Get taken card numbers
        const takenCards = game.players.map(p => p.cardNumber).filter(Boolean);
        
        // Generate available cards (1-400 excluding taken ones)
        const availableCards = [];
        for (let i = 1; i <= 400; i++) {
            if (!takenCards.includes(i)) {
                availableCards.push(i);
            }
        }
        
        res.json({ availableCards });
    } catch (error) {
        console.error('Get available cards error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Select a card
router.post('/cards/select', async (req, res) => {
    try {
        const { userId, cardNumber, bet } = req.body;
        
        // Find user
        const user = await User.findOne({ telegramId: userId.toString() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if card is available
        const game = gameState.activeGame;
        if (game) {
            const taken = game.players.find(p => p.cardNumber === cardNumber);
            if (taken) {
                return res.status(400).json({ error: 'Card already taken' });
            }
        }
        
        // Generate card based on card number
        const card = generateDeterministicCard(cardNumber);
        
        // Join game with this card
        const result = gameState.addPlayer({
            user: user._id,
            username: user.username || user.firstName,
            userId: user.telegramId,
            cardNumber: cardNumber,
            card: card,
            bet: bet
        });
        
        if (result.success) {
            res.json({
                success: true,
                cardNumber,
                card,
                message: 'Card selected successfully'
            });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Select card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get game state for web app
router.get('/game/state', async (req, res) => {
    try {
        const game = gameState.activeGame;
        
        if (!game) {
            return res.json({
                status: 'waiting',
                players: 0,
                derash: 0,
                bet: config.BET_AMOUNT,
                calledNumbers: [],
                currentCall: null
            });
        }
        
        res.json({
            gameId: game.gameId,
            status: game.status,
            players: game.players.length,
            derash: game.totalPrizePool,
            bet: game.betAmount,
            calledNumbers: game.drawnNumbers,
            currentCall: game.drawnNumbers.length > 0 ? {
                letter: getLetterForNumber(game.drawnNumbers[game.drawnNumbers.length - 1]),
                number: game.drawnNumbers[game.drawnNumbers.length - 1]
            } : null,
            nextDraw: game.nextDrawTime || null
        });
    } catch (error) {
        console.error('Get game state error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Claim bingo
router.post('/game/claim-bingo', async (req, res) => {
    try {
        const { userId, gameId, cardNumber } = req.body;
        
        const user = await User.findOne({ telegramId: userId.toString() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const game = gameState.activeGame;
        if (!game || game.gameId !== gameId) {
            return res.status(400).json({ error: 'Game not found' });
        }
        
        const player = game.players.find(p => p.user.toString() === user._id.toString());
        if (!player) {
            return res.status(400).json({ error: 'Player not in game' });
        }
        
        // Check if player has bingo
        if (!player.hasBingo) {
            return res.status(400).json({ error: 'No winning pattern found' });
        }
        
        // Mark as claimed
        player.bingoClaimed = true;
        player.prizeAmount = game.totalPrizePool / game.winnerCount;
        
        res.json({
            success: true,
            prizeAmount: player.prizeAmount,
            message: 'Bingo claimed successfully!'
        });
    } catch (error) {
        console.error('Claim bingo error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's current card
router.get('/user/card', async (req, res) => {
    try {
        const { userId } = req.query;
        
        const user = await User.findOne({ telegramId: userId.toString() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const game = gameState.activeGame;
        if (!game) {
            return res.json({ hasCard: false });
        }
        
        const player = game.players.find(p => p.user.toString() === user._id.toString());
        if (!player) {
            return res.json({ hasCard: false });
        }
        
        res.json({
            hasCard: true,
            cardNumber: player.cardNumber,
            card: player.card,
            markedNumbers: player.markedNumbers || [],
            hasBingo: player.hasBingo || false
        });
    } catch (error) {
        console.error('Get user card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark number on card
router.post('/card/mark', async (req, res) => {
    try {
        const { userId, number } = req.body;
        
        const user = await User.findOne({ telegramId: userId.toString() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const game = gameState.activeGame;
        if (!game) {
            return res.status(400).json({ error: 'No active game' });
        }
        
        const player = game.players.find(p => p.user.toString() === user._id.toString());
        if (!player) {
            return res.status(400).json({ error: 'Player not in game' });
        }
        
        // Add number to marked numbers
        if (!player.markedNumbers) {
            player.markedNumbers = [];
        }
        
        if (!player.markedNumbers.includes(number)) {
            player.markedNumbers.push(number);
        }
        
        res.json({
            success: true,
            markedNumbers: player.markedNumbers
        });
    } catch (error) {
        console.error('Mark number error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user balance
router.get('/user/balance', async (req, res) => {
    try {
        const { userId } = req.query;
        
        const user = await User.findOne({ telegramId: userId.toString() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            wallet: user.balance,
            totalWins: user.totalWins,
            totalGames: user.totalGames
        });
    } catch (error) {
        console.error('Get user balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper functions
function generateDeterministicCard(cardNumber) {
    const card = [];
    const rng = seededRandom(cardNumber);
    
    const COLUMN_RANGES = [
        { min: 1, max: 15 },   // B
        { min: 16, max: 30 },  // I
        { min: 31, max: 45 },  // N
        { min: 46, max: 60 },  // G
        { min: 61, max: 75 }   // O
    ];
    
    for (let col = 0; col < 5; col++) {
        const column = [];
        const range = COLUMN_RANGES[col];
        
        while (column.length < 5) {
            const num = Math.floor(rng() * (range.max - range.min + 1)) + range.min;
            if (!column.includes(num)) {
                column.push(num);
            }
        }
        
        column.sort((a, b) => a - b);
        card.push(column);
    }
    
    return card;
}

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

function getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
}

module.exports = router;
