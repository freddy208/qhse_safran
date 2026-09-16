import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { requireAuth }  from '../middleware/auth';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import {
  calculerScoreAxe, calculerScoreProjet,
  calculerTauxConformiteArmoire, calculerConformiteProduit,
  calculerTauxConformiteZone,
} from '../lib/scores';
import prisma from '../lib/prisma';

const router = Router();

// ── Couleurs palette ────────────────────────────────────────────────────────
const C = {
  primary:  '#003087',   // bleu Safran
  success:  '#16a34a',
  warning:  '#d97706',
  danger:   '#dc2626',
  light:    '#f8fafc',
  border:   '#e2e8f0',
  text:     '#1e293b',
  muted:    '#64748b',
  white:    '#ffffff',
};

function scoreColor(v: number) {
  if (v >= 75) return C.success;
  if (v >= 40) return C.warning;
  return C.danger;
}

function statutColor(s: string) {
  if (s === 'REALISE')     return C.success;
  if (s === 'EN_COURS')    return C.warning;
  return C.muted;
}

function conformiteColor(s: string) {
  if (s === 'CONFORME')     return C.success;
  if (s === 'ECART_MINEUR') return C.warning;
  return C.danger;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function fmtStatut(s: string) {
  if (s === 'REALISE')     return 'Réalisé';
  if (s === 'EN_COURS')    return 'En cours';
  return 'Non démarré';
}

// Dessine un rectangle coloré avec texte centré (badge)
function badge(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, h: number, color: string, label: string) {
  doc.save()
     .roundedRect(x, y, w, h, 3).fill(color)
     .fillColor(C.white).fontSize(7).font('Helvetica-Bold')
     .text(label, x, y + h / 2 - 4, { width: w, align: 'center' })
     .restore();
}

// Ligne de séparation
function hr(doc: InstanceType<typeof PDFDocument>, y: number, color = C.border) {
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke().restore();
}

// En-tête de page commune
function pageHeader(doc: InstanceType<typeof PDFDocument>, title: string, projetNom: string) {
  // Bandeau bleu
  doc.save().rect(0, 0, 595, 52).fill(C.primary).restore();
  doc.fillColor(C.white).fontSize(14).font('Helvetica-Bold')
     .text('SAFRAN — QHSE', 40, 14);
  doc.fontSize(9).font('Helvetica')
     .text(title, 40, 32);
  doc.fontSize(8)
     .text(`Projet : ${projetNom}`, 0, 32, { width: 555, align: 'right' });
  doc.fontSize(7).fillColor(C.muted)
     .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
           0, 58, { width: 555, align: 'right' });
}

// Pied de page
function pageFooter(doc: InstanceType<typeof PDFDocument>) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.save()
       .rect(0, 820, 595, 22).fill('#f1f5f9').restore();
    doc.fillColor(C.muted).fontSize(7).font('Helvetica')
       .text(`Page ${i + 1} / ${range.count}  —  CONFIDENTIEL`, 0, 826, { align: 'center', width: 595 });
  }
}

