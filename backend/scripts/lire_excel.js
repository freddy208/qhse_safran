/**
 * Lit les fichiers Excel et affiche toutes les données produits
 */
const xlsx = require('xlsx');
const path = require('path');
const fs   = require('fs');

const DOCS = path.resolve(__dirname, '../../docs');

function lireExcel(fichier) {
  const wb = xlsx.readFile(fichier);
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`FICHIER: ${path.basename(fichier)}`);
  console.log(`Feuilles: ${wb.SheetNames.join(' | ')}`);
  console.log('='.repeat(80));

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length === 0) continue;
    console.log(`\n--- Feuille: ${sheetName} (${data.length} lignes) ---`);
    data.slice(0, 200).forEach((row, i) => {
      if (row.every(c => c === '' || c === null || c === undefined)) return;
      console.log(`  L${String(i+1).padStart(3)}: ${row.map(c => String(c).substring(0,30).padEnd(30)).join(' | ')}`);
    });
  }
}

const fichiers = fs.readdirSync(DOCS).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
console.log(`Fichiers trouvés: ${fichiers.join(', ')}`);
for (const f of fichiers) {
  try { lireExcel(path.join(DOCS, f)); }
  catch(e) { console.error(`Erreur ${f}: ${e.message}`); }
}
