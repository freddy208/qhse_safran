import { Response } from 'express';

export function parseId(raw: string, res: Response): number | null {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: 'ID invalide' });
    return null;
  }
  return id;
}
