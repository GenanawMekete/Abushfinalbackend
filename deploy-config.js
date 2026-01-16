// Deployment Configuration for Geez Bingo
module.exports = {
    // ========== ENVIRONMENT CONFIGURATION ==========
    environments: {
        development: {
            name: 'Development',
            port: 3000,
            host: 'localhost',
            mongodb: {
                uri: 'mongodb://localhost:27017/geeze_bingo_dev',
                options: {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    maxPoolSize: 10,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000
                }
            },
            redis: {
                host: 'localhost',
                port: 6379,
                password: null,
                db: 0
            },
            cors: {
                origins: ['http://localhost:8080', 'https://web.telegram.org']
            },
            logging: {
                level: 'debug',
                file: 'logs/development.log'
            }
        },
        
        staging: {
            name: 'Staging',
            port: 3000,
            host: '0.0.0.0',
            mongodb: {
                uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/geeze_bingo_staging',
                options: {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    maxPoolSize: 50,
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 60000,
                    retryWrites: true,
                    w: 'majority'
                }
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || null,
                db: parseInt(process.env.REDIS_DB) || 1
            },
            cors: {
                origins: [
                    'https://staging.bingo.yourdomain.com',
                    'https://web.telegram.org'
                ]
            },
            logging: {
                level: 'info',
                file: 'logs/staging.log'
            }
        },
        
        production: {
            name: 'Production',
            port: process.env.PORT || 3000,
            host: '0.0.0.0',
            mongodb: {
                uri: process.env.MONGODB_URI,
                options: {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    maxPoolSize: 100,
                    serverSelectionTimeoutMS: 30000,
                    socketTimeoutMS: 60000,
                    retryWrites: true,
                    w: 'majority',
                    readPreference: 'secondaryPreferred'
                }
            },
            redis: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
                tls: process.env.REDIS_TLS === 'true' ? {} : undefined
            },
            cors: {
                origins: [
                    'https://bingo.yourdomain.com',
                    'https://www.bingo.yourdomain.com',
                    'https://api.bingo.yourdomain.com',
                    'https://web.telegram.org'
                ]
            },
            logging: {
                level: 'warn',
                file: 'logs/production.log',
                errorFile: 'logs/production-error.log'
            },
            monitoring: {
                enable: true,
                sentryDsn: process.env.SENTRY_DSN,
                newRelicLicenseKey: process.env.NEW_RELIC_LICENSE_KEY
            }
        }
    },
    
    // ========== TELEGRAM BOT CONFIGURATION ==========
    telegram: {
        botToken: process.env.BOT_TOKEN,
        botUsername: process.env.BOT_USERNAME,
        webhookUrl: process.env.BOT_WEBHOOK_URL,
        maxConnections: 100,
        allowedUpdates: ['message', 'callback_query', 'inline_query'],
        apiUrl: 'https://api.telegram.org',
        retryAttempts: 3,
        retryDelay: 1000
    },
    
    // ========== GAME CONFIGURATION ==========
    game: {
        // Timing configuration (import from timing.js)
        timing: require('./src/config/timing'),
        
        // Betting configuration
        betting: {
            minBet: 10,
            maxBet: 1000,
            defaultBet: 10,
            currency: 'ETB'
        },
        
        // Prize distribution
        prizes: {
            // Percentage of total bets that goes to prize pool
            prizePoolPercentage: 85,
            
            // House fee percentage
            houseFeePercentage: 15,
            
            // Minimum prize amount
            minPrize: 10,
            
            // Maximum prize amount (per winner)
            maxPrize: 100000,
            
            // Split prize among multiple winners
            splitAmongWinners: true,
            
            // Bonus for specific patterns
            patternBonuses: {
                full_house: 1.5,    // 50% bonus for full house
                four_corners: 1.2,  // 20% bonus for four corners
                diagonal: 1.1       // 10% bonus for diagonal
            }
        },
        
        // Card configuration
        cards: {
            totalCards: 400,
            gridSize: 5,
            freeSpacePosition: { row: 2, col: 2 },
            generation: {
                algorithm: 'deterministic', // deterministic or random
                seed: 'geeze-bingo-2024'
            }
        },
        
        // Player limits
        players: {
            maxPerGame: 400,
            minPerGame: 2,
            maxActiveGames: 3,
            coolDownBetweenGames: 0,
            referralBonus: 10 // ETB bonus for referred users
        }
    },
    
    // ========== PAYMENT CONFIGURATION ==========
    payment: {
        // Telebirr integration
        telebirr: {
            enabled: true,
            apiKey: process.env.TELEBIRR_API_KEY,
            merchantId: process.env.TELEBIRR_MERCHANT_ID,
            secretKey: process.env.TELEBIRR_SECRET_KEY,
            callbackUrl: process.env.TELEBIRR_CALLBACK_URL,
            verifySms: true,
            autoVerify: false
        },
        
        // Deposit limits
        deposit: {
            minAmount: 10,
            maxAmount: 50000,
            dailyLimit: 100000,
            feePercentage: 0,
            processingTime: 'instant' // instant, 5min, 15min
        },
        
        // Withdrawal limits
        withdrawal: {
            minAmount: 50,
            maxAmount: 10000,
            dailyLimit: 50000,
            feePercentage: 0,
            processingTime: '24h', // 24 hours
            requireVerification: true,
            autoApprove: false
        },
        
        // Transaction settings
        transactions: {
            maxPending: 5,
            expiryTime: 24 * 60 * 60 * 1000, // 24 hours
            retryAttempts: 3
        }
    },
    
    // ========== SECURITY CONFIGURATION ==========
    security: {
        // JWT Configuration
        jwt: {
            secret: process.env.JWT_SECRET,
            expiry: '24h',
            issuer: 'geeze-bingo',
            audience: 'geeze-bingo-users'
        },
        
        // Rate limiting
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 100,
            message: 'Too many requests from this IP, please try again later.'
        },
        
        // CORS
        cors: {
            enabled: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        
        // Helmet (security headers)
        helmet: {
            enabled: true,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.telegram.org"]
                }
            }
        },
        
        // Input validation
        validation: {
            maxBodySize: '10mb',
            maxFieldSize: '2mb',
            maxFiles: 5
        }
    },
    
    // ========== MONITORING & LOGGING ==========
    monitoring: {
        // Application metrics
        metrics: {
            enabled: true,
            port: 9090,
            path: '/metrics',
            collectDefaultMetrics: true,
            prefix: 'geeze_bingo_'
        },
        
        // Health checks
        health: {
            enabled: true,
            path: '/health',
            checks: ['database', 'redis', 'memory', 'disk']
        },
        
        // Logging
        logging: {
            level: process.env.LOG_LEVEL || 'info',
            format: 'json',
            transports: ['console', 'file'],
            rotation: {
                size: '20m',
                interval: '1d',
                maxFiles: '14d'
            }
        }
    },
    
    // ========== PERFORMANCE CONFIGURATION ==========
    performance: {
        // Database connection pooling
        database: {
            poolSize: 100,
            bufferMaxEntries: 0,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 60000
        },
        
        // Redis configuration
        redis: {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            autoResubscribe: true,
            autoResendUnfulfilledCommands: true
        },
        
        // Socket.IO performance
        socket: {
            transports: ['websocket', 'polling'],
            allowUpgrades: true,
            perMessageDeflate: true,
            httpCompression: true,
            cookie: false
        },
        
        // Compression
        compression: {
            enabled: true,
            threshold: 1024,
            level: 6
        }
    },
    
    // ========== DEPLOYMENT SETTINGS ==========
    deployment: {
        // Cluster mode
        cluster: {
            enabled: process.env.NODE_ENV === 'production',
            workers: 'max',
            respawn: true
        },
        
        // PM2 configuration
        pm2: {
            instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
            exec_mode: 'cluster',
            max_memory_restart: '1G',
            watch: false,
            autorestart: true,
            env: {
                NODE_ENV: 'production'
            }
        },
        
        // Docker configuration
        docker: {
            image: 'geeze-bingo',
            tag: 'latest',
            port: 3000,
            volumes: [
                './logs:/app/logs',
                './uploads:/app/uploads'
            ],
            environment: [
                'NODE_ENV=production',
                'MONGODB_URI',
                'REDIS_HOST',
                'REDIS_PASSWORD',
                'BOT_TOKEN',
                'JWT_SECRET'
            ]
        },
        
        // Backup configuration
        backup: {
            enabled: true,
            schedule: '0 2 * * *', // Daily at 2 AM
            retention: 7, // Keep 7 days of backups
            location: '/backup/geeze-bingo',
            include: ['database', 'logs', 'uploads']
        }
    },
    
    // ========== UTILITY METHODS ==========
    
    // Get current environment configuration
    getCurrentConfig: function() {
        const env = process.env.NODE_ENV || 'development';
        return this.environments[env] || this.environments.development;
    },
    
    // Validate all configuration
    validate: function() {
        const env = this.getCurrentConfig();
        const errors = [];
        
        // Check required environment variables
        const required = ['BOT_TOKEN', 'JWT_SECRET'];
        if (env.name === 'production') {
            required.push('MONGODB_URI');
        }
        
        required.forEach(key => {
            if (!process.env[key]) {
                errors.push(`Missing required environment variable: ${key}`);
            }
        });
        
        // Validate Telegram configuration
        if (this.telegram.botToken && !this.telegram.botToken.startsWith('bot')) {
            errors.push('Invalid Telegram bot token format');
        }
        
        // Validate game configuration
        if (this.game.timing.game.minPlayers > this.game.timing.game.maxPlayers) {
            errors.push('Minimum players cannot be greater than maximum players');
        }
        
        if (this.game.players.maxPerGame > 1000) {
            errors.push('Maximum players per game cannot exceed 1000');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration errors:\n${errors.join('\n')}`);
        }
        
        console.log(`✅ Configuration validated for ${env.name} environment`);
        return true;
    },
    
    // Print configuration summary
    printSummary: function() {
        const env = this.getCurrentConfig();
        console.log('\n📋 Geez Bingo Configuration Summary');
        console.log('====================================');
        console.log(`Environment: ${env.name}`);
        console.log(`Port: ${env.port}`);
        console.log(`Host: ${env.host}`);
        console.log(`MongoDB: ${env.mongodb.uri.replace(/:[^:]*@/, ':****@')}`);
        console.log(`Redis: ${env.redis.host}:${env.redis.redis.port}`);
        console.log(`Bot: ${this.telegram.botUsername || 'Not configured'}`);
        console.log(`CORS Origins: ${env.cors.origins.length} allowed`);
        console.log(`Game Timing: ${this.game.timing.formatForDisplay().totalCycleTime} cycle`);
        console.log(`Players: ${this.game.timing.game.minPlayers}-${this.game.timing.game.maxPlayers} per game`);
        console.log(`Cards: ${this.game.cards.totalCards} total`);
        console.log(`Bet: ${this.game.betting.defaultBet} ${this.game.betting.currency}`);
        console.log(`Prize Pool: ${this.game.prizes.prizePoolPercentage}%`);
        console.log('====================================\n');
    }
};

// Export configuration based on environment
module.exports.getConfig = function() {
    const env = process.env.NODE_ENV || 'development';
    const config = {
        ...module.exports.environments[env],
        telegram: module.exports.telegram,
        game: module.exports.game,
        payment: module.exports.payment,
        security: module.exports.security,
        monitoring: module.exports.monitoring,
        performance: module.exports.performance,
        deployment: module.exports.deployment
    };
    
    return config;
};

// Auto-validate on require
try {
    module.exports.validate();
    module.exports.printSummary();
} catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}
