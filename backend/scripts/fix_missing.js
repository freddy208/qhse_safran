if (!process.env.DATABASE_URL) {
  const fs = require('fs'), path = require('path');
  const lines = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8').split('\n');
  for (const l of lines) { const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const aB9 = await prisma.armoire.findFirst({ where: { nom: { contains: 'B9', mode: 'insensitive' } } });
  const rtv = await prisma.produit.findFirst({ where: { armoireId: aB9.id, nom: { contains: 'RTV 730', mode: 'insensitive' } } });
  if (rtv) {
    console.log('DOW CORNING RTV 730FS déjà présent id:' + rtv.id);
  } else {
    const p = await prisma.produit.create({ data: {
      armoireId: aB9.id, nom: 'DOW CORNING RTV 730FS', codeProduit: '90358264240',
      quantitePresente: 15, quantiteUtilisee: 1,
      datePeremption: new Date('2026-10-22'), statutFds: 'OBSOLETE',
    }});
    console.log('+ DOW CORNING RTV 730FS créé id:' + p.id);
  }

  const aC10 = await prisma.armoire.findFirst({ where: { nom: { contains: 'C10', mode: 'insensitive' } } });
  const prf = await prisma.produit.findFirst({ where: { armoireId: aC10.id, nom: { contains: 'FLUO', mode: 'insensitive' } } });
  if (prf) {
    await prisma.produit.update({ where: { id: prf.id }, data: { statutFds: 'MANQUANTE' } });
    console.log('PEINTURE ROUGE FLUO id:' + prf.id + ' → MANQUANTE');
  } else {
    console.log('PEINTURE ROUGE FLUO introuvable (peut être nommé différemment en DB)');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
