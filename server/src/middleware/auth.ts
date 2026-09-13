import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export function verifyTelegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const initData = req.headers['x-telegram-init-data'] as string;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = { telegramId: '10001', username: 'dev_player', firstName: 'Dev' };
      return next();
    }
    return res.status(401).json({ error: 'Telegram auth missing' });
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const params: string[] = [];
    urlParams.sort();
    for (const [k, v] of urlParams.entries()) {
      params.push(`\({k}=\){v}`);
    }
    const dataCheckString = params.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken || '').digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'HMAC signature verification failed' });
    }

    const userJson = urlParams.get('user');
    if (userJson) {
      const tgUser = JSON.parse(userJson);
      req.user = {
        telegramId: String(tgUser.id),
        username: tgUser.username,
        firstName: tgUser.first_name,
        avatarUrl: tgUser.photo_url
      };
    }
    next();
  } catch (e: any) {
    return res.status(400).json({ error: 'Auth parsing error' });
  }
}

export function verifyAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'] as string;
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized: Admin access required' });
}
