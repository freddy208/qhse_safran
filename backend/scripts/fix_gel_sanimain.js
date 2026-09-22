/**
 * Correction id:102 GEL SANIMAIN qP=4 → qP=1 (Excel L105 : qP=1, qU=1)
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const avant = await prisma.produit.findUnique({ where: { id: 102 } });
  console.log(`Avant : id:102 "${avant.nom}" qP=${avant.quantitePresente} qU=${avant.quantiteUtilisee}`);

  await prisma.produit.update({ where: { id: 102 }, data: { quantitePresente: 1 } });
  console.log('Après : qP=1 (Excel L105 H11 CHAUDRONNERIE : "GEL SANIMAIN 5 l" qP=1)');

  // Vérification finale
  const total = await prisma.produit.count();
  const aJour = await prisma.produit.count({ where: { statutFds: 'A_JOUR' } });
  const obs   = await prisma.produit.count({ where: { statutFds: 'OBSOLETE' } });
  const man   = await prisma.produit.count({ where: { statutFds: 'MANQUANTE' } });
  console.log(`\nTotal: ${total} produits | FDS: ${aJour} à jour / ${obs} obsolètes / ${man} manquantes`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
