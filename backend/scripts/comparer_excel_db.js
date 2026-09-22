/**
 * Compare structure Excel vs DB : zones, armoires, produits, statuts FDS
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const zones = await prisma.zone.findMany({
    include: { armoires: { include: { produits: { orderBy: { id: 'asc' } } } } },
    orderBy: { id: 'asc' },
  });

  console.log('\n=== STRUCTURE COMPLÈTE DB ===\n');
  for (const z of zones) {
    console.log(`ZONE [${z.id}] ${z.nom}`);
    for (const a of z.armoires) {
      console.log(`  ARMOIRE [${a.id}] ${a.nom} (${a.produits.length} produits)`);
      for (const p of a.produits) {
        const fds = p.statutFds ?? '???';
        const date = p.datePeremption ? new Date(p.datePeremption).toLocaleDateString('fr-FR') : 'sans date';
        const qp = p.quantitePresente ?? '?';
        const qu = p.quantiteUtilisee ?? '?';
        console.log(`    [${p.id}] ${p.nom.padEnd(35)} | FDS:${fds.padEnd(9)} | qP:${String(qp).padStart(4)} qU:${String(qu).padStart(4)} | pérem:${date}`);
      }
    }
    console.log();
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