// ── GET /api/projets/:projetId/export/inventaire.pdf ──────────────────────
// Tableau complet des produits chimiques
router.get('/projets/:projetId/export/inventaire.pdf', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;

  const projet = await prisma.projet.findUnique({ where: { id: projetId } });
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  const zones = await prisma.zone.findMany({
    where: { projetId },
    include: { armoires: { include: { produits: true, resultats: true }, orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: {
    Title: `Inventaire produits – ${projet.nom}`,
    Author: 'QHSE Safran',
  }});

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  pageHeader(doc, 'Inventaire des produits chimiques', projet.nom);

  // Résumé stats
  const allProduits = zones.flatMap((z) => z.armoires.flatMap((a) => {
    const taux = calculerTauxConformiteArmoire(a.resultats);
    return a.produits.map((p) => ({ ...p, conf: calculerConformiteProduit(p, taux) }));
  }));
  const now = new Date();
  const nbExpires  = allProduits.filter((p) => p.datePeremption && new Date(p.datePeremption) < now).length;
  const nbEcarts   = allProduits.filter((p) => p.conf.statut !== 'CONFORME').length;

  let y = 72;
  // Boîtes stats
  const boxes = [
    { label: 'Total produits',  val: String(allProduits.length), color: C.primary },
    { label: 'Conformes',       val: String(allProduits.length - nbEcarts), color: C.success },
    { label: 'Écarts',          val: String(nbEcarts),           color: C.warning },
    { label: 'Périmés',         val: String(nbExpires),          color: C.danger  },
  ];
  boxes.forEach((b, i) => {
    const bx = 40 + i * 130;
    doc.save().roundedRect(bx, y, 118, 42, 4).fill(b.color).restore();
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold')
       .text(b.val, bx, y + 6, { width: 118, align: 'center' });
    doc.fontSize(7).font('Helvetica')
       .text(b.label, bx, y + 27, { width: 118, align: 'center' });
  });
  y += 54;
  hr(doc, y); y += 10;

  // ── Tableau par zone / armoire ──────────────────────────────────────────
  const cols = { zone: 40, armoire: 110, nom: 185, code: 295, qte: 345, pct: 390, statut: 450 };
  const colW = { zone: 65, armoire: 70, nom: 105, code: 50, qte: 40, pct: 55, statut: 100 };

  const tableHeader = (yh: number) => {
    doc.save().rect(40, yh, 515, 14).fill('#e2e8f0').restore();
    doc.fillColor(C.text).fontSize(7).font('Helvetica-Bold');
    doc.text('Zone',           cols.zone,    yh + 3, { width: colW.zone });
    doc.text('Armoire',        cols.armoire, yh + 3, { width: colW.armoire });
    doc.text('Produit',        cols.nom,     yh + 3, { width: colW.nom });
    doc.text('Code',           cols.code,    yh + 3, { width: colW.code });
    doc.text('Qté',            cols.qte,     yh + 3, { width: colW.qte, align: 'center' });
    doc.text('Péremption',     cols.pct,     yh + 3, { width: colW.pct });
    doc.text('Conformité',     cols.statut,  yh + 3, { width: colW.statut });
  };

  tableHeader(y); y += 16;

  let row = 0;
  for (const zone of zones) {
    for (const armoire of zone.armoires) {
      if (!armoire.produits.length) continue;
      const taux = calculerTauxConformiteArmoire(armoire.resultats);
      for (const p of armoire.produits) {
        if (y > 790) {
          doc.addPage();
          pageHeader(doc, 'Inventaire des produits chimiques (suite)', projet.nom);
          y = 72; tableHeader(y); y += 16; row = 0;
        }
        if (row % 2 === 0) {
          doc.save().rect(40, y - 1, 515, 13).fill('#f8fafc').restore();
        }
        doc.fillColor(C.text).fontSize(7).font('Helvetica');
        doc.text(zone.nom,     cols.zone,    y, { width: colW.zone,    ellipsis: true });
        doc.text(armoire.nom,  cols.armoire, y, { width: colW.armoire, ellipsis: true });
        doc.text(p.nom,        cols.nom,     y, { width: colW.nom,     ellipsis: true });
        doc.text(p.codeProduit ?? '—', cols.code, y, { width: colW.code });
        doc.text(p.quantitePresente != null ? String(p.quantitePresente) : '—',
          cols.qte, y, { width: colW.qte, align: 'center' });

        const expired = p.datePeremption && new Date(p.datePeremption) < now;
        doc.fillColor(expired ? C.danger : C.text)
           .text(fmtDate(p.datePeremption), cols.pct, y, { width: colW.pct });

        const conf = calculerConformiteProduit(p, taux);
        const confLabel = conf.statut === 'CONFORME' ? 'Conforme'
          : conf.statut === 'ECART_MINEUR' ? 'Écart mineur' : 'Écart majeur';
        badge(doc, cols.statut, y - 1, 90, 12, conformiteColor(conf.statut), confLabel);

        y += 13; row++;
      }
    }
  }

  pageFooter(doc);
  doc.end();

  await new Promise<void>((resolve) => doc.on('end', resolve));
  const pdf = Buffer.concat(chunks);

  const fname = `inventaire-${new Date().toISOString().slice(0,10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
}));

// ── GET /api/projets/:projetId/export/rapport.pdf ─────────────────────────
// Rapport complet : score, axes, conformité, actions, exigences
router.get('/projets/:projetId/export/rapport.pdf', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;

  const projet = await prisma.projet.findUnique({
    where: { id: projetId },
    include: {
      axes: { include: { sousActions: true }, orderBy: { id: 'asc' } },
      zones: { include: { armoires: { include: { produits: true, resultats: true } } } },
      exigencesAudit: { orderBy: [{ domaine: 'asc' }, { id: 'asc' }] },
      actionsCorrectives: { orderBy: [{ estGenerique: 'desc' }, { id: 'asc' }] },
    },
  });
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  const scoreGlobal = calculerScoreProjet(projet.axes);
  const now = new Date();

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: {
    Title: `Rapport QHSE – ${projet.nom}`,
    Author: 'QHSE Safran',
  }});
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  // ── PAGE 1 : COUVERTURE ─────────────────────────────────────────────────
  doc.save().rect(0, 0, 595, 200).fill(C.primary).restore();
  doc.fillColor(C.white).fontSize(11).font('Helvetica')
     .text('SAFRAN — DIRECTION QHSE', 40, 30);
  doc.fontSize(22).font('Helvetica-Bold')
     .text('RAPPORT DE SUIVI QHSE', 40, 60);
  doc.fontSize(13).font('Helvetica')
     .text(projet.nom, 40, 95);

  // Score global — grand cercle
  const cx = 460, cy = 110, r = 55;
  doc.save().circle(cx, cy, r).fill('rgba(255,255,255,0.15)').restore();
  doc.save().circle(cx, cy, r - 8).fill(scoreColor(scoreGlobal)).restore();
  doc.fillColor(C.white).fontSize(26).font('Helvetica-Bold')
     .text(`${scoreGlobal.toFixed(0)}%`, cx - 28, cy - 17);
  doc.fontSize(8).font('Helvetica')
     .text('Score global', cx - 22, cy + 12);

  doc.fillColor(C.white).fontSize(9).font('Helvetica')
     .text(`Rapport généré le ${now.toLocaleDateString('fr-FR')}`, 40, 155)
     .text(`Document confidentiel — Usage interne`, 40, 168);

  // Résumé axes
  let y = 218;
  doc.fillColor(C.text).fontSize(11).font('Helvetica-Bold').text('Avancement par axe', 40, y);
  y += 18;

  for (const ax of projet.axes) {
    const score = calculerScoreAxe(ax.sousActions);
    const barW  = Math.round((score / 100) * 340);

    doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
       .text(`${ax.code} — ${ax.intitule}`, 40, y, { width: 280 });
    doc.fillColor(C.muted).fontSize(7).font('Helvetica')
       .text(`${ax.ponderation}%`, 325, y + 1);

    // Barre de progression
    doc.save().roundedRect(350, y, 340 * (score / 100), 10, 2).fill(scoreColor(score)).restore();
    doc.save().roundedRect(350, y, 340, 10, 2).strokeColor(C.border).lineWidth(0.5).stroke().restore();
    doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
       .text(`${score.toFixed(0)}%`, 698, y);

    y += 16;
    if (y > 760) {
      doc.addPage();
      pageHeader(doc, 'Rapport QHSE – Avancement axes', projet.nom);
      y = 72;
    }
  }

  // Statuts sous-actions
  hr(doc, y + 4); y += 18;
  const toutes = projet.axes.flatMap((ax) => ax.sousActions);
  const nbR = toutes.filter((s) => s.statut === 'REALISE').length;
  const nbE = toutes.filter((s) => s.statut === 'EN_COURS').length;
  const nbN = toutes.filter((s) => s.statut === 'NON_DEMARRE').length;

  doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text('Statut des sous-actions', 40, y);
  y += 14;
  const statBoxes = [
    { label: 'Réalisées',      val: nbR, color: C.success },
    { label: 'En cours',       val: nbE, color: C.warning },
    { label: 'Non démarrées',  val: nbN, color: C.muted   },
    { label: 'Total',          val: toutes.length, color: C.primary },
  ];
  statBoxes.forEach((b, i) => {
    const bx = 40 + i * 130;
    doc.save().roundedRect(bx, y, 118, 38, 4).fill(b.color).restore();
    doc.fillColor(C.white).fontSize(20).font('Helvetica-Bold')
       .text(String(b.val), bx, y + 4, { width: 118, align: 'center' });
    doc.fontSize(7).font('Helvetica')
       .text(b.label, bx, y + 25, { width: 118, align: 'center' });
  });
  y += 50;

  // ── CONFORMITÉ ZONES ────────────────────────────────────────────────────
  hr(doc, y + 4); y += 18;
  doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text('Conformité stockage par zone', 40, y);
  y += 14;

  for (const zone of projet.zones) {
    const taux = calculerTauxConformiteZone(zone.armoires.map((a) => calculerTauxConformiteArmoire(a.resultats)));
    const tauxStr = taux !== null ? `${taux.toFixed(0)}%` : 'Non audité';
    const color   = taux !== null ? scoreColor(taux) : C.muted;

    if (y > 770) {
      doc.addPage();
      pageHeader(doc, 'Rapport QHSE – Conformité zones', projet.nom);
      y = 72;
    }

    doc.fillColor(C.text).fontSize(8).font('Helvetica').text(zone.nom, 40, y, { width: 260 });
    doc.fillColor(C.muted).text(`${zone.armoires.length} armoire(s) — ${zone.armoires.filter((a) => a.produits.length > 0).length} avec produits`, 310, y, { width: 180 });
    badge(doc, 490, y - 1, 65, 12, color, tauxStr);
    y += 14;
  }

  // ── ACTIONS CORRECTIVES ─────────────────────────────────────────────────
  if (projet.actionsCorrectives.length > 0) {
    if (y > 720) { doc.addPage(); pageHeader(doc, 'Rapport QHSE – Actions correctives', projet.nom); y = 72; }
    hr(doc, y + 4); y += 18;
    doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text('Actions correctives', 40, y);
    y += 14;

    // En-tête colonne
    doc.save().rect(40, y, 515, 13).fill(C.border).restore();
    doc.fillColor(C.text).fontSize(7).font('Helvetica-Bold');
    doc.text('Action',       42, y + 3, { width: 250 });
    doc.text('Responsable',  295, y + 3, { width: 110 });
    doc.text('Échéance',     408, y + 3, { width: 70 });
    doc.text('Statut',       480, y + 3, { width: 75 });
    y += 14;

    let row = 0;
    for (const ac of projet.actionsCorrectives) {
      if (y > 790) {
        doc.addPage();
        pageHeader(doc, 'Rapport QHSE – Actions correctives (suite)', projet.nom);
        y = 72; row = 0;
      }
      if (row % 2 === 0) doc.save().rect(40, y - 1, 515, 13).fill('#f8fafc').restore();
      doc.fillColor(C.text).fontSize(7).font('Helvetica');
      doc.text(ac.libelle,             42, y, { width: 250, ellipsis: true });
      doc.text(ac.responsable ?? '—', 295, y, { width: 110, ellipsis: true });
      const late = ac.echeance && new Date(ac.echeance) < now && ac.statut !== 'REALISE';
      doc.fillColor(late ? C.danger : C.text)
         .text(fmtDate(ac.echeance), 408, y, { width: 70 });
      badge(doc, 480, y - 1, 75, 12, statutColor(ac.statut), fmtStatut(ac.statut));
      y += 13; row++;
    }
  }

  // ── EXIGENCES AUDIT ─────────────────────────────────────────────────────
  const exiAvecResult = projet.exigencesAudit.filter((e) => e.conformite !== null);
  if (exiAvecResult.length > 0) {
    doc.addPage();
    pageHeader(doc, 'Rapport QHSE – Grille d\'audit PRO0239', projet.nom);
    y = 72;

    const nbOui = exiAvecResult.filter((e) => e.conformite === 'OUI').length;
    const pct   = Math.round((nbOui / exiAvecResult.length) * 100);

    doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold')
       .text(`Exigences audit — ${nbOui}/${exiAvecResult.length} conformes (${pct}%)`, 40, y);
    y += 18;

    doc.save().rect(40, y, 515, 13).fill(C.border).restore();
    doc.fillColor(C.text).fontSize(7).font('Helvetica-Bold');
    doc.text('Domaine',     42, y + 3, { width: 80 });
    doc.text('Exigence',   125, y + 3, { width: 240 });
    doc.text('Conformité', 368, y + 3, { width: 60 });
    doc.text('Action',     430, y + 3, { width: 125 });
    y += 14;

    let row = 0;
    for (const e of projet.exigencesAudit) {
      if (y > 790) {
        doc.addPage();
        pageHeader(doc, 'Rapport QHSE – Grille d\'audit (suite)', projet.nom);
        y = 72; row = 0;
      }
      if (row % 2 === 0) doc.save().rect(40, y - 1, 515, 14).fill('#f8fafc').restore();
      doc.fillColor(C.muted).fontSize(6.5).font('Helvetica')
         .text(e.domaine,   42, y,  { width: 80,  ellipsis: true });
      doc.fillColor(C.text)
         .text(e.exigence, 125, y, { width: 240, ellipsis: true });
      if (e.conformite) {
        badge(doc, 368, y - 1, 52, 12,
          e.conformite === 'OUI' ? C.success : C.danger,
          e.conformite === 'OUI' ? 'Conforme' : 'Non conforme');
      } else {
        doc.fillColor(C.muted).text('—', 368, y, { width: 52, align: 'center' });
      }
      doc.fillColor(C.muted).fontSize(6).font('Helvetica')
         .text(e.actionAMener ?? '—', 430, y, { width: 125, ellipsis: true });
      y += 14; row++;
    }
  }

  pageFooter(doc);
  doc.end();

  await new Promise<void>((resolve) => doc.on('end', resolve));
  const pdf = Buffer.concat(chunks);

  const fname = `rapport-qhse-${now.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
}));

export default router;
