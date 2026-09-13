import { prisma } from '../db.js';
import { WalletService } from './wallet.js';

export class MinesEngine {
  static calculateMultiplier(minesCount: number, revealedCount: number): number {
    let mult = 1.0;
    const totalCells = 25;
    for (let i = 0; i < revealedCount; i++) {
      mult *= (totalCells - i) / (totalCells - minesCount - i);
    }
    return Math.floor(mult * 0.96 * 100) / 100;
  }

  static async start(userId: string, bet: number, minesCount: number) {
    if (minesCount < 1 || minesCount > 24) throw new Error('Недопустимое количество мин');
    await WalletService.deductBalance(userId, bet, 'BET', { game: 'MINES' });

    // Генерация мин
    const field = Array(25).fill(false);
    let placed = 0;
    while (placed < minesCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!field[idx]) {
        field[idx] = true;
        placed++;
      }
    }

    const session = await prisma.gameSession.create({
      data: {
        userId,
        game: 'MINES',
        bet,
        multiplier: 1.0,
        status: 'ACTIVE',
        stateData: {
          mines: field,
          revealed: [],
          minesCount
        }
      }
    });

    return { sessionId: session.id, multiplier: 1.0 };
  }

  static async reveal(userId: string, sessionId: string, cellIndex: number) {
    const session = await prisma.gameSession.findFirst({
      where: { id: sessionId, userId, status: 'ACTIVE' }
    });

    if (!session) throw new Error('Активная игра не найдена');
    const state: any = session.stateData;

    if (state.revealed.includes(cellIndex)) {
      throw new Error('Ячейка уже открыта');
    }

    // Если попал на мину - проигрыш
    if (state.mines[cellIndex]) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: 'LOST' }
      });
      return { status: 'BOOM', mines: state.mines };
    }

    state.revealed.push(cellIndex);
    const newMultiplier = this.calculateMultiplier(state.minesCount, state.revealed.length);

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { multiplier: newMultiplier, stateData: state }
    });

    return { status: 'SAFE', cellIndex, multiplier: newMultiplier, revealedCount: state.revealed.length };
  }

  static async cashout(userId: string, sessionId: string) {
    const session = await prisma.gameSession.findFirst({
      where: { id: sessionId, userId, status: 'ACTIVE' }
    });

    if (!session) throw new Error('Активная игра не найдена');
    const state: any = session.stateData;
    if (state.revealed.length === 0) throw new Error('Откройте хотя бы одну ячейку');

    const mult = Number(session.multiplier);
    const payout = Math.floor(Number(session.bet) * mult * 100) / 100;

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'CASHED_OUT', payout }
    });

    const newBalance = await WalletService.creditBalance(userId, payout, 'WIN', {
      game: 'MINES',
      multiplier: mult
    });

    return { payout, multiplier: mult, newBalance, mines: state.mines };
  }
}
