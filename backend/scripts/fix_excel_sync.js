/**
 * Synchronisation finale DB → Excel (toutes corrections vérifiées sur fichiers Excel)
 * Aucune valeur inventée : tout est extrait des fichiers Excel sources.
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const log = (msg) => console.log('[FIX]', msg);
const d = (s) => new Date(s);

async function main() {
  log('=== Synchronisation DB ↔ Excel ===\n');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. QUANTITÉS UTILISÉES DÉCIMALES perdues à l'import (Excel → DB)
  // ─────────────────────────────────────────────────────────────────────────
  log('--- 1. Décimales perdues à l\'import ---');

  // Excel R54 : E9 ACETONE 4K CNN (2ème) → qU:0.5
  await prisma.produit.update({ where: { id: 35 }, data: { quantiteUtilisee: 0.5 } });
  log('id:35 ACETONE 4K CNN (E9) → qU: 0.5');

  // Excel R60 : E11-E12 ETHANOL ABSOLUTE 5l → qU:0.5
  await prisma.produit.update({ where: { id: 27 }, data: { quantiteUtilisee: 0.5 } });
  log('id:27 ETHANOL ABSOLUTE 5l (E11-E12) → qU: 0.5');

  // Excel R85 : F12-F13 LINGETTE IPA → qU:0.5
  await prisma.produit.update({ where: { id: 85 }, data: { quantiteUtilisee: 0.5 } });
  log('id:85 LINGETTE IPA (F12-F13) → qU: 0.5');

  // Excel R86 : F12-F13 DISCOTON D5 CLEAN 2A → qU:0.5
  await prisma.produit.update({ where: { id: 86 }, data: { quantiteUtilisee: 0.5 } });
  log('id:86 DISCOTON D5 CLEAN 2A (F12-F13) → qU: 0.5');

  // Excel R104 : H11 EAU PURIFIEE Franceean → qP:4, qU:0.5
  await prisma.produit.update({ where: { id: 101 }, data: { quantitePresente: 4, quantiteUtilisee: 0.5 } });
  log('id:101 EAU PURIFIEE Franceean (H11) → qP: 4, qU: 0.5');

  // Excel R106 : H11 GRINDING LIQUID → qU:0.75
  await prisma.produit.update({ where: { id: 103 }, data: { quantiteUtilisee: 0.75 } });
  log('id:103 GRINDING LIQUID EP 770 (H11) → qU: 0.75');

  // Excel R49 : E9 ETHANOL ABSOLUTE → qP:9, qU:2
  // (DB avait qP:11, qU:1 — valeur aberrante non présente dans Excel)
  await prisma.produit.update({ where: { id: 42 }, data: { quantitePresente: 9, quantiteUtilisee: 2 } });
  log('id:42 ETHANOL ABSOLUTE (E9) → qP: 9, qU: 2');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DATES : erreurs d'import
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 2. Dates ---');

  // Excel R30 : C10 PEINTURE ROUGE → date "n/a" (pas de date)
  // DB avait 30/05/2030 : date inventée (appartient à AIRSEC/ZE)
  await prisma.produit.update({ where: { id: 56 }, data: { datePeremption: null } });
  log('id:56 PEINTURE ROUGE (C10) → datePeremption: null (Excel dit n/a)');

  // Excel R11 : B9-C9 ACETONE 4 K CNN → date:21/10/2026 (manquait en DB)
  await prisma.produit.update({ where: { id: 46 }, data: { datePeremption: d('2026-10-21') } });
  log('id:46 ACETONE 4 K CNN (B9-C9) → datePeremption: 21/10/2026');

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PRODUIT MANQUANT : ETHANOL ABSOLUTE SALE (E9)
  //    Excel R50 : distinct de ETHANOL ABSOLUTE (R49) — même code, deux contenants
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 3. Produit manquant : ETHANOL ABSOLUTE SALE ---');

  const aE9 = await prisma.armoire.findFirst({ where: { nom: { contains: 'E9', mode: 'insensitive' } } });
  if (!aE9) { log('⚠ Armoire E9 introuvable'); }
  else {
    const existe = await prisma.produit.findFirst({
      where: { armoireId: aE9.id, nom: { contains: 'SALE', mode: 'insensitive' } },
    });
    if (existe) {
      log(`ETHANOL ABSOLUTE SALE déjà présent id:${existe.id} (ignoré)`);
    } else {
      const p = await prisma.produit.create({ data: {
        armoireId: aE9.id,
        nom: 'ETHANOL ABSOLUTE SALE',
        codeProduit: '90355011443',
        quantitePresente: 9,
        quantiteUtilisee: 2,
        statutFds: 'OBSOLETE',
      }});
      log(`+ ETHANOL ABSOLUTE SALE créé id:${p.id} (E9, qP:9, qU:2, OBSOLETE)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ARMOIRE INVENTÉE : Inspection – ICLB (id:10)
  //    Absent des fichiers Excel → supprimer le produit id:44 et l'armoire
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 4. Suppression armoire inventée "Inspection – ICLB" ---');

  const armoireInventee = await prisma.armoire.findUnique({
    where: { id: 10 },
    include: { produits: true, resultats: true },
  });

  if (!armoireInventee) {
    log('Armoire id:10 introuvable (déjà supprimée ?)');
  } else {
    log(`Armoire id:10 "${armoireInventee.nom}" : ${armoireInventee.produits.length} produit(s), ${armoireInventee.resultats.length} résultat(s)`);
    // Supprimer les produits
    for (const p of armoireInventee.produits) {
      await prisma.produit.delete({ where: { id: p.id } });
      log(`  - Produit id:${p.id} "${p.nom}" supprimé`);
    }
    // Supprimer les résultats checklist
    for (const r of armoireInventee.resultats) {
      await prisma.resultatCritere.delete({ where: { id: r.id } });
    }
    // Supprimer l'armoire
    await prisma.armoire.delete({ where: { id: 10 } });
    log(`  - Armoire "Inspection – ICLB" supprimée`);
  }

  log('\n=== Corrections terminées ===');

  // Résumé final
  const tous = await prisma.produit.findMany();
  const aJour    = tous.filter(p => p.statutFds === 'A_JOUR').length;
  const obsolete = tous.filter(p => p.statutFds === 'OBSOLETE').length;
  const manquant = tous.filter(p => p.statutFds === 'MANQUANTE').length;
  log(`\nTotal produits: ${tous.length} | FDS: ${aJour} à jour / ${obsolete} obsolètes / ${manquant} manquantes`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
