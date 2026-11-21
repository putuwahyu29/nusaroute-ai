import crypto from "crypto";
import { APP_CONFIG } from "../config/app-config.js";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: "courier" | "dispatcher";
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Signs a standards-compliant HS256 JWT using Node.js built-in crypto.
 */
export function signAuthToken(user: {
  id: string;
  email: string;
  name: string;
  role: "courier" | "dispatcher";
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: nowSec,
    exp: nowSec + APP_CONFIG.jwtTtlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${encodedPayload}`;
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", APP_CONFIG.jwtSecret).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}

/**
 * Verifies HS256 JWT signature in constant time and checks token expiration.
 */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, providedSig] = parts;

    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;

    const expectedSig = base64UrlEncode(
      crypto
        .createHmac("sha256", APP_CONFIG.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest()
    );

    const bufProvided = Buffer.from(providedSig, "utf-8");
    const bufExpected = Buffer.from(expectedSig, "utf-8");
    if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.role || typeof payload.exp !== "number" || payload.exp <= nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
