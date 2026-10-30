import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { connectRedis, disconnectRedis } from './redis/redis';
import { closeEmailQueue } from './queues/email.queue';
import { emailWorker, stopEmailWorker } from './workers/email.worker';
import { setupBullBoard } from './dashboard/bullboard';
import { authRouter } from './routes/auth.routes';
import { emailRouter } from './routes/email.routes';
import { slackRouter } from './routes/slack.routes';
import { etherealService } from './services/ethereal.service';

const app = express();

// ==============================================================================
// Middleware Configuration
// ==============================================================================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.pages.dev') ||
        origin.endsWith('.workers.dev') ||
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }
      // Fallback: permit request to ensure frontend on any Cloudflare/custom domain can communicate
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==============================================================================
// Health Check & Root
// ==============================================================================
app.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    workerRunning: !emailWorker.isPaused(),
  });
});

// ==============================================================================
// Bull-Board UI Dashboard
// ==============================================================================
app.use('/admin/queues', setupBullBoard());

// ==============================================================================
// API Routes
// ==============================================================================
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ==============================================================================
// Server Lifecycle
// ==============================================================================
const server = app.listen(env.PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Email Scheduler Backend running on port ${env.PORT}`);
  console.log(`📡 Health Check:       http://localhost:${env.PORT}/health`);
  console.log(`📊 Bull-Board Queue UI: http://localhost:${env.PORT}/admin/queues`);
  console.log(`🔐 Dev Login Endpoint:  POST http://localhost:${env.PORT}/api/auth/dev-login`);
  console.log(`======================================================\n`);

  try {
    await connectRedis();
    etherealService.getTransporter().catch((e) => {
      console.warn('⚠️ Ethereal transporter warm-up deferred:', e.message);
    });
  } catch (err: any) {
    console.warn('⚠️ Could not eagerly connect to Redis:', err.message);
  }
});

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Commencing graceful shutdown...`);

  server.close(async () => {
    console.log('🚪 HTTP server closed');
    try {
      await stopEmailWorker();
      await closeEmailQueue();
      await disconnectRedis();
      await prisma.$disconnect();
      console.log('✅ All connections gracefully terminated. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
