import { PrismaClient, StatutAction, ResultatEnum } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Démarrage du seed complet avec données réelles…');

  // ── Utilisateur admin ────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Safran2024!', 12);
  await prisma.utilisateur.upsert({
    where: { email: 'qhse.test.2024@safran.fr' },
    update: { role: 'admin', motDePasseHash: hash },
    create: { nom: 'Admin QHSE', email: 'qhse.test.2024@safran.fr', motDePasseHash: hash, role: 'admin' },
  });

  // ── Projet 1 : Produits Chimiques ────────────────────────────────────────
  const projChimiques = await prisma.projet.upsert({
    where: { nom: 'Gestion des Produits Chimiques ICLB/ICLK' },
    update: { description: 'Suivi QHSE des produits chimiques – 7 axes (Safran HSE PRO0239) – Avancement cible : 100%' },
    create: { nom: 'Gestion des Produits Chimiques ICLB/ICLK', description: 'Suivi QHSE des produits chimiques – 7 axes (Safran HSE PRO0239) – Avancement cible : 100%' },
  });

  // ── 7 axes Produits Chimiques avec statuts réels ──────────────────────────
  // D'après le document KPI : avancement 61% global
  // Inventaire 80%, FDS 75%, Expirés 60%, Armoires 65%, Stockage 70%, Formation 45%, Culture SSE 17%, Actions 0%
  const axesChimiques = [
    {
      code: 'AXE1', intitule: 'Gestion de l\'inventaire des produits chimiques', ponderation: 15,
      sousActions: [
        { libelle: 'Réaliser l\'inventaire ICLB (zones B9-C9, C8, C10, E9, Inspection)', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-03-31T00:00:00.000Z' },
        { libelle: 'Réaliser l\'inventaire ICLK (zones E11-E14, F11-F14, H11)', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-03-31T00:00:00.000Z' },
        { libelle: 'Identifier et coder tous les produits (code Safran)', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-15T00:00:00.000Z' },
        { libelle: 'Vérifier les quantités et volumes maximum', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Désigner les responsables de suivi par armoire', ponderationDansAxe: 20, statut: 'EN_COURS' as StatutAction, responsable: 'HSE', echeance: '2026-06-30T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE2', intitule: 'Gestion documentaire des FDS', ponderation: 20,
      sousActions: [
        { libelle: 'Recenser les FDS manquantes (10% sans code)', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-03-31T00:00:00.000Z' },
        { libelle: 'Télécharger les FDS absentes', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Vérifier et renouveler les FDS > 3 ans', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-05-31T00:00:00.000Z' },
        { libelle: 'Associer chaque produit à son URL FDS', ponderationDansAxe: 20, statut: 'EN_COURS' as StatutAction, responsable: 'HSE', echeance: '2026-06-30T00:00:00.000Z' },
        { libelle: 'Mettre à jour la base documentaire dans l\'application', ponderationDansAxe: 20, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE3', intitule: 'Gestion des produits expirés', ponderation: 10,
      sousActions: [
        { libelle: 'Identifier les produits expirés (24,3% du stock)', ponderationDansAxe: 25, statut: 'REALISE' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-03-31T00:00:00.000Z' },
        { libelle: 'Mettre en quarantaine les produits périmés', ponderationDansAxe: 25, statut: 'EN_COURS' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-05-31T00:00:00.000Z' },
        { libelle: 'Organiser l\'élimination réglementaire (DASRI)', ponderationDansAxe: 25, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Mettre à jour l\'inventaire après élimination', ponderationDansAxe: 25, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-08-31T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE4', intitule: 'Conformité des armoires chimiques (EN 14470-1)', ponderation: 20,
      sousActions: [
        { libelle: 'Audit EN 14470-1 – 10 armoires (ICLB + ICLK)', ponderationDansAxe: 15, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Corriger le marquage EN 14470-1 (NC sur toutes armoires)', ponderationDansAxe: 15, statut: 'EN_COURS' as StatutAction, responsable: 'AM/Opérateurs', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Installer la fermeture automatique (NC sur toutes armoires)', ponderationDansAxe: 15, statut: 'EN_COURS' as StatutAction, responsable: 'AM/Opérateurs', echeance: '2026-09-30T00:00:00.000Z' },
        { libelle: 'Vérifier la ventilation des armoires', ponderationDansAxe: 15, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-05-31T00:00:00.000Z' },
        { libelle: 'Vérifier et compléter les bacs de rétention', ponderationDansAxe: 10, statut: 'EN_COURS' as StatutAction, responsable: 'AM/Opérateurs', echeance: '2026-06-30T00:00:00.000Z' },
        { libelle: 'Vérifier les pictogrammes de danger', ponderationDansAxe: 10, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Vérifier le rangement et la propreté', ponderationDansAxe: 10, statut: 'NON_DEMARRE' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-08-31T00:00:00.000Z' },
        { libelle: 'Vérifier la compatibilité chimique dans chaque armoire', ponderationDansAxe: 10, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE5', intitule: 'Maîtrise du stockage chimique', ponderation: 10,
      sousActions: [
        { libelle: 'Vérifier les incompatibilités chimiques entre produits stockés', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Vérifier les volumes stockés vs capacité max', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-05-31T00:00:00.000Z' },
        { libelle: 'Contrôler l\'état des contenants', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'Chef de ligne', echeance: '2026-05-31T00:00:00.000Z' },
        { libelle: 'Contrôler l\'étiquetage CLP sur tous les contenants', ponderationDansAxe: 20, statut: 'EN_COURS' as StatutAction, responsable: 'AM/Opérateurs', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Retirer les bidons vides des armoires', ponderationDansAxe: 20, statut: 'NON_DEMARRE' as StatutAction, responsable: 'AM/Opérateurs', echeance: '2026-08-31T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE6', intitule: 'Formation et sensibilisation', ponderation: 10,
      sousActions: [
        { libelle: 'Identifier le personnel exposé aux produits chimiques', ponderationDansAxe: 20, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Former les chefs de ligne (risques chimiques)', ponderationDansAxe: 20, statut: 'EN_COURS' as StatutAction, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Former les opérateurs exposés', ponderationDansAxe: 20, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-08-31T00:00:00.000Z' },
        { libelle: 'Former les intérimaires (accueil sécurité)', ponderationDansAxe: 20, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z' },
        { libelle: 'Réaliser des animations SSE sur les risques chimiques', ponderationDansAxe: 20, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z' },
      ],
    },
    {
      code: 'AXE7', intitule: 'Analyse terrain et culture SSE', ponderation: 5,
      sousActions: [
        { libelle: 'Préparer le questionnaire enquête gestion produits chimiques', ponderationDansAxe: 25, statut: 'REALISE' as StatutAction, responsable: 'HSE', echeance: '2026-04-30T00:00:00.000Z' },
        { libelle: 'Réaliser les entretiens terrain (23 répondants ICLB)', ponderationDansAxe: 25, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z' },
        { libelle: 'Analyser les résultats de l\'enquête', ponderationDansAxe: 25, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-08-31T00:00:00.000Z' },
        { libelle: 'Définir et planifier les actions d\'amélioration culture SSE', ponderationDansAxe: 25, statut: 'NON_DEMARRE' as StatutAction, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z' },
      ],
    },
  ];

  for (const axeData of axesChimiques) {
    const { sousActions, ...axeFields } = axeData;
    let axe = await prisma.axe.findFirst({ where: { projetId: projChimiques.id, code: axeFields.code } });
    if (!axe) axe = await prisma.axe.create({ data: { ...axeFields, projetId: projChimiques.id } });
    for (const sa of sousActions) {
      const exists = await prisma.sousAction.findFirst({ where: { axeId: axe.id, libelle: sa.libelle } });
      if (!exists) {
        await prisma.sousAction.create({
          data: {
            axeId: axe.id,
            libelle: sa.libelle,
            ponderationDansAxe: sa.ponderationDansAxe,
            statut: sa.statut,
            responsable: sa.responsable ?? null,
            echeance: sa.echeance ? new Date(sa.echeance) : null,
          },
        });
      }
    }
  }

  // ── Actions correctives – Plan d'action enquête (9 items) ────────────────
  const actionsCorr = [
    // Priorité 1
    { libelle: 'P1-1 : Mettre à jour l\'inventaire des produits et le diffuser aux chefs de ligne', ponderation: 11, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z', statut: 'EN_COURS' as StatutAction },
    { libelle: 'P1-2 : Afficher la liste des produits autorisés dans chaque armoire', ponderation: 11, responsable: 'Chef de ligne', echeance: '2026-07-31T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    { libelle: 'P1-3 : Former les opérateurs à la lecture des FDS', ponderation: 11, responsable: 'HSE', echeance: '2026-08-31T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    { libelle: 'P1-4 : Mettre en place un système de suivi des dates de péremption', ponderation: 11, responsable: 'HSE', echeance: '2026-07-31T00:00:00.000Z', statut: 'EN_COURS' as StatutAction },
    { libelle: 'P1-5 : Organiser une journée sensibilisation risques chimiques', ponderation: 11, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    // Priorité 2
    { libelle: 'P2-1 : Installer des pictogrammes de danger sur toutes les armoires', ponderation: 11, responsable: 'AM/Opérateurs', echeance: '2026-08-31T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    { libelle: 'P2-2 : Créer des procédures de gestion des déversements accidentels', ponderation: 11, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    // Priorité 3
    { libelle: 'P3-1 : Évaluer les besoins EPI pour chaque poste exposé', ponderation: 11, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
    { libelle: 'P3-2 : Mettre en place une communication mensuelle QHSE chimiques', ponderation: 12, responsable: 'HSE', echeance: '2026-09-30T00:00:00.000Z', statut: 'NON_DEMARRE' as StatutAction },
  ];

  for (const ac of actionsCorr) {
    const exists = await prisma.actionCorrective.findFirst({
      where: { projetId: projChimiques.id, libelle: ac.libelle },
    });
    if (!exists) {
      await prisma.actionCorrective.create({
        data: {
          projetId: projChimiques.id,
          libelle: ac.libelle,
          ponderation: ac.ponderation,
          statut: ac.statut,
          responsable: ac.responsable,
          echeance: ac.echeance ? new Date(ac.echeance) : null,
          estGenerique: false,
        },
      });
    }
  }

  // ── Projet 2 : Flux H25 ──────────────────────────────────────────────────
  const projH25 = await prisma.projet.upsert({
    where: { nom: 'Substitution Flux de brasage H25' },
    update: { description: 'Projet de substitution du flux de brasage H25 par un produit moins dangereux – 9 axes – YQLL/HSE' },
    create: { nom: 'Substitution Flux de brasage H25', description: 'Projet de substitution du flux de brasage H25 par un produit moins dangereux – 9 axes – YQLL/HSE' },
  });

  const axesH25 = [
    {
      code: 'PIL', intitule: 'Pilotage du projet', ponderation: 10,
      sousActions: [
        { libelle: 'Désigner le pilote projet et le groupe de travail', ponderationDansAxe: 25 },
        { libelle: 'Organiser le lancement projet (kick-off)', ponderationDansAxe: 25 },
        { libelle: 'Définir les rôles et responsabilités des acteurs', ponderationDansAxe: 25 },
        { libelle: 'Valider le planning prévisionnel de substitution', ponderationDansAxe: 25 },
      ],
    },
    {
      code: 'ANA', intitule: 'Analyse du procédé de brasage', ponderation: 10,
      sousActions: [
        { libelle: 'Identifier les étapes d\'utilisation du Flux H25 en production', ponderationDansAxe: 25 },
        { libelle: 'Identifier les contraintes techniques du procédé', ponderationDansAxe: 25 },
        { libelle: 'Caractériser les émissions de fumées et COV', ponderationDansAxe: 25 },
        { libelle: 'Formaliser les risques SSE associés au Flux H25', ponderationDansAxe: 25 },
      ],
    },
    {
      code: 'REC', intitule: 'Recherche des produits candidats', ponderation: 15,
      sousActions: [
        { libelle: 'Rechercher des solutions de substitution existantes sur le marché', ponderationDansAxe: 20 },
        { libelle: 'Étudier le retour d\'expérience du site Inde (substitution réussie)', ponderationDansAxe: 20 },
        { libelle: 'Identifier et lister les flux candidats potentiels', ponderationDansAxe: 20 },
        { libelle: 'Vérifier la compatibilité technique des candidats', ponderationDansAxe: 20 },
        { libelle: 'Valider la présélection des candidats retenus', ponderationDansAxe: 20 },
      ],
    },
    {
      code: 'ETU', intitule: 'Étude documentaire des candidats', ponderation: 15,
      sousActions: [
        { libelle: 'Collecter les FDS de tous les candidats présélectionnés', ponderationDansAxe: 20 },
        { libelle: 'Identifier les substances actives et leur classification', ponderationDansAxe: 20 },
        { libelle: 'Analyser les dangers selon le règlement CLP', ponderationDansAxe: 20 },
        { libelle: 'Analyser les risques SSE des candidats', ponderationDansAxe: 20 },
        { libelle: 'Rédiger la synthèse documentaire comparative', ponderationDansAxe: 20 },
      ],
    },
    {
      code: 'DON', intitule: 'Données techniques pièces', ponderation: 10,
      sousActions: [
        { libelle: 'Identifier les pièces et sous-ensembles concernés par le brasage', ponderationDansAxe: 25 },
        { libelle: 'Récupérer les données techniques DMR35 applicables', ponderationDansAxe: 25 },
        { libelle: 'Identifier les matériaux et alliages à braser', ponderationDansAxe: 25 },
        { libelle: 'Consolider le dossier technique de référence', ponderationDansAxe: 25 },
      ],
    },
    {
      code: 'STO', intitule: 'Stockage du Flux H25', ponderation: 10,
      sousActions: [
        { libelle: 'Définir le besoin en stockage sécurisé', ponderationDansAxe: 20 },
        { libelle: 'Choisir l\'armoire de stockage adaptée (EN 14470-1)', ponderationDansAxe: 20 },
        { libelle: 'Installer et équiper l\'armoire de stockage', ponderationDansAxe: 30 },
        { libelle: 'Vérifier la conformité réglementaire du stockage', ponderationDansAxe: 30 },
      ],
    },
    {
      code: 'ESS', intitule: 'Essais d\'innocuité', ponderation: 10,
      sousActions: [
        { libelle: 'Identifier les interlocuteurs laboratoire YQLL', ponderationDansAxe: 20 },
        { libelle: 'Préparer le protocole d\'essais d\'innocuité', ponderationDansAxe: 20 },
        { libelle: 'Réaliser les essais d\'innocuité sur pièces de référence', ponderationDansAxe: 30 },
        { libelle: 'Analyser et valider les résultats d\'innocuité', ponderationDansAxe: 30 },
      ],
    },
    {
      code: 'VAL', intitule: 'Validation technique du substitut', ponderation: 15,
      sousActions: [
        { libelle: 'Réaliser les essais de brasage avec le candidat retenu', ponderationDansAxe: 25 },
        { libelle: 'Évaluer la qualité de brasage obtenue (contrôle visuel, DVI)', ponderationDansAxe: 25 },
        { libelle: 'Réaliser les essais DVI (Destruction Visual Inspection)', ponderationDansAxe: 25 },
        { libelle: 'Valider les performances du substitut et rédiger le rapport', ponderationDansAxe: 25 },
      ],
    },
    {
      code: 'LAB', intitule: 'Prestations laboratoire externe', ponderation: 5,
      sousActions: [
        { libelle: 'Solliciter et mandater le laboratoire partenaire', ponderationDansAxe: 25 },
        { libelle: 'Réaliser les analyses chimiques demandées', ponderationDansAxe: 25 },
        { libelle: 'Consolider et interpréter les résultats d\'analyse', ponderationDansAxe: 25 },
        { libelle: 'Valider le rapport final et clôturer le projet', ponderationDansAxe: 25 },
      ],
    },
  ];

  for (const axeData of axesH25) {
    const { sousActions, ...axeFields } = axeData;
    let axe = await prisma.axe.findFirst({ where: { projetId: projH25.id, code: axeFields.code } });
    if (!axe) axe = await prisma.axe.create({ data: { ...axeFields, projetId: projH25.id } });
    for (const sa of sousActions) {
      const exists = await prisma.sousAction.findFirst({ where: { axeId: axe.id, libelle: sa.libelle } });
      if (!exists) {
        await prisma.sousAction.create({ data: { ...sa, axeId: axe.id, statut: 'NON_DEMARRE' as StatutAction } });
      }
    }
  }

  // ── TypeChecklist : EN 14470-1 – 20 critères ─────────────────────────────
  const tcEN = await prisma.typeChecklist.upsert({
    where: { nom: 'Conformité EN 14470-1' },
    update: {},
    create: { nom: 'Conformité EN 14470-1' },
  });
  const criteresEN = [
    'Marquage EN 14470-1',
    'Type 30/60/90 minutes',
    'Pictogrammes de danger',
    'Capacité maximale affichée',
    'Absence de corrosion',
    'Absence de déformation',
    'Poignée fonctionnelle',
    'Serrure fonctionnelle',
    'Portes fermées hors utilisation',
    'Fermeture automatique',
    'Ventilation (naturelle ou forcée)',
    'Bac de rétention',
    'Produits identifiables (étiquettes)',
    'Étiquetage CLP conforme',
    'Date de péremption visible',
    'FDS disponible à proximité',
    'Compatibilité chimique respectée',
    'Propreté et rangement',
    'Produits expirés retirés',
    'Bidons vides retirés',
  ];
  const critereIds: Record<string, number> = {};
  for (let i = 0; i < criteresEN.length; i++) {
    let c = await prisma.critere.findFirst({ where: { typeChecklistId: tcEN.id, libelle: criteresEN[i] } });
    if (!c) c = await prisma.critere.create({ data: { typeChecklistId: tcEN.id, libelle: criteresEN[i], ordre: i + 1 } });
    critereIds[criteresEN[i]] = c.id;
  }

  // ── Exigences audit PRO0239 ──────────────────────────────────────────────
  const exigencesPRO0239 = [
    { domaine: 'Gouvernance', exigence: 'Inventaire produits chimiques', questionControle: 'L\'inventaire des produits chimiques est-il à jour et exhaustif ?', conformite: 'NON' as const },
    { domaine: 'Documentation', exigence: 'FDS disponibles et à jour', questionControle: 'Les FDS sont-elles disponibles et datant de moins de 3 ans pour chaque produit ?', conformite: 'NON' as const },
    { domaine: 'Évaluation des risques', exigence: 'Évaluation risques chimiques', questionControle: 'Une évaluation des risques chimiques a-t-elle été réalisée et mise à jour ?', conformite: null },
    { domaine: 'Prévention technique', exigence: 'Ventilation et captage à la source', questionControle: 'Les systèmes de ventilation et de captage sont-ils conformes et vérifiés ?', conformite: null },
    { domaine: 'EPI', exigence: 'EPI adaptés aux risques chimiques', questionControle: 'Les EPI adaptés aux produits manipulés sont-ils disponibles et utilisés ?', conformite: null },
    { domaine: 'Formation', exigence: 'Formation opérateurs aux risques chimiques', questionControle: 'Les opérateurs exposés ont-ils été formés aux risques chimiques et à la lecture des FDS ?', conformite: 'NON' as const },
    { domaine: 'Stockage', exigence: 'Conformité armoires EN 14470-1', questionControle: 'Les armoires de stockage sont-elles conformes à la norme EN 14470-1 ?', conformite: 'NON' as const },
    { domaine: 'Stockage', exigence: 'Étiquetage CLP sur contenants', questionControle: 'L\'étiquetage CLP est-il conforme et lisible sur tous les contenants ?', conformite: null },
    { domaine: 'Urgence', exigence: 'Procédure gestion des déversements', questionControle: 'Une procédure de gestion des déversements accidentels est-elle en place et connue ?', conformite: null },
    { domaine: 'Urgence', exigence: 'Équipements de premiers secours', questionControle: 'Les lave-œil et douches de sécurité sont-ils accessibles et en état de marche ?', conformite: null },
  ];

  for (const eq of exigencesPRO0239) {
    const exists = await prisma.exigenceAudit.findFirst({
      where: { projetId: projChimiques.id, domaine: eq.domaine, exigence: eq.exigence },
    });
    if (!exists) {
      await prisma.exigenceAudit.create({
        data: {
          projetId: projChimiques.id,
          domaine: eq.domaine,
          exigence: eq.exigence,
          questionControle: eq.questionControle,
          conformite: eq.conformite ?? null,
        },
      });
    }
  }

  // ── Zones + Armoires réelles ICLB ────────────────────────────────────────
  let zoneICLB = await prisma.zone.findFirst({ where: { projetId: projChimiques.id, nom: 'ICLB' } });
  if (!zoneICLB) zoneICLB = await prisma.zone.create({ data: { projetId: projChimiques.id, nom: 'ICLB' } });

  const armoiresICLB = [
    'B9-C9 RTV – ICLB',
    'C8 Soudage – ICLB',
    'C10 Maintenance Outillage – ICLB',
    'E9 Usinage – ICLB',
    'Inspection – ICLB',
  ];

  const armICLBMap: Record<string, number> = {};
  for (const nom of armoiresICLB) {
    let a = await prisma.armoire.findFirst({ where: { zoneId: zoneICLB.id, nom } });
    if (!a) a = await prisma.armoire.create({ data: { zoneId: zoneICLB.id, nom } });
    armICLBMap[nom] = a.id;
  }

  // ── Zones + Armoires réelles ICLK ────────────────────────────────────────
  let zoneICLK = await prisma.zone.findFirst({ where: { projetId: projChimiques.id, nom: 'ICLK' } });
  if (!zoneICLK) zoneICLK = await prisma.zone.create({ data: { projetId: projChimiques.id, nom: 'ICLK' } });

  const armoiresICLK = [
    'E11-E12 Machine à laver – ICLK',
    'E12-E13 DMG – ICLK',
    'F11 Soudage 1 – ICLK',
    'F11-F12 Inspection – ICLK',
    'F12-F13 Ajustage – ICLK',
    'H11 Chaudronnerie – ICLK',
    'F14 (zone libre) – ICLK',
  ];

  const armICLKMap: Record<string, number> = {};
  for (const nom of armoiresICLK) {
    let a = await prisma.armoire.findFirst({ where: { zoneId: zoneICLK.id, nom } });
    if (!a) a = await prisma.armoire.create({ data: { zoneId: zoneICLK.id, nom } });
    armICLKMap[nom] = a.id;
  }

  // ── Produits chimiques ICLB – Armoire B9-C9 RTV ─────────────────────────
  const armB9C9Id = armICLBMap['B9-C9 RTV – ICLB'];
  const produitsB9C9 = [
    { nom: 'RTV 106 Grey', codeProduit: '90355011130', quantitePresente: 3, volumeMax: 10, datePeremption: '2025-08-15T00:00:00.000Z' },
    { nom: 'RTV 118 Translucide', codeProduit: '90355011131', quantitePresente: 2, volumeMax: 8, datePeremption: '2026-03-20T00:00:00.000Z' },
    { nom: 'Loctite 243 Frein filet moyen', codeProduit: '90355032410', quantitePresente: 5, volumeMax: 20, datePeremption: '2026-11-30T00:00:00.000Z' },
    { nom: 'Loctite 270 Frein filet fort', codeProduit: '90355032411', quantitePresente: 3, volumeMax: 15, datePeremption: '2026-09-15T00:00:00.000Z' },
    { nom: 'Loctite 648 Blocage cylindrique', codeProduit: '90355032415', quantitePresente: 2, volumeMax: 10, datePeremption: '2027-01-10T00:00:00.000Z' },
    { nom: 'Loctite 638 Blocage arbre-moyeu', codeProduit: '90355032416', quantitePresente: 1, volumeMax: 5, datePeremption: '2025-12-31T00:00:00.000Z' },
    { nom: 'Silicone haute température rouge', codeProduit: '90355041020', quantitePresente: 4, volumeMax: 16, datePeremption: '2026-06-30T00:00:00.000Z' },
    { nom: 'Dégraissant IPA 70%', codeProduit: null, quantitePresente: 6, volumeMax: 24, datePeremption: '2026-12-31T00:00:00.000Z' },
  ];

  for (const p of produitsB9C9) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armB9C9Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armB9C9Id,
          nom: p.nom,
          codeProduit: p.codeProduit ?? null,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Produits chimiques ICLB – Armoire C8 Soudage ─────────────────────────
  const armC8Id = armICLBMap['C8 Soudage – ICLB'];
  const produitsC8 = [
    { nom: 'Flux de brasage H25', codeProduit: '90355021100', quantitePresente: 4, volumeMax: 20, datePeremption: '2026-08-31T00:00:00.000Z' },
    { nom: 'Crème à braser SAC305', codeProduit: '90355021102', quantitePresente: 2, volumeMax: 8, datePeremption: '2026-01-15T00:00:00.000Z' },
    { nom: 'Nettoyant flux résiduel', codeProduit: '90355021110', quantitePresente: 3, volumeMax: 12, datePeremption: '2026-07-31T00:00:00.000Z' },
    { nom: 'Acide fluorhydrique 10%', codeProduit: '90355021200', quantitePresente: 1, volumeMax: 4, datePeremption: '2025-11-30T00:00:00.000Z' },
    { nom: 'Alcool isopropylique 99%', codeProduit: '90355021201', quantitePresente: 5, volumeMax: 20, datePeremption: '2027-06-30T00:00:00.000Z' },
  ];

  for (const p of produitsC8) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armC8Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armC8Id,
          nom: p.nom,
          codeProduit: p.codeProduit,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Produits chimiques ICLB – Armoire C10 Maintenance ────────────────────
  const armC10Id = armICLBMap['C10 Maintenance Outillage – ICLB'];
  const produitsC10 = [
    { nom: 'WD-40 dégrippant', codeProduit: '90355050100', quantitePresente: 8, volumeMax: 24, datePeremption: '2028-01-01T00:00:00.000Z' },
    { nom: 'Huile de coupe COUPELF', codeProduit: '90355050101', quantitePresente: 4, volumeMax: 20, datePeremption: '2026-09-30T00:00:00.000Z' },
    { nom: 'Graisse MOLYKOTE', codeProduit: '90355050102', quantitePresente: 3, volumeMax: 12, datePeremption: '2027-03-31T00:00:00.000Z' },
    { nom: 'Nettoyant pièces métalliques', codeProduit: '90355050103', quantitePresente: 6, volumeMax: 24, datePeremption: '2026-04-30T00:00:00.000Z' },
    { nom: 'Vernis isolant Uréthane', codeProduit: null, quantitePresente: 2, volumeMax: 8, datePeremption: '2025-09-15T00:00:00.000Z' },
    { nom: 'Acétone technique', codeProduit: '90355050200', quantitePresente: 3, volumeMax: 12, datePeremption: '2026-12-31T00:00:00.000Z' },
  ];

  for (const p of produitsC10) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armC10Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armC10Id,
          nom: p.nom,
          codeProduit: p.codeProduit,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Produits chimiques ICLB – Armoire E9 Usinage ─────────────────────────
  const armE9Id = armICLBMap['E9 Usinage – ICLB'];
  const produitsE9 = [
    { nom: 'Lubrifiant d\'usinage BLASOCUT', codeProduit: '90355060100', quantitePresente: 10, volumeMax: 40, datePeremption: '2026-10-31T00:00:00.000Z' },
    { nom: 'Huile entière de coupe', codeProduit: '90355060101', quantitePresente: 5, volumeMax: 20, datePeremption: '2025-07-31T00:00:00.000Z' },
    { nom: 'Détergent alcalin concentré', codeProduit: '90355060102', quantitePresente: 3, volumeMax: 12, datePeremption: '2026-08-31T00:00:00.000Z' },
    { nom: 'Liquide de refroidissement machine', codeProduit: null, quantitePresente: 8, volumeMax: 32, datePeremption: '2026-03-31T00:00:00.000Z' },
  ];

  for (const p of produitsE9) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armE9Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armE9Id,
          nom: p.nom,
          codeProduit: p.codeProduit,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Produits ICLK – E11-E12 Machine à laver ──────────────────────────────
  const armE11Id = armICLKMap['E11-E12 Machine à laver – ICLK'];
  const produitsE11 = [
    { nom: 'Détergent alcalin sans phosphate', codeProduit: '90355070100', quantitePresente: 5, volumeMax: 20, datePeremption: '2026-09-30T00:00:00.000Z' },
    { nom: 'Inhibiteur de corrosion', codeProduit: '90355070101', quantitePresente: 2, volumeMax: 8, datePeremption: '2026-12-31T00:00:00.000Z' },
    { nom: 'Agent antitartre machine', codeProduit: '90355070102', quantitePresente: 3, volumeMax: 12, datePeremption: '2027-01-31T00:00:00.000Z' },
  ];

  for (const p of produitsE11) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armE11Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armE11Id,
          nom: p.nom,
          codeProduit: p.codeProduit,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Produits ICLK – F11 Soudage 1 ────────────────────────────────────────
  const armF11Id = armICLKMap['F11 Soudage 1 – ICLK'];
  const produitsF11 = [
    { nom: 'Flux de brasage H25 (lot ICLK)', codeProduit: '90355021100', quantitePresente: 3, volumeMax: 15, datePeremption: '2026-08-31T00:00:00.000Z' },
    { nom: 'Gel fluxant sans halogène', codeProduit: '90355021105', quantitePresente: 2, volumeMax: 8, datePeremption: '2025-10-31T00:00:00.000Z' },
    { nom: 'Nettoyant ultrasonique', codeProduit: '90355021115', quantitePresente: 4, volumeMax: 16, datePeremption: '2026-06-30T00:00:00.000Z' },
    { nom: 'Alcool éthylique 96% dénaturé', codeProduit: null, quantitePresente: 5, volumeMax: 20, datePeremption: '2026-12-31T00:00:00.000Z' },
  ];

  for (const p of produitsF11) {
    const exists = await prisma.produit.findFirst({ where: { armoireId: armF11Id, nom: p.nom } });
    if (!exists) {
      await prisma.produit.create({
        data: {
          armoireId: armF11Id,
          nom: p.nom,
          codeProduit: p.codeProduit,
          quantitePresente: p.quantitePresente,
          volumeMax: p.volumeMax,
          datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
        },
      });
    }
  }

  // ── Résultats audit EN 14470-1 – ICLB (NC = écart majeur, PC = mineur, C = conforme) ──
  // Toutes armoires NC sur : Marquage EN 14470-1 (#0) et Fermeture automatique (#9)
  type ArmMap = Record<string, number>;
  const auditICLB: { armNom: string; resultats: ResultatEnum[] }[] = [
    {
      armNom: 'B9-C9 RTV – ICLB',
      // NC NC C C C C C C C NC C C C PC C C C C C C
      resultats: ['ECART_MAJEUR','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'C8 Soudage – ICLB',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MINEUR','ECART_MINEUR','CONFORME','CONFORME','ECART_MINEUR','CONFORME'],
    },
    {
      armNom: 'C10 Maintenance Outillage – ICLB',
      resultats: ['ECART_MAJEUR','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MINEUR','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'E9 Usinage – ICLB',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MINEUR','CONFORME','CONFORME'],
    },
  ];

  for (const audit of auditICLB) {
    const armId = (armICLBMap as ArmMap)[audit.armNom];
    if (!armId) continue;
    for (let i = 0; i < criteresEN.length && i < audit.resultats.length; i++) {
      const critId = critereIds[criteresEN[i]];
      if (!critId) continue;
      const exists = await prisma.resultatCritere.findUnique({ where: { armoireId_critereId: { armoireId: armId, critereId: critId } } });
      if (!exists) {
        await prisma.resultatCritere.create({ data: { armoireId: armId, critereId: critId, resultat: audit.resultats[i] } });
      }
    }
  }

  const auditICLK: { armNom: string; resultats: ResultatEnum[] }[] = [
    {
      armNom: 'E11-E12 Machine à laver – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'E12-E13 DMG – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','ECART_MINEUR','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'F11 Soudage 1 – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MINEUR','ECART_MINEUR','CONFORME','ECART_MINEUR','ECART_MINEUR','CONFORME'],
    },
    {
      armNom: 'F11-F12 Inspection – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'F12-F13 Ajustage – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','ECART_MINEUR','CONFORME','CONFORME','ECART_MINEUR','CONFORME','ECART_MINEUR','CONFORME','CONFORME','CONFORME'],
    },
    {
      armNom: 'H11 Chaudronnerie – ICLK',
      resultats: ['ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','ECART_MAJEUR','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME','CONFORME'],
    },
  ];

  for (const audit of auditICLK) {
    const armId = (armICLKMap as ArmMap)[audit.armNom];
    if (!armId) continue;
    for (let i = 0; i < criteresEN.length && i < audit.resultats.length; i++) {
      const critId = critereIds[criteresEN[i]];
      if (!critId) continue;
      const exists = await prisma.resultatCritere.findUnique({ where: { armoireId_critereId: { armoireId: armId, critereId: critId } } });
      if (!exists) {
        await prisma.resultatCritere.create({ data: { armoireId: armId, critereId: critId, resultat: audit.resultats[i] } });
      }
    }
  }

  // ── Snapshot initial HistoriqueScore ──────────────────────────────────────
  for (const pid of [projChimiques.id, projH25.id]) {
    const count = await prisma.historiqueScore.count({ where: { projetId: pid, axeId: null } });
    if (count === 0) {
      await prisma.historiqueScore.create({ data: { projetId: pid, score: 0 } });
    }
  }

  console.log('Seed terminé avec succès. Données réelles chargées.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
