import { Router } from 'express';
import { prisma } from '../db.js';
import { verifyAdmin } from '../middleware/auth.js';

const router = Router();
router.use(verifyAdmin);

router.get('/stats', async (req, res) => {
  const usersCount = await prisma.user.count();
  const txTotal = await prisma.transaction.aggregate({
    _sum: { amount: true }
  });
  const recentGames = await prisma.gameSession.count();
  res.json({ usersCount, netTurnover: txTotal._sum.amount || 0, recentGames });
});

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { inventory: { include: { item: true } } }
  });
  res.json(users);
});

router.post('/users/:id/balance', async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  const updated = await prisma.user.update({
    where: { id },
    data: { balance: { increment: amount } }
  });
  res.json(updated);
});

export default router;
