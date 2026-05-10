import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __opsPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__opsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") global.__opsPrisma = prisma;
