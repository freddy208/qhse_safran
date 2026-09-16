import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(params: {
  utilisateurId?: number;
  tableConcernee: string;
  ligneId: number;
  champModifie: string;
  ancienneValeur?: string | null;
  nouvelleValeur?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      utilisateurId:  params.utilisateurId ?? null,
      tableConcernee: params.tableConcernee,
      ligneId:        params.ligneId,
      champModifie:   params.champModifie,
      ancienneValeur: params.ancienneValeur ?? null,
      nouvelleValeur: params.nouvelleValeur ?? null,
    },
  });
}
