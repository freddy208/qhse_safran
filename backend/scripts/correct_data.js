/**
 * Script de correction complète des données QHSE Safran
 * Basé sur l'analyse comparative Excel ↔ DB (sept. 2026)
 *
 * Usage : node scripts/correct_data.js
 * (depuis /home/freddy/qhse_safran/backend, avec .env chargé)
 */
// Charger DATABASE_URL depuis le .env racine si non défini
if (!process.env.DATABASE_URL) {
  const fs = require('fs');
  const envPath = require('path').resolve(__dirname, '../../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const log = (msg) => console.log('[CORRECT]', msg);
const d = (s) => new Date(s);

// Met à jour le premier produit dont le nom contient `nomFragment` dans l'armoire donnée
async function updateByName(armoireId, nomFragment, data) {
  const p = await prisma.produit.findFirst({
    where: { armoireId, nom: { contains: nomFragment, mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  if (!p) { log(`⚠ Produit "${nomFragment}" introuvable dans armoire ${armoireId} (ignoré)`); return null; }
  await prisma.produit.update({ where: { id: p.id }, data });
  return p.id;
}

async function main() {
  log('=== Démarrage des corrections ===\n');

  // ── 0. Références ─────────────────────────────────────────────────────────
  const projet = await prisma.projet.findFirst({ orderBy: { id: 'asc' } });
  if (!projet) throw new Error('Aucun projet trouvé en DB');
  log(`Projet : ${projet.nom} (id=${projet.id})`);

  const zones = await prisma.zone.findMany({
    where: { projetId: projet.id },
    include: { armoires: true },
  });

  const armoire = (fragment) => {
    for (const z of zones)
      for (const a of z.armoires)
        if (a.nom.toLowerCase().includes(fragment.toLowerCase())) return a;
    return null;
  };

  const aB9C9 = armoire('B9');
  const aC8   = armoire('C8');
  const aC10  = armoire('C10');
  const aE9   = armoire('E9');
  const aE11  = armoire('E11');
  const aE12  = armoire('E12');   // sera "E12-E13 (DMG)" ou "E11-E12" selon ordre — on précise plus bas
  const aF11s = armoire('F11 ');  // "F11 ( SOUDAGE 1)" — espace intentionnel
  const aF11f = armoire('F11-F12');
  const aF12  = armoire('F12-F13');
  const aH11  = armoire('H11');

  // Helper : trouver l'armoire DMG vs MACHINE A LAVER
  const aE12dmg  = zones.flatMap(z => z.armoires).find(a => a.nom.toLowerCase().includes('dmg'));
  const aE12mav  = zones.flatMap(z => z.armoires).find(a => a.nom.toLowerCase().includes('machine'));

  // ─────────────────────────────────────────────────────────────────────────
  // 1. CORRECTIONS DE QUANTITÉS
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 1. Corrections quantités ---');

  // id:28 PROPANOL 5l (E11-E12) : quantiteUtilisee=90355011452 (code dans mauvais champ), volumeMax=81
  if (aE12mav) {
    const id = await updateByName(aE12mav.id, 'PROPANOL', { quantiteUtilisee: 1, volumeMax: '10 l' });
    if (id) log(`id:${id} PROPANOL 5l (E11-E12) → quantiteUtilisee=1, volumeMax="10 l"`);
  }

  // DIACLEAN (B9-C9) : quantitePresente=null, quantiteUtilisee=null
  if (aB9C9) {
    const id = await updateByName(aB9C9.id, 'DIACLEAN', { quantitePresente: 3, quantiteUtilisee: 1 });
    if (id) log(`id:${id} DIACLEAN (B9-C9) → quantitePresente=3, quantiteUtilisee=1`);
  }

  // ISOPROPANE (C8) : quantiteUtilisee=null
  if (aC8) {
    const id = await updateByName(aC8.id, 'ISOPROPANE', { quantiteUtilisee: 1 });
    if (id) log(`id:${id} ISOPROPANE (C8) → quantiteUtilisee=1`);
  }

  // KIT PLYOLEFINE 770 : quantiteUtilisee=0
  if (aB9C9) {
    const p770 = await prisma.produit.findFirst({
      where: { armoireId: aB9C9.id, nom: { contains: '770', mode: 'insensitive' } },
    });
    if (p770) { await prisma.produit.update({ where: { id: p770.id }, data: { quantiteUtilisee: 1 } }); log(`id:${p770.id} KIT PLYOLEFINE 770 → quantiteUtilisee=1`); }
    const p406 = await prisma.produit.findFirst({
      where: { armoireId: aB9C9.id, nom: { contains: '406', mode: 'insensitive' } },
    });
    if (p406) { await prisma.produit.update({ where: { id: p406.id }, data: { quantiteUtilisee: 1 } }); log(`id:${p406.id} KIT PLYOLEFINE 406 → quantiteUtilisee=1`); }
  }

  // GRINDING LIQUID E9 : quantiteUtilisee=0
  if (aE9) {
    const id = await updateByName(aE9.id, 'GRINDING', { quantiteUtilisee: 1 });
    if (id) log(`id:${id} GRINDING LIQUID E9 → quantiteUtilisee=1`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CORRECTIONS DE DATES (décalées de -3 à -4 ans à l'import)
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 2. Corrections dates péremption ---');

  const dateCorr = [
    { arm: aB9C9,   nom: 'ACETONE 5l',       date: '2030-07-30', note: 'B9-C9' },
    { arm: aC10,    nom: 'SRB 2000',          date: '2029-07-31', note: 'C10' },
    { arm: aE12dmg, nom: 'PROPANOL',          date: '2029-09-21', note: 'E12-E13 (DMG)' },
    { arm: aH11,    nom: 'ARDROX NQ1',        date: '2030-06-01', note: 'H11' },
    { arm: aF11s,   nom: 'ARDROX 9PR5',       date: '2030-02-28', note: 'F11 Soudage' },
    { arm: aF11s,   nom: 'ACETONE',           date: '2026-10-21', note: 'F11 Soudage' },
    { arm: aF12,    nom: 'DIACLEAN',          date: '2029-12-31', note: 'F12-F13' },
    { arm: aF12,    nom: 'LINGETTE',          date: '2027-10-31', note: 'F12-F13' },
  ];

  for (const c of dateCorr) {
    if (!c.arm) { log(`⚠ Armoire introuvable pour "${c.nom}" (${c.note})`); continue; }
    const id = await updateByName(c.arm.id, c.nom, { datePeremption: d(c.date) });
    if (id) log(`id:${id} "${c.nom}" (${c.note}) → datePeremption=${c.date}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. STATUT FDS + URLs + RESPONSABLES
  //    Lookup par nom dans chaque armoire — sûr même si les IDs diffèrent
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 3. statutFds / urlFds / responsable ---');

  const FDS_URL = {
    ACETONE:        'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/204296.pdf',
    LINGETTE_IPA:   'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/204294.pdf',
    DC1200:         'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/210798.pdf',
    ARDROX_NQ1:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/211968.pdf',
    SHERWIN:        'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/214358.pdf',
    WD40:           'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/200720.pdf',
    LOCTITE243:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/303027.pdf',
    LOCTITE277:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/303036.pdf',
    LOCTITE770:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/230259.pdf',
    LOCTITE406:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/303067.pdf',
    DIACLEAN:       'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/358378.pdf',
    NEUTRALYTE:     'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/300447.pdf',
    SRB2000:        'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/304956.pdf',
    HYDRAULIC_E12:  'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/302552.pdf',
    ENERPAC_H11:    'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/212437.pdf',
    DISCOTON:       'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/327104.pdf',
    NYCO:           'https://safran.my.quickfds.com/site/data/MPSAFRAN-FR_FR/384087.pdf',
  };

  // [ armoire, nomFragment, { statutFds, urlFds?, responsable? } ]
  const fdsMaj = [
    // B9-C9
    [aB9C9, 'ACETONE 5l',         { statutFds: 'A_JOUR',    urlFds: FDS_URL.ACETONE }],
    [aB9C9, 'DOW CORNING 1200',   { statutFds: 'A_JOUR',    urlFds: FDS_URL.DC1200 }],
    [aB9C9, '770',                { statutFds: 'A_JOUR',    urlFds: FDS_URL.LOCTITE770 }],
    [aB9C9, '406',                { statutFds: 'A_JOUR',    urlFds: FDS_URL.LOCTITE406 }],
    [aB9C9, 'DIACLEAN',          { statutFds: 'A_JOUR',    urlFds: FDS_URL.DIACLEAN }],
    [aB9C9, 'ACETONE 4 K',       { statutFds: 'A_JOUR',    urlFds: FDS_URL.ACETONE }],
    [aB9C9, 'TEEPOL',            { statutFds: 'OBSOLETE' }],
    // C8
    [aC8,   'ACETONE',           { statutFds: 'A_JOUR',    urlFds: FDS_URL.ACETONE }],
    [aC8,   'ISOPROPANE',        { statutFds: 'OBSOLETE' }],
    [aC8,   'DIACLEAN',          { statutFds: 'A_JOUR',    urlFds: FDS_URL.DIACLEAN }],
    // C10
    [aC10,  'WD40',              { statutFds: 'A_JOUR',    urlFds: FDS_URL.WD40 }],
    [aC10,  'ARALDITE',          { statutFds: 'OBSOLETE' }],
    [aC10,  'VASELINE 20',       { statutFds: 'MANQUANTE' }],
    [aC10,  'OIL TYPE BV',       { statutFds: 'MANQUANTE' }],
    [aC10,  'PEINTURE ROUGE FLUO',{ statutFds: 'MANQUANTE' }],
    [aC10,  'LOCTITE 243',       { statutFds: 'A_JOUR',    urlFds: FDS_URL.LOCTITE243 }],
    [aC10,  'D-321',             { statutFds: 'OBSOLETE' }],
    [aC10,  'LOCTITE 277',       { statutFds: 'A_JOUR',    urlFds: FDS_URL.LOCTITE277 }],
    [aC10,  'GRAISSE BELLEVILLE',{ statutFds: 'MANQUANTE' }],
    [aC10,  'PEINTURE NOIR',     { statutFds: 'OBSOLETE' }],
    [aC10,  'PEINTURE ROUGE ',   { statutFds: 'OBSOLETE' }],  // espace pour éviter FLUO
    [aC10,  'AIRSEC',            { statutFds: 'OBSOLETE' }],
    [aC10,  'ELIX CLEAN',        { statutFds: 'MANQUANTE' }],
    [aC10,  'SOCOMORE',          { statutFds: 'OBSOLETE' }],
    [aC10,  'EXTILUB',           { statutFds: 'OBSOLETE' }],
    [aC10,  'SRB 2000',          { statutFds: 'A_JOUR',    urlFds: FDS_URL.SRB2000 }],
    [aC10,  'SUDINE',            { statutFds: 'MANQUANTE' }],
    [aC10,  'KF ',               { statutFds: 'MANQUANTE' }],
    [aC10,  'ENCRE VERTE',       { statutFds: 'MANQUANTE' }],
    [aC10,  'TEEPOL',            { statutFds: 'OBSOLETE' }],
    // E9
    [aE9,   'NEUTRALYTE',        { statutFds: 'A_JOUR',    urlFds: FDS_URL.NEUTRALYTE }],
    [aE9,   'MAVOM',             { statutFds: 'OBSOLETE' }],
    [aE9,   'ETHANOL ABSOLUTE',  { statutFds: 'OBSOLETE' }],
    [aE9,   'ACETONE 4K CNN ',   { statutFds: 'A_JOUR',    urlFds: FDS_URL.ACETONE }],  // premier
    [aE9,   'GRINDING',          { statutFds: 'OBSOLETE' }],
    [aE9,   'SHERWIN',           { statutFds: 'A_JOUR',    urlFds: FDS_URL.SHERWIN }],
    // E11-E12 (MACHINE A LAVER)
    [aE12mav, 'ETHANOL ABSOLUTE', { statutFds: 'OBSOLETE', responsable: 'P. LE BOURHIS' }],
    [aE12mav, 'PROPANOL',         { statutFds: 'OBSOLETE', responsable: 'P. LE BOURHIS' }],
    [aE12mav, 'BONDERITE',        { statutFds: 'OBSOLETE', responsable: 'P. LE BOURHIS' }],
    // E12-E13 (DMG)
    [aE12dmg, 'PROPANOL',         { statutFds: 'OBSOLETE', responsable: 'F.BROCHE' }],
    [aE12dmg, 'Eau purifiée',     { statutFds: 'OBSOLETE', responsable: 'F.BROCHE' }],
    [aE12dmg, 'ETHANOL',          { statutFds: 'OBSOLETE', responsable: 'F.BROCHE' }],
    [aE12dmg, 'ACETONE',          { statutFds: 'A_JOUR',   urlFds: FDS_URL.ACETONE, responsable: 'F.BROCHE' }],
    [aE12dmg, 'HYDRAULIC OIL',    { statutFds: 'A_JOUR',   urlFds: FDS_URL.HYDRAULIC_E12, responsable: 'F.BROCHE' }],
    // F11 (SOUDAGE 1)
    [aF11s,  'GRINDING',          { statutFds: 'OBSOLETE' }],
    [aF11s,  'ARDROX 9PR5',       { statutFds: 'OBSOLETE' }],
    [aF11s,  'ARDROX NQ1',        { statutFds: 'A_JOUR',   urlFds: FDS_URL.ARDROX_NQ1 }],
    [aF11s,  'ALCOOL ISOPROPYLIQUE',{ statutFds: 'OBSOLETE' }],
    [aF11s,  '2-PROPANOL',        { statutFds: 'OBSOLETE' }],
    [aF11s,  'ACETONE',           { statutFds: 'A_JOUR',   urlFds: FDS_URL.ACETONE }],
    // F11-F12 (INSPECTION)
    [aF11f, 'ALCOOL ISOPROPYLIQUE',{ statutFds: 'OBSOLETE', responsable: 'L.GAKOVIC' }],
    [aF11f, 'ENCRE VERTE',         { statutFds: 'MANQUANTE',responsable: 'L.GAKOVIC' }],
    [aF11f, 'ACETONE',             { statutFds: 'A_JOUR',   urlFds: FDS_URL.ACETONE, responsable: 'L.GAKOVIC' }],
    // F12-F13 (AJUSTAGE)
    [aF12,  'LINGETTE',            { statutFds: 'A_JOUR',   urlFds: FDS_URL.LINGETTE_IPA, responsable: 'P.LE BOURHIS' }],
    [aF12,  'DISCOTON',            { statutFds: 'A_JOUR',   urlFds: FDS_URL.DISCOTON, responsable: 'P.LE BOURHIS' }],
    [aF12,  'DOWSIL',              { statutFds: 'A_JOUR',   urlFds: FDS_URL.DC1200, responsable: 'P.LE BOURHIS' }],
    [aF12,  'DIACLEAN',            { statutFds: 'A_JOUR',   urlFds: FDS_URL.DIACLEAN, responsable: 'P.LE BOURHIS' }],
    [aF12,  'NYCO GREASE',         { statutFds: 'A_JOUR',   urlFds: FDS_URL.NYCO, responsable: 'P.LE BOURHIS' }],
    [aF12,  'MAVOM',               { statutFds: 'OBSOLETE', responsable: 'P.LE BOURHIS' }],
    [aF12,  'ETHANOL ABSOLUTE',    { statutFds: 'OBSOLETE', responsable: 'P.LE BOURHIS' }],
    [aF12,  'ALCOOL ISOPROPYLIQUE',{ statutFds: 'OBSOLETE', responsable: 'P.LE BOURHIS' }],
    // H11 (CHAUDRONNERIE)
    [aH11,  'ARDROX NQ1',          { statutFds: 'A_JOUR',   urlFds: FDS_URL.ARDROX_NQ1, responsable: 'Thierry WERQUIN' }],
    [aH11,  '9 PR5',               { statutFds: 'OBSOLETE', responsable: 'Thierry WERQUIN' }],
    [aH11,  'ALCOOL ISOPROPYIQUE', { statutFds: 'OBSOLETE', responsable: 'Thierry WERQUIN' }],
    [aH11,  'ACETONE',             { statutFds: 'A_JOUR',   urlFds: FDS_URL.ACETONE, responsable: 'Thierry WERQUIN' }],
    [aH11,  'DIACLEAN',            { statutFds: 'MANQUANTE',responsable: 'Thierry WERQUIN' }],
    [aH11,  'ENERPAC',             { statutFds: 'A_JOUR',   urlFds: FDS_URL.ENERPAC_H11, responsable: 'Thierry WERQUIN' }],
    [aH11,  'EAU PURIFIEE',        { statutFds: 'MANQUANTE',responsable: 'Thierry WERQUIN' }],
    [aH11,  'GEL SANIMAIN',        { statutFds: 'MANQUANTE',responsable: 'Thierry WERQUIN' }],
    [aH11,  'GRINDING',            { statutFds: 'OBSOLETE', responsable: 'Thierry WERQUIN' }],
  ];

  // Pour F12-F13 : ACETONE 4K CNN vient avant ACETONE (plain), updateByName prend le premier
  // On les traite dans l'ordre : d'abord "4K CNN" puis "ACETONE" seul
  const f12Acetones = [
    { nom: 'ACETONE 4K CNN', data: { statutFds: 'A_JOUR', urlFds: FDS_URL.ACETONE, responsable: 'P.LE BOURHIS' } },
    { nom: 'ACETONE',        data: { statutFds: 'A_JOUR', urlFds: FDS_URL.ACETONE, responsable: 'P.LE BOURHIS' } },
  ];
  if (aF12) {
    for (const item of f12Acetones) {
      const p = await prisma.produit.findFirst({
        where: { armoireId: aF12.id, nom: { contains: item.nom, mode: 'insensitive' } },
        orderBy: { id: 'asc' },
      });
      if (p) { await prisma.produit.update({ where: { id: p.id }, data: item.data }); log(`id:${p.id} "${p.nom}" (F12-F13) → statutFds=A_JOUR + URL + responsable`); }
    }
  }

  for (const [arm, nom, data] of fdsMaj) {
    if (!arm) { log(`⚠ Armoire null pour "${nom}" (ignoré)`); continue; }
    const id = await updateByName(arm.id, nom, data);
    if (id) log(`id:${id} "${nom}" (armoire ${arm.id}) → statutFds=${data.statutFds}${data.urlFds ? ' + URL' : ''}${data.responsable ? ' + resp' : ''}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. AJOUT DES 6 PRODUITS MANQUANTS
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 4. Ajout des 6 produits manquants ---');

  const manquants = [
    {
      arm: aB9C9,
      data: {
        nom: 'DOW CORNING RTV 730FS', codeProduit: '90358264240',
        quantitePresente: 15, quantiteUtilisee: 1,
        datePeremption: d('2026-10-22'), statutFds: 'OBSOLETE',
      },
    },
    {
      arm: aC10,
      data: {
        nom: 'GISS GRAISSE (500 ml)',
        quantitePresente: 1, quantiteUtilisee: 1, statutFds: 'MANQUANTE',
      },
    },
    {
      arm: aE9,
      data: {
        nom: 'HUILE VASELINE PURE', codeProduit: 'Ref 20-48',
        quantitePresente: 1, quantiteUtilisee: 1, statutFds: 'MANQUANTE',
      },
    },
    {
      arm: aE9,
      data: {
        nom: 'BA 315 DURE', codeProduit: '9035123331',
        quantitePresente: 1, quantiteUtilisee: 1, statutFds: 'MANQUANTE',
      },
    },
    {
      arm: aE9,
      data: {
        nom: 'ARDROX NQ1', codeProduit: '90357267651',
        quantitePresente: 4, quantiteUtilisee: 1,
        datePeremption: d('2027-04-30'),
        urlFds: FDS_URL.ARDROX_NQ1, statutFds: 'A_JOUR',
      },
    },
    {
      arm: aE9,
      data: {
        nom: 'ETHANOL ABSOLUTE SALE', codeProduit: '90355011443',
        quantitePresente: 9, quantiteUtilisee: 2, statutFds: 'OBSOLETE',
      },
    },
  ];

  for (const m of manquants) {
    if (!m.arm) { log(`⚠ Armoire introuvable pour "${m.data.nom}" (ignoré)`); continue; }
    // Vérifier qu'il n'existe pas déjà
    const existe = await prisma.produit.findFirst({
      where: { armoireId: m.arm.id, nom: { contains: m.data.nom.split(' ').slice(0, 2).join(' '), mode: 'insensitive' } },
    });
    if (existe) { log(`Produit "${m.data.nom}" déjà présent id:${existe.id} (ignoré)`); continue; }
    const p = await prisma.produit.create({ data: { armoireId: m.arm.id, ...m.data } });
    log(`+ Créé id:${p.id} "${p.nom}" → armoire ${m.arm.nom} (${p.statutFds})`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. EXIGENCE MANQUANTE : Substitution / Flux H25
  // ─────────────────────────────────────────────────────────────────────────
  log('\n--- 5. Exigence Substitution/Flux H25 ---');

  const existeExig = await prisma.exigenceAudit.findFirst({
    where: { projetId: projet.id, domaine: 'Substitution' },
  });
  if (existeExig) {
    log(`Exigence Substitution déjà présente id:${existeExig.id} (ignoré)`);
  } else {
    const ex = await prisma.exigenceAudit.create({ data: {
      projetId: projet.id,
      domaine: 'Substitution',
      exigence: 'Flux H25 — Substitution de produits chimiques dangereux',
    }});
    log(`+ Exigence id:${ex.id} Substitution/Flux H25 créée`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PLAN D'ACTION : 9 actions manquantes
  // ─────────────────────────────────────────────────────────────────────────
  log("\n--- 6. Plan d'action — 9 actions ---");

  const now = new Date();
  const echeance = (mois) => mois
    ? new Date(now.getFullYear(), now.getMonth() + mois, now.getDate())
    : null;

  const actions = [
    { libelle: 'Réaliser une sensibilisation terrain sur les risques chimiques',          responsable: 'HSE',                                   mois: 1 },
    { libelle: 'Mettre en place des affichages visuels et des exercices CLP',             responsable: 'HSE',                                   mois: 1 },
    { libelle: 'Organiser des ateliers pratiques sur les incompatibilités chimiques',      responsable: 'HSE / Chef de ligne',                   mois: 2 },
    { libelle: 'Créer un processus de communication avant mise en service',                responsable: 'HSE / Chef de ligne / AM / Opérateurs', mois: 2 },
    { libelle: 'Mettre en place un recyclage annuel obligatoire',                          responsable: 'HSE',                                   mois: 3 },
    { libelle: 'Afficher les contacts et référents HSE',                                   responsable: 'Chef de ligne',                         mois: 1 },
    { libelle: 'Intégrer un sujet lié aux produits chimiques aux briefs sécurité',        responsable: 'HSE / AM / Chef de ligne',               mois: null },
    { libelle: 'Réaliser des audits flash de stockage',                                    responsable: 'Opérateurs / AM / Chef de ligne / HSE', mois: null },
    { libelle: "Contrôler l'application des consignes EPI",                               responsable: 'Chef de ligne / AM / HSE',              mois: null },
  ];

  for (const a of actions) {
    const existe = await prisma.actionCorrective.findFirst({
      where: { projetId: projet.id, libelle: a.libelle },
    });
    if (existe) { log(`Action déjà présente id:${existe.id} (ignoré)`); continue; }
    const ac = await prisma.actionCorrective.create({ data: {
      projetId: projet.id,
      libelle: a.libelle,
      ponderation: 1,
      statut: 'NON_DEMARRE',
      responsable: a.responsable,
      echeance: echeance(a.mois),
      estGenerique: true,
    }});
    log(`+ Action id:${ac.id} "${a.libelle.slice(0, 60)}"`);
  }

  log('\n=== Corrections terminées avec succès ===');
}

main()
  .catch((e) => { console.error('[ERREUR]', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
