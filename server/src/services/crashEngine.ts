import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { WalletService } from './wallet.js';

export class CrashEngine {
  private wss: WebSocketServer;
  private currentMultiplier: number = 1.00;
  private crashPoint: number = 1.00;
  private status: 'WAITING' | 'FLYING' | 'CRASHED' = 'WAITING';
  private roundId: string = '';
  private timer: NodeJS.Timeout | null = null;
  private activeBets: Map = new Map();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.initSocketHandlers();
    this.startNewRound();
  }

  private initSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({
        event: 'INIT_STATE',
        data: { status: this.status, multiplier: this.currentMultiplier, roundId: this.roundId }
      }));
    });
  }

  private broadcast(event: string, data: any) {
    const msg = JSON.stringify({ event, data });
    this.wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
  }

  private generateCrashPoint() {
    const seed = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const r = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    let cp = 1.01;
    if (r > 0.04) {
      cp = Math.floor((0.96 / (1 - r)) * 100) / 100;
    }
    return { crashPoint: Math.max(1.00, cp), seed, hash };
  }

  private async startNewRound() {
    this.status = 'WAITING';
    this.currentMultiplier = 1.00;
    this.activeBets.clear();

    const { crashPoint, seed, hash } = this.generateCrashPoint();
    this.crashPoint = crashPoint;

    const round = await prisma.crashRound.create({
      data: { crashPoint: this.crashPoint, seed, hash }
    });
    this.roundId = round.id;

    this.broadcast('ROUND_WAITING', { roundId: this.roundId, hash, waitSeconds: 5 });
    setTimeout(() => this.launch(), 5000);
  }

  private launch() {
    this.status = 'FLYING';
    const start = Date.now();

    this.timer = setInterval(async () => {
      const elapsed = (Date.now() - start) / 1000;
      this.currentMultiplier = Math.floor(Math.pow(Math.E, 0.07 * elapsed) * 100) / 100;

      if (this.currentMultiplier >= this.crashPoint) {
        clearInterval(this.timer!);
        this.status = 'CRASHED';
        this.broadcast('ROUND_CRASHED', { roundId: this.roundId, multiplier: this.crashPoint });

        await prisma.crashRound.update({
          where: { id: this.roundId },
          data: { isFinished: true, finishedAt: new Date() }
        });

        setTimeout(() => this.startNewRound(), 4000);
      } else {
        this.broadcast('TICK', { multiplier: this.currentMultiplier });
      }
    }, 100);
  }

  public async placeBet(userId: string, amount: number) {
    if (this.status !== 'WAITING') throw new Error('Раунд уже начался');
    await WalletService.deductBalance(userId, amount, 'BET', { game: 'ROCKET', roundId: this.roundId });

    await prisma.crashBet.create({
      data: { roundId: this.roundId, userId, amount }
    });
    this.activeBets.set(userId, { userId, amount });
    return { success: true };
  }

  public async cashout(userId: string) {
    if (this.status !== 'FLYING') throw new Error('Самолет не в полете');
    const bet = this.activeBets.get(userId);
    if (!bet) throw new Error('Ставка не найдена');

    const payout = Math.floor(bet.amount * this.currentMultiplier * 100) / 100;
    this.activeBets.delete(userId);

    await prisma.crashBet.updateMany({
      where: { roundId: this.roundId, userId },
      data: { cashout: this.currentMultiplier, payout, isWon: true }
    });

    const newBalance = await WalletService.creditBalance(userId, payout, 'WIN', {
      game: 'ROCKET',
      multiplier: this.currentMultiplier
    });

    return { payout, multiplier: this.currentMultiplier, newBalance };
  }
}
