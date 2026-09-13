import { prisma } from '../db.js';
import { Prisma } from '@prisma/client';

export class WalletService {
  static async deductBalance(userId: string, amount: number, txType: any, details?: any) {
    if (amount <= 0) throw new Error('Сумма списания должна быть больше 0');

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      });

      if (!user) throw new Error('Пользователь не найден');
      if (Number(user.balance) < amount) {
        throw new Error('Недостаточно средств на балансе');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: new Prisma.Decimal(amount) } }
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(-amount),
          type: txType,
          details: details || {}
        }
      });

      return Number(updated.balance);
    });
  }

  static async creditBalance(userId: string, amount: number, txType: any, details?: any) {
    if (amount <= 0) throw new Error('Сумма начисления должна быть больше 0');

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: new Prisma.Decimal(amount) } }
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: txType,
          details: details || {}
        }
      });

      return Number(updated.balance);
    });
  }
}
