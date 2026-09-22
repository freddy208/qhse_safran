/**
 * Corrections Excel ↔ DB (sans suppression armoire — voir fix_excel_sync.js pour ça)
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const log = (msg) => console.log('[FIX]', msg);

async function main() {
  log('=== Corrections décimales, dates, produit manquant ===\n');

  // Décimales perdues à l'import
  await prisma.produit.update({ where: { id: 35  }, data: { quantiteUtilisee: 0.5  } }); log('id:35  ACETONE 4K CNN (E9)            → qU: 0.5');
  await prisma.produit.update({ where: { id: 27  }, data: { quantiteUtilisee: 0.5  } }); log('id:27  ETHANOL ABSOLUTE 5l (E11-E12)  → qU: 0.5');
  await prisma.produit.update({ where: { id: 85  }, data: { quantiteUtilisee: 0.5  } }); log('id:85  LINGETTE IPA (F12-F13)          → qU: 0.5');
  await prisma.produit.update({ where: { id: 86  }, data: { quantiteUtilisee: 0.5  } }); log('id:86  DISCOTON D5 CLEAN 2A            → qU: 0.5');
  await prisma.produit.update({ where: { id: 101 }, data: { quantitePresente: 4, quantiteUtilisee: 0.5  } }); log('id:101 EAU PURIFIEE Franceean (H11)    → qP: 4, qU: 0.5');
  await prisma.produit.update({ where: { id: 103 }, data: { quantiteUtilisee: 0.75 } }); log('id:103 GRINDING LIQUID (H11)           → qU: 0.75');
  await prisma.produit.update({ where: { id: 42  }, data: { quantitePresente: 9, quantiteUtilisee: 2 } }); log('id:42  ETHANOL ABSOLUTE (E9)            → qP: 9, qU: 2');

  // Dates
  await prisma.produit.update({ where: { id: 56 }, data: { datePeremption: null              } }); log('id:56  PEINTURE ROUGE (C10)             → date: null (n/a dans Excel)');
  await prisma.produit.update({ where: { id: 46 }, data: { datePeremption: new Date('2026-10-21') } }); log('id:46  ACETONE 4K CNN (B9-C9)           → date: 21/10/2026');

  // Produit manquant : ETHANOL ABSOLUTE SALE (E9)
  const aE9 = await prisma.armoire.findFirst({ where: { nom: { contains: 'E9', mode: 'insensitive' } } });
  if (aE9) {
    const existe = await prisma.produit.findFirst({ where: { armoireId: aE9.id, nom: { contains: 'SALE', mode: 'insensitive' } } });
    if (existe) { log(`id:${existe.id} ETHANOL ABSOLUTE SALE déjà présent (ignoré)`); }
    else {
      const p = await prisma.produit.create({ data: {
        armoireId: aE9.id, nom: 'ETHANOL ABSOLUTE SALE', codeProduit: '90355011443',
        quantitePresente: 9, quantiteUtilisee: 2, statutFds: 'OBSOLETE',
      }});
      log(`+ id:${p.id} ETHANOL ABSOLUTE SALE créé (E9, qP:9, qU:2, OBSOLETE)`);
    }
  }

  // Résumé
  const tous = await prisma.produit.findMany();
  const aJour = tous.filter(p => p.statutFds === 'A_JOUR').length;
  const obs   = tous.filter(p => p.statutFds === 'OBSOLETE').length;
  const man   = tous.filter(p => p.statutFds === 'MANQUANTE').length;
  log(`\nTotal: ${tous.length} produits | ${aJour} à jour / ${obs} obsolètes / ${man} manquantes`);
  log('\n=== Terminé ===');
}
main().catch(console.error).finally(() => prisma.$disconnect());
