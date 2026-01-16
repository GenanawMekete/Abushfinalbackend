const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const path = require('path');

// Configurations
const config = require('./config');
const logger = require('./utils/logger');

// Services
const GameEngine = require('./engine/GameEngine');
const BotService = require('./bot');
const GameScheduler = require('./jobs/GameScheduler');

// Routes
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const webappRoutes = require('./routes/webapp');

class ServerApp {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.corsOrigins,
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.redis = null;
    this.gameEngine = null;
    this.isShuttingDown = false;
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize database
      await this.connectDatabase();
      
      // Initialize Redis
      await this.connectRedis();
      
      // Initialize services
      await this.initializeServices();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Start server
      this.startServer();
      
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }
  
  async connectDatabase() {
    try {
      await mongoose.connect(config.database.uri, config.database.options);
      logger.info('MongoDB connected successfully');
      
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });
      
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }
  
  async connectRedis() {
    try {
      this.redis = new Redis(config.redis);
      
      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
      });
      
      this.redis.on('error', (err) => {
        logger.error('Redis connection error:', err);
      });
      
      // Test Redis connection
      await this.redis.ping();
      
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }
  
  async initializeServices() {
    // Initialize Game Engine
    this.gameEngine = new GameEngine(this.io, this.redis);
    await this.gameEngine.initialize();
    
    // Initialize Telegram Bot
    await BotService.initialize(this.gameEngine);
    
    // Initialize Game Scheduler
    GameScheduler.initialize(this.gameEngine);
    
    logger.info('All services initialized');
  }
  
  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", config.frontendUrl]
        }
      }
    }));
    
    // CORS
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Compression
    this.app.use(compression());
    
    // Static files for admin panel
    this.app.use('/admin', express.static(path.join(__dirname, '../../admin')));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.url} - ${req.ip}`);
      next();
    });
  }
  
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        redis: this.redis.status === 'ready' ? 'connected' : 'disconnected',
        game: this.gameEngine.getStatus()
      });
    });
    
    // API routes
    this.app.use('/api', apiRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/webapp', webappRoutes);
    this.app.use('/webhook', webhookRoutes);
    
    // Web App route
    this.app.get('/app', (req, res) => {
      res.redirect(config.webappUrl);
    });
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }
  
  setupErrorHandling() {
    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      
      const statusCode = err.statusCode || 500;
      const message = config.isProduction && statusCode === 500 
        ? 'Internal server error' 
        : err.message;
      
      res.status(statusCode).json({
        error: message,
        ...(config.isDevelopment && { stack: err.stack })
      });
    });
    
    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Uncaught exception
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }
  
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        try {
          // Stop accepting new connections
          this.server.close();
          
          // Stop game engine
          await this.gameEngine.shutdown();
          
          // Stop scheduler
          GameScheduler.shutdown();
          
          // Disconnect from Redis
          await this.redis.quit();
          
          // Disconnect from MongoDB
          await mongoose.disconnect();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
          
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    });
  }
  
  startServer() {
    const PORT = config.port;
    
    this.server.listen(PORT, config.host, () => {
      logger.info(`Server running on ${config.host}:${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Admin panel: ${config.adminUrl}`);
      logger.info(`Web App URL: ${config.webappUrl}`);
    });
    
    this.server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });
  }
}

// Start the server
if (require.main === module) {
  new ServerApp();
}

module.exports = ServerApp;
