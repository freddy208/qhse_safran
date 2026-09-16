import { PrismaClient } from '@prisma/client';

// Singleton — une seule instance pour tout le processus Node.js
// Évite la saturation du pool de connexions Neon (max 10 connexions)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
