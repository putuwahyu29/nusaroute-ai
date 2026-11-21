import "../config/app-config.js";
import { isFirestoreReady, registerUser } from "../services/firebase-admin.js";

function parseArgs(argv: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const eqIdx = token.indexOf("=");
      if (eqIdx !== -1) {
        flags[token.slice(2, eqIdx)] = token.slice(eqIdx + 1);
        continue;
      }
      const key = token.slice(2);
      const values: string[] = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        values.push(argv[++i]);
      }
      flags[key] = values.length > 0 ? values.join(" ") : "true";
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const email = flags.email || process.env.npm_config_email || positional.find((p) => p.includes("@"));
  const roleRaw =
    flags.role ||
    process.env.npm_config_role ||
    positional.find((p) => p === "dispatcher" || p === "courier");
  const nonEmailRole = positional.filter((p) => p !== email && p !== roleRaw);
  const name = flags.name || process.env.npm_config_name || nonEmailRole.join(" ");
  const role = (roleRaw === "dispatcher" ? "dispatcher" : "courier") as "courier" | "dispatcher";
  const username = flags.username || process.env.npm_config_username;
  const region = flags.region || process.env.npm_config_region || "Surabaya";
  const password = flags.password || process.env.npm_config_password;

  if (!email || !name) {
    console.log(`
NusaRoute AI — Pendaftaran Akun Petugas (Whitelist Google & Password)

Penggunaan:
  npm run user:add -- --email <email> --name "<Nama Lengkap>" --role <courier|dispatcher> [--username <user>] [--region "<Wilayah>"] [--password "<sandi>"]

Contoh (Google-only Dispatcher):
  npm run user:add -- --email admin@gmail.com --name "Andi Pratama" --role dispatcher

Contoh (Dual Login: Google + Password):
  npm run user:add -- --email budi@gmail.com --name "Budi Santoso" --role courier --username budi --password "SandiKuat2026!"
`);
    process.exit(1);
  }

  if (!isFirestoreReady) {
    console.error("[ERR] Firebase Admin / Firestore belum terkonfigurasi di backend/.env.");
    console.error("      Jalankan `npm run setup` terlebih dahulu agar akun tersimpan permanen di Firestore.");
    process.exit(1);
  }

  const result = await registerUser({ email, name, role, username, region, password });
  if (!result.success) {
    console.error(`[ERR] Gagal mendaftarkan user: ${result.error}`);
    process.exit(1);
  }

  console.log("[OK] Akun petugas berhasil didaftarkan ke Firestore `users`:");
  console.log(JSON.stringify(result.user, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[ERR]", err?.message || err);
  process.exit(1);
});
