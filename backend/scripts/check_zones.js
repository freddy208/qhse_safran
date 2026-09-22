if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const zones = await prisma.zone.findMany({
    include: { armoires: { include: { _count: { select: { produits: true } } } } },
  });
  console.log('\n=== ZONES & ARMOIRES ===');
  for (const z of zones) {
    console.log(`ZONE [${z.id}] "${z.nom}" (projetId:${z.projetId})`);
    for (const a of z.armoires) {
      console.log(`  ARM [${a.id}] "${a.nom}" → ${a._count.produits} produits`);
    }
  }
  // Anomalies spécifiques à vérifier
  console.log('\n=== VÉRIFICATION ANOMALIES CIBLÉES ===');
  const gel = await prisma.produit.findUnique({ where: { id: 102 } });
  console.log(`id:102 GEL SANIMAIN → qP:${gel.quantitePresente}, qU:${gel.quantiteUtilisee} (Excel dit qP:1, qU:1)`);
  const propanol = await prisma.produit.findUnique({ where: { id: 28 } });
  console.log(`id:28  PROPANOL 5l  → qP:${propanol.quantitePresente}, qU:${propanol.quantiteUtilisee} (Excel dit qP:1, qU:1)`);
  const acetoneB9 = await prisma.produit.findUnique({ where: { id: 46 } });
  console.log(`id:46  ACETONE B9-C9→ qP:${acetoneB9.quantitePresente}, qU:${acetoneB9.quantiteUtilisee} (Excel dit qP:1, qU:1)`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
