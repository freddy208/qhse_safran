/**
 * Dump complet de la DB Neon en ligne pour vérification
 */
if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Zones et armoires
  const zones = await prisma.zone.findMany({
    include: {
      armoires: {
        include: { produits: { orderBy: { nom: 'asc' } } },
        orderBy: { nom: 'asc' },
      },
    },
    orderBy: { nom: 'asc' },
  });

  let totalProduits = 0;
  let aJour = 0, obsolete = 0, manquante = 0, sansFds = 0;
  let perime = 0, expireBientot = 0;
  const now = new Date();
  const in6m = new Date(now); in6m.setMonth(in6m.getMonth() + 6);

  const lignes = [];
  for (const z of zones) {
    for (const a of z.armoires) {
      for (const p of a.produits) {
        totalProduits++;
        if (p.statutFds === 'A_JOUR')    aJour++;
        else if (p.statutFds === 'OBSOLETE') obsolete++;
        else if (p.statutFds === 'MANQUANTE') manquante++;
        else sansFds++;

        const dp = p.datePeremption ? new Date(p.datePeremption) : null;
        const est_perime = dp && dp < now;
        const expire_bientot = dp && dp >= now && dp <= in6m;
        if (est_perime) perime++;
        if (expire_bientot) expireBientot++;

        lignes.push({
          id:          p.id,
          zone:        z.nom,
          armoire:     a.nom,
          nom:         p.nom,
          code:        p.codeProduit ?? '',
          qP:          p.quantitePresente,
          qU:          p.quantiteUtilisee,
          volMax:      p.volumeMax ?? '',
          statutFds:   p.statutFds ?? 'NULL',
          urlFds:      p.urlFds ? 'OUI' : 'non',
          datePerem:   dp ? dp.toLocaleDateString('fr-FR') : '',
          est_perime:  est_perime ? '⚠PÉRIMÉ' : (expire_bientot ? '⏰BIENTOT' : ''),
          responsable: p.responsable ?? '',
        });
      }
    }
  }

  console.log('\n=== DUMP COMPLET DB NEON ===\n');
  console.log(`Zones: ${zones.length} | Armoires: ${zones.reduce((s,z) => s+z.armoires.length, 0)} | Produits: ${totalProduits}`);
  console.log(`FDS: ${aJour} à jour / ${obsolete} obsolètes / ${manquante} manquantes / ${sansFds} sans statut`);
  console.log(`Péremption: ${perime} périmés / ${expireBientot} expirent ≤6 mois\n`);

  const header = 'ID   | ZONE                    | ARMOIRE              | NOM                                   | CODE          | qP   | qU   | FDS       | URL | PEREM      | ALERT     | RESP';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const l of lignes) {
    const row = [
      String(l.id).padStart(4),
      l.zone.substring(0,23).padEnd(23),
      l.armoire.substring(0,20).padEnd(20),
      l.nom.substring(0,37).padEnd(37),
      (l.code||'').substring(0,13).padEnd(13),
      String(l.qP ?? '?').padStart(4),
      String(l.qU ?? '?').padStart(4),
      (l.statutFds||'').padEnd(9),
      l.urlFds.padEnd(3),
      (l.datePerem||'').padEnd(10),
      (l.est_perime||'').padEnd(9),
      l.responsable.substring(0,15),
    ].join(' | ');
    console.log(row);
  }

  // 2. Anomalies détectées
  console.log('\n\n=== ANOMALIES DÉTECTÉES ===\n');

  const anomalies = [];
  for (const l of lignes) {
    if (l.statutFds === 'NULL') anomalies.push(`id:${l.id} ${l.nom} — statut FDS manquant (NULL)`);
    if (l.qP === null && l.nom !== 'OIL TYPE BV 32') anomalies.push(`id:${l.id} ${l.nom} — quantitePresente NULL`);
    if (l.qU === null) anomalies.push(`id:${l.id} ${l.nom} — quantiteUtilisee NULL`);
    if (l.est_perime === '⚠PÉRIMÉ') anomalies.push(`id:${l.id} ${l.nom} — PÉRIMÉ depuis ${l.datePerem}`);
  }

  if (anomalies.length === 0) console.log('Aucune anomalie détectée.');
  else anomalies.forEach(a => console.log('  !' , a));

  // 3. FDS manquantes (pour vérifier cohérence dashboard)
  console.log(`\n\n=== FDS MANQUANTES (${manquante}) ===\n`);
  lignes.filter(l => l.statutFds === 'MANQUANTE').forEach(l =>
    console.log(`  id:${String(l.id).padStart(3)} [${l.zone}] ${l.armoire} → ${l.nom}`)
  );

  // 4. FDS obsolètes
  console.log(`\n=== FDS OBSOLÈTES (${obsolete}) ===\n`);
  lignes.filter(l => l.statutFds === 'OBSOLETE').forEach(l =>
    console.log(`  id:${String(l.id).padStart(3)} [${l.zone}] ${l.armoire} → ${l.nom}`)
  );

  // 5. Produits périmés
  console.log(`\n=== PRODUITS PÉRIMÉS (${perime}) ===\n`);
  lignes.filter(l => l.est_perime === '⚠PÉRIMÉ').forEach(l =>
    console.log(`  id:${String(l.id).padStart(3)} ${l.nom} — périmé ${l.datePerem}`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
