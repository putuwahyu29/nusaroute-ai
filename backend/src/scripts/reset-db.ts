import readline from "node:readline";
import "../config/app-config.js";
import { resetDatabase } from "../services/firebase-admin.js";

async function promptConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === "y" || a === "ya" || a === "yes");
    });
  });
}

async function main() {
  console.log("==================================================");
  console.log("NUSAROUTE AI - DATABASE RESET / REFRESH");
  console.log("==================================================");
  console.log("Perintah ini akan:");
  console.log("1. Mengembalikan seluruh 15 paket pengiriman (DEL-001 s.d. DEL-015) ke status 'unassigned'.");
  console.log("2. Menghapus paket pengiriman kustom tambahan.");
  console.log("3. Mengembalikan 10 zona rawan macet awal Surabaya.");
  console.log("4. Memastikan akun demo (budi, agus, eko, dispatcher) aktif dengan password default.");
  console.log("5. Menghapus riwayat laporan insiden uji coba dan keputusan agen sementara.");
  console.log("==================================================");

  const force = process.argv.includes("--force") || process.argv.includes("-f");
  if (!force && process.stdin.isTTY) {
    const ok = await promptConfirm("Apakah Anda yakin ingin me-reset database sekarang? (y/N): ");
    if (!ok) {
      console.log("Operasi reset dibatalkan oleh pengguna.");
      process.exit(0);
    }
  }

  console.log("Sedang menjalankan reset database...");
  const stats = await resetDatabase();
  console.log("✅ Database berhasil di-reset ke kondisi awal:");
  console.log(`   - Paket pengiriman aktif : ${stats.deliveriesCount} paket (unassigned)`);
  console.log(`   - Zona lalu lintas      : ${stats.zonesCount} zona`);
  console.log(`   - Akun pengguna seed    : ${stats.usersCount} akun`);
  console.log(`   - Laporan dibersihkan   : ${stats.cleanedReportsCount} laporan`);
  console.log(`   - Keputusan dibersihkan : ${stats.cleanedDecisionsCount} riwayat`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Gagal menjalankan reset database:", err);
  process.exit(1);
});
