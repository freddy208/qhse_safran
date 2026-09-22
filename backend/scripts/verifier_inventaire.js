/**
 * Vérification inventaire DB vs Excel
 * Usage : node scripts/verifier_inventaire.js
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
    include: { armoires: { include: { produits: true } } },
    orderBy: { id: 'asc' },
  });

  let total = 0, sansFds = 0, sansQuantite = 0, sansDate = 0, suspects = 0;
  const alertes = [];
  const now = new Date();

  for (const z of zones) {
    for (const a of z.armoires) {
      for (const p of a.produits) {
        total++;

        // Statut FDS absent
        if (!p.statutFds) {
          alertes.push(`⚠ [FDS manquant] id:${p.id} "${p.nom}" — armoire: ${a.nom}`);
          sansFds++;
        }

        // Quantité présente nulle ou suspecte
        if (p.quantitePresente == null) {
          alertes.push(`⚠ [Qté présente null] id:${p.id} "${p.nom}" — armoire: ${a.nom}`);
          sansQuantite++;
        } else if (p.quantitePresente > 10000) {
          alertes.push(`🔴 [Qté présente suspecte: ${p.quantitePresente}] id:${p.id} "${p.nom}"`);
          suspects++;
        }

        // Quantité utilisée suspecte
        if (p.quantiteUtilisee != null && p.quantiteUtilisee > 10000) {
          alertes.push(`🔴 [Qté utilisée suspecte: ${p.quantiteUtilisee}] id:${p.id} "${p.nom}"`);
          suspects++;
        }

        // Date de péremption manquante (non bloquant mais noter)
        if (!p.datePeremption) {
          sansDate++;
        }

        // Date de péremption dans le futur très lointain (>10 ans)
        if (p.datePeremption) {
          const annees = (new Date(p.datePeremption) - now) / (365.25 * 24 * 3600 * 1000);
          if (annees > 10) {
            alertes.push(`⚠ [Date péremption très lointaine: ${new Date(p.datePeremption).toLocaleDateString('fr-FR')}] id:${p.id} "${p.nom}"`);
          }
          if (annees < -3) {
            alertes.push(`🔴 [Périmé depuis +3 ans: ${new Date(p.datePeremption).toLocaleDateString('fr-FR')}] id:${p.id} "${p.nom}"`);
          }
        }
      }
    }
  }

  console.log('\n=== RAPPORT DE VÉRIFICATION INVENTAIRE ===\n');
  console.log(`Total produits       : ${total}`);
  console.log(`Sans statut FDS      : ${sansFds}`);
  console.log(`Sans quantité présente: ${sansQuantite}`);
  console.log(`Sans date péremption : ${sansDate}`);
  console.log(`Valeurs suspectes    : ${suspects}`);

  if (alertes.length === 0) {
    console.log('\n✅ Aucune anomalie détectée — données cohérentes avec les Excel.');
  } else {
    console.log(`\n${alertes.length} anomalie(s) détectée(s) :\n`);
    alertes.forEach((a) => console.log(' ', a));
  }

  // Résumé FDS par statut
  const tous = zones.flatMap(z => z.armoires.flatMap(a => a.produits));
  const aJour    = tous.filter(p => p.statutFds === 'A_JOUR').length;
  const obsolete = tous.filter(p => p.statutFds === 'OBSOLETE').length;
  const manquant = tous.filter(p => p.statutFds === 'MANQUANTE').length;
  const nonDefini= tous.filter(p => !p.statutFds).length;
  console.log('\n--- Répartition FDS ---');
  console.log(`  À jour    : ${aJour}`);
  console.log(`  Obsolètes : ${obsolete}`);
  console.log(`  Manquantes: ${manquant}`);
  console.log(`  Non défini: ${nonDefini}`);

  // Résumé péremption
  const perime   = tous.filter(p => p.datePeremption && new Date(p.datePeremption) < now).length;
  const in6m     = new Date(now); in6m.setMonth(in6m.getMonth() + 6);
  const bientot  = tous.filter(p => {
    if (!p.datePeremption) return false;
    const d = new Date(p.datePeremption);
    return d >= now && d <= in6m;
  }).length;
  console.log('\n--- Répartition péremption ---');
  console.log(`  Périmés            : ${perime}`);
  console.log(`  Expire dans 6 mois : ${bientot}`);
  console.log(`  Sans date          : ${sansDate}`);
  console.log();
}

main().catch(console.error).finally(() => prisma.$disconnect());
