/**
 * Crea (o aggiorna) il singolo AdminUser della OpsConsole.
 * Usage:  npx tsx scripts/seed-admin.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!email) throw new Error("ADMIN_EMAIL mancante");
  const u = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  console.log("AdminUser ok:", u.email, "id:", u.id);
}

main().finally(() => prisma.$disconnect());
