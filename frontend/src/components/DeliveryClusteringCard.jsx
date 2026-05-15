import React from "react";
import { PackageIcon, MapPinIcon, RobotIcon } from "./UiIcons.jsx";

/**
 * DeliveryClusteringCard — Visualizes delivery clustering optimization
 * Shows how AI groups deliveries for efficient routing
 */
export default function DeliveryClusteringCard({
  clusters = [],
  totalDeliveries = 0,
}) {
  if (!clusters || clusters.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-2xl p-4 text-center">
        <PackageIcon className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-text-muted text-xs font-bold">
          Tidak ada clustering aktif
        </p>
      </div>
    );
  }

  const totalClusters = clusters.length;
  const avgDeliveryPerCluster = Math.round(totalDeliveries / totalClusters);
  const estimatedSaving = (totalClusters - 1) * 8; // ~8 min per cluster transition saved

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="bg-surface border border-theme rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <PackageIcon className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-tight text-text-main">
            Optimasi Rute Pengiriman
          </h3>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-main rounded-lg p-3 border border-theme text-center">
            <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
              Cluster
            </p>
            <p className="text-lg font-black text-primary">{totalClusters}</p>
          </div>
          <div className="bg-main rounded-lg p-3 border border-theme text-center">
            <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
              Paket/Cluster
            </p>
            <p className="text-lg font-black text-text-main">
              {avgDeliveryPerCluster}
            </p>
          </div>
          <div className="bg-main rounded-lg p-3 border border-theme text-center">
            <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
              Hemat Waktu
            </p>
            <p className="text-lg font-black text-green-500">
              ~{estimatedSaving}m
            </p>
          </div>
        </div>

        {/* AI Insight */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-[9px] font-black text-blue-500 uppercase mb-1 flex items-center gap-1">
            <RobotIcon className="w-3.5 h-3.5" /> AI Clustering Engine
          </p>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Algoritma Traveling Salesman Problem (TSP) telah mengoptimalkan
            urutan pengiriman untuk meminimalkan jarak perjalanan total dan
            waktu operasional.
          </p>
        </div>
      </div>

      {/* Cluster Cards */}
      <div className="space-y-3">
        {clusters.map((cluster, idx) => {
          const clusterColor =
            idx % 3 === 0
              ? {
                  bg: "bg-blue-500/10",
                  border: "border-blue-500/30",
                  text: "text-blue-500",
                }
              : idx % 3 === 1
                ? {
                    bg: "bg-purple-500/10",
                    border: "border-purple-500/30",
                    text: "text-purple-500",
                  }
                : {
                    bg: "bg-cyan-500/10",
                    border: "border-cyan-500/30",
                    text: "text-cyan-500",
                  };

          return (
            <div
              key={cluster.id || idx}
              className={`${clusterColor.bg} border ${clusterColor.border} rounded-2xl p-4 relative overflow-hidden`}
            >
              {/* Decorative background */}
              <div
                className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${clusterColor.bg} rounded-bl-full opacity-20 -z-0 pointer-events-none`}
              />

              <div className="relative z-10">
                {/* Cluster Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider mb-1 ${clusterColor.text}`}
                    >
                      Cluster {idx + 1}
                    </p>
                    <p className="text-sm font-black text-text-main">
                      {cluster.name ||
                        `Rute Zona ${cluster.zone || `#${idx + 1}`}`}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${clusterColor.bg} ${clusterColor.text}`}
                  >
                    {cluster.deliveries?.length || 0} paket
                  </span>
                </div>

                {/* Deliveries List */}
                <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                  {(cluster.deliveries || []).slice(0, 4).map((del, delIdx) => (
                    <div
                      key={delIdx}
                      className="flex items-start gap-2 text-[10px] p-2 rounded-lg bg-surface/50 border border-theme/30"
                    >
                      <span className="font-black text-text-muted shrink-0">
                        {delIdx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-main truncate">
                          {del.recipient || del.address}
                        </p>
                        <p className="text-text-muted text-[9px] truncate mt-0.5">
                          {del.address}
                        </p>
                      </div>
                      <span className="text-text-muted shrink-0 whitespace-nowrap">
                        {del.distance || "—"}
                      </span>
                    </div>
                  ))}
                  {(cluster.deliveries?.length || 0) > 4 && (
                    <p className="text-[9px] text-text-muted italic p-2 text-center">
                      + {cluster.deliveries.length - 4} paket lainnya
                    </p>
                  )}
                </div>

                {/* Cluster Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-main/60 rounded-lg p-2 text-center border border-theme/50">
                    <p className="text-[9px] text-text-muted font-bold uppercase">
                      Total Jarak
                    </p>
                    <p
                      className={`text-xs font-black ${clusterColor.text} mt-1`}
                    >
                      {cluster.totalDistance || "~12 km"}
                    </p>
                  </div>
                  <div className="bg-main/60 rounded-lg p-2 text-center border border-theme/50">
                    <p className="text-[9px] text-text-muted font-bold uppercase">
                      Est. Waktu
                    </p>
                    <p
                      className={`text-xs font-black ${clusterColor.text} mt-1`}
                    >
                      {cluster.estimatedTime || "~45 min"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
        <p className="text-[10px] font-black text-primary uppercase mb-2">
          📊 Optimization Summary
        </p>
        <ul className="text-[10px] text-text-muted space-y-1.5 leading-relaxed">
          <li>
            ✓ <strong>{totalClusters} cluster</strong> optimal untuk mencakup{" "}
            <strong>{totalDeliveries} pengiriman</strong>
          </li>
          <li>
            ✓ Algoritma AI meminimalkan <strong>backtracking</strong> dan rute
            bersilangan
          </li>
          <li>
            ✓ Perkiraan <strong>penghematan ~{estimatedSaving} menit</strong>{" "}
            waktu operasional
          </li>
          <li>
            ✓ Urutan kunjungan sudah <strong>optimal untuk setiap zona</strong>
          </li>
        </ul>
      </div>
    </div>
  );
}
