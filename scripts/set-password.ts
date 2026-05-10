/**
 * Imposta la password (bcrypt) dell'AdminUser identificato da ADMIN_EMAIL.
 * Usage:
 *   ADMIN_EMAIL=foo@bar  ADMIN_PASSWORD='...'  npx tsx scripts/set-password.ts
 *
 * La password NON viene loggata. Lo script è idempotente.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error("ADMIN_EMAIL mancante");
  if (!password || password.length < 8) {
    throw new Error("ADMIN_PASSWORD mancante o troppo corta (min 8)");
  }
  const hash = await bcrypt.hash(password, 12);
  const u = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: { email, passwordHash: hash },
  });
  console.log("Password aggiornata per:", u.email);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
