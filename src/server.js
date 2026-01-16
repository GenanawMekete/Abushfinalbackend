const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const connectDB = require('./config/db');
const bot = require('./bot');
const gameState = require('./engine/gameState');
const roundScheduler = require('./jobs/roundScheduler');
const logger = require('./utils/logger');

// Routes
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Connect to database
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Initialize game state with Socket.IO
gameState.setSocketIO(io);

// Routes
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/webhook', webhookRoutes);

// Serve admin dashboard
app.use('/admin-panel', express.static('admin'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    gameStatus: gameState.activeGame ? gameState.activeGame.status : 'idle'
  });
});

// Socket.IO connection
io.on('connection', (socket) => {
  logger.info('New client connected:', socket.id);
  
  // Send current game state
  if (gameState.activeGame) {
    socket.emit('gameState', {
      gameId: gameState.activeGame.gameId,
      status: gameState.activeGame.status,
      players: gameState.activeGame.players.length,
      drawnNumbers: gameState.activeGame.drawnNumbers,
      totalPrizePool: gameState.activeGame.totalPrizePool
    });
  }
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Set webhook in production
if (config.NODE_ENV === 'production') {
  bot.setWebhook();
}

// Start round scheduler
roundScheduler.start();

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = config.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Bot running in ${config.NODE_ENV} mode`);
  logger.info(`Admin panel: http://localhost:${PORT}/admin-panel`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
