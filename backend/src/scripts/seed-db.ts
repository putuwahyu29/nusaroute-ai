import "../config/app-config.js";
import { seedDatabase } from "../services/firebase-admin.js";

async function main() {
  console.log("==================================================");
  console.log("NUSAROUTE AI - DATABASE SEEDER (IDEMPOTENT)");
  console.log("==================================================");
  console.log("Memeriksa koleksi database (users, deliveries, traffic_zones)...");

  await seedDatabase(false);

  console.log("✅ Proses seeder selesai dengan aman (data eksisting dipertahankan).");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Gagal menjalankan seed:", err);
  process.exit(1);
});
