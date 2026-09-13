import { prisma } from '../db.js';
import { WalletService } from './wallet.js';

export class CasesService {
  static async openCase(userId: string, caseSlug: string) {
    const c = await prisma.case.findUnique({
      where: { slug: caseSlug },
      include: { items: { include: { item: true } } }
    });

    if (!c) throw new Error('Кейс не найден');
    await WalletService.deductBalance(userId, Number(c.price), 'CASE_OPEN', { case: c.name });

    // Процентная рулетка
    const rand = Math.random() * 100;
    let accumulated = 0;
    let wonItem = c.items[0].item;

    for (const ci of c.items) {
      accumulated += ci.chance;
      if (rand <= accumulated) {
        wonItem = ci.item;
        break;
      }
    }

    const inventoryItem = await prisma.inventoryItem.create({
      data: { userId, itemId: wonItem.id },
      include: { item: true }
    });

    return inventoryItem;
  }
}

export class UpgradeService {
  static async upgrade(userId: string, myInventoryItemId: string, targetItemId: string) {
    const myItem = await prisma.inventoryItem.findFirst({
      where: { id: myInventoryItemId, userId },
      include: { item: true }
    });
    if (!myItem) throw new Error('Предмет не найден в вашем инвентаре');

    const targetItem = await prisma.item.findUnique({ where: { id: targetItemId } });
    if (!targetItem) throw new Error('Целевой предмет не найден');

    const sourcePrice = Number(myItem.item.price);
    const targetPrice = Number(targetItem.price);
    if (targetPrice <= sourcePrice) throw new Error('Целевой предмет должен быть дороже');

    // Расчет шанса: (цена_исходного / цена_целевого) * 95% (с комиссией дома)
    const winChance = Math.min(95, Math.floor((sourcePrice / targetPrice) * 95));
    const roll = Math.random() * 100;
    const isSuccess = roll <= winChance;

    // Сжигаем исходный предмет
    await prisma.inventoryItem.delete({ where: { id: myInventoryItemId } });

    if (isSuccess) {
      const newItem = await prisma.inventoryItem.create({
        data: { userId, itemId: targetItemId },
        include: { item: true }
      });
      return { success: true, winChance, item: newItem };
    }

    return { success: false, winChance };
  }
}
