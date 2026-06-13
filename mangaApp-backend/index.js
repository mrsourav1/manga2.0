import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mangaRouter from './routes/manga.js';
import { closeCache } from './services/cache.js';
import { getAllSourceHealth } from './services/sourceHealth.js';
import { stopPrefetchWorker, startPrefetchWorker } from './workers/prefetch.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const startedAt = new Date().toISOString();

const envBoolean = (name, fallback = false) => {
    const value = process.env[name];
    if (value == null) return fallback;

    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const envNumber = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseAllowedOrigins = () => {
    const raw = process.env.CORS_ORIGIN;
    if (!raw || raw.trim() === '*' || raw.trim() === '') {
        return null;
    }

    return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();
const enableRateLimit = envBoolean('ENABLE_RATE_LIMIT', process.env.NODE_ENV === 'production');
const enablePrefetchWorker = envBoolean('ENABLE_PREFETCH_WORKER', true);

if (envBoolean('TRUST_PROXY', false)) {
    app.set('trust proxy', 1);
}

app.use(cors(
    allowedOrigins
        ? {
            origin(origin, callback) {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }

                return callback(new Error('Origin is not allowed by CORS'));
            },
        }
        : undefined
));
app.use(express.json());

if (enableRateLimit) {
    app.use(rateLimit({
        windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        max: envNumber('RATE_LIMIT_MAX', 120),
        standardHeaders: true,
        legacyHeaders: false,
    }));
}

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        prefetchWorkerEnabled: enablePrefetchWorker,
        sources: getAllSourceHealth(),
    });
});

// Routes
app.use('/api/manga', mangaRouter);

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (enablePrefetchWorker) {
        startPrefetchWorker();
    } else {
        console.log('Prefetch worker disabled by env');
    }
});

const shutdown = async (signal) => {
    console.log(`Shutting down server (${signal})`);
    stopPrefetchWorker();
    await closeCache();
    server.close(() => process.exit(0));
};

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
