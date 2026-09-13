import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { prisma } from './db.js';
import { verifyTelegramAuth, AuthenticatedRequest } from './middleware/auth.js';
import { CrashEngine } from './services/crashEngine.js';
import { MinesEngine } from './services/minesEngine.js';
import { CasesService, UpgradeService } from './services/casesAndUpgrade.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/rocket' });

app.use(cors());
app.use(express.json());

// Запуск игрового WebSocket движка
const rocketGame = new CrashEngine(wss);

// 1. Авторизация TMA
app.post('/api/auth/sync', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tg = req.user;
    const user = await prisma.user.upsert({
      where: { telegramId: tg.telegramId },
      update: { username: tg.username, firstName: tg.firstName, avatarUrl: tg.avatarUrl },
      create: {
        telegramId: tg.telegramId,
        username: tg.username,
        firstName: tg.firstName,
        avatarUrl: tg.avatarUrl,
        balance: 1000.00
      }
    });
    res.json({ success: true, user });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Данные пользователя
app.get('/api/user/me', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: req.user.telegramId },
    include: {
      transactions: { take: 20, orderBy: { createdAt: 'desc' } },
      inventory: { include: { item: true } }
    }
  });
  res.json(user);
});

// 3. API игры Мины
app.post('/api/games/mines/start', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { bet, minesCount } = req.body;
    const user = await prisma.user.findUnique({ where: { telegramId: req.user.telegramId } });
    const result = await MinesEngine.start(user!.id, Number(bet), Number(minesCount));
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/mines/reveal', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId, cellIndex } = req.body;
    const user = await prisma.user.findUnique({ where: { telegramId: req.user.telegramId } });
    const result = await MinesEngine.reveal(user!.id, sessionId, Number(cellIndex));
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/mines/cashout', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.body;
    const user = await prisma.user.findUnique({ where: { telegramId: req.user.telegramId } });
    const result = await MinesEngine.cashout(user!.id, sessionId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 4. API Ракеты (Ставки и Кэшаут)
app.post('/api/games/rocket/bet', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount } = req.body;
    const user = await prisma.user.findUnique({ where: { telegramId: req.user.telegramId } });
    const result = await rocketGame.placeBet(user!.id, Number(amount));
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/rocket/cashout', verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: req.user.telegramId } });
    const result = await rocketGame.cashout(user!.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 5. Админ-панель
app.use('/api/admin', adminRoutes);

// Раздача фронтенда в Production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
