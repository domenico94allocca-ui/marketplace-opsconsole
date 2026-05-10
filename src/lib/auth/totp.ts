import { authenticator } from "otplib";
import { encrypt, decrypt } from "./crypto";

authenticator.options = { window: 1, step: 30, digits: 6 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret(32);
}

export function totpUri(secret: string, account: string): string {
  const issuer = process.env.TOTP_ISSUER || "BacoliOnLife OpsConsole";
  return authenticator.keyuri(account, issuer, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ""), secret });
  } catch {
    return false;
  }
}

export function encryptSecret(secret: string): string { return encrypt(secret); }
export function decryptSecret(blob: string): string { return decrypt(blob); }
