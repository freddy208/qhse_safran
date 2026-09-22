/**
 * Corrections résiduelles après vérification
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ACETONE_URL = 'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/204296.pdf';

async function main() {
  // 1. id:35 ACETONE 4K CNN (E9) — manque statutFds
  await prisma.produit.update({ where: { id: 35 }, data: { statutFds: 'A_JOUR', urlFds: ACETONE_URL } });
  console.log('id:35 ACETONE 4K CNN (E9) → A_JOUR + URL');

  // 2. id:93 ACETONE (F12-F13 Ajustage) — manque statutFds
  await prisma.produit.update({ where: { id: 93 }, data: { statutFds: 'A_JOUR', urlFds: ACETONE_URL, responsable: 'P.LE BOURHIS' } });
  console.log('id:93 ACETONE (F12-F13) → A_JOUR + URL + responsable');

  // 3. id:44 ACETONE 5l (Inspection ICLB) — vérifier l'armoire et corriger
  const p44 = await prisma.produit.findUnique({ where: { id: 44 }, include: { armoire: { include: { zone: true } } } });
  if (p44) {
    console.log(`id:44 "${p44.nom}" — zone: ${p44.armoire.zone.nom}, armoire: ${p44.armoire.nom}`);
    // C'est un ACETONE → A_JOUR
    await prisma.produit.update({ where: { id: 44 }, data: { statutFds: 'A_JOUR', urlFds: ACETONE_URL } });
    console.log('id:44 → A_JOUR + URL');
  }

  // 4. id:63 OIL TYPE BV 32 — quantitePresente null : normal (pas de donnée en Excel)
  //    On met 0 par défaut pour cohérence, seulement si vraiment null
  const p63 = await prisma.produit.findUnique({ where: { id: 63 } });
  if (p63 && p63.quantitePresente == null) {
    console.log(`id:63 "${p63.nom}" — quantitePresente null en Excel aussi, laissé tel quel`);
  }

  // 5. id:86 DISCOTON D5 CLEAN 2A — périmé depuis sept. 2020 : donnée réelle Excel, pas d'erreur
  //    Le produit est réellement périmé depuis 2020, c'est un fait à signaler aux utilisateurs
  const p86 = await prisma.produit.findUnique({ where: { id: 86 } });
  if (p86) {
    console.log(`id:86 "${p86.nom}" — périmé depuis ${new Date(p86.datePeremption).toLocaleDateString('fr-FR')} : donnée réelle Excel, aucune correction nécessaire`);
  }

  console.log('\nCorrections résiduelles terminées.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
