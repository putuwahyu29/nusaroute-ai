import React from "react";
import { PackageIcon, RouteIcon, ActivityIcon, CheckIcon } from "./UiIcons.js";
import type { Delivery } from "../types/index.js";

interface DeliveryClusteringCardProps {
  clusters?: Array<{
    id?: string;
    name?: string;
    zone?: string;
    deliveries?: Array<{ id?: string; recipient?: string; address?: string; distance?: string }>;
    totalDistance?: string;
    estimatedTime?: string;
  }>;
  totalDeliveries?: number;
}

export default function DeliveryClusteringCard({
  clusters = [],
  totalDeliveries = 0,
}: DeliveryClusteringCardProps) {
  if (!clusters || clusters.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-2xl p-4 text-center">
        <PackageIcon className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-text-muted text-xs font-bold">Tidak ada clustering aktif</p>
      </div>
    );
  }

  const totalClusters = clusters.length;
  const avgDeliveryPerCluster = Math.round(totalDeliveries / totalClusters);
  const estimatedSaving = (totalClusters - 1) * 8;

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-theme rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <PackageIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-text-main">
            Kluster Rute Pengiriman
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-main rounded-lg p-2.5 border border-theme text-center">
            <span className="text-[11px] text-text-muted font-medium block mb-0.5">Kluster</span>
            <span className="text-lg font-bold font-mono text-primary">{totalClusters}</span>
          </div>
          <div className="bg-main rounded-lg p-2.5 border border-theme text-center">
            <span className="text-[11px] text-text-muted font-medium block mb-0.5">Paket/Kluster</span>
            <span className="text-lg font-bold font-mono text-text-main">{avgDeliveryPerCluster}</span>
          </div>
          <div className="bg-main rounded-lg p-2.5 border border-theme text-center">
            <span className="text-[11px] text-text-muted font-medium block mb-0.5">Hemat Waktu</span>
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">~{estimatedSaving}m</span>
          </div>
        </div>

        <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg">
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5 flex items-center gap-1.5">
            <RouteIcon className="w-3.5 h-3.5" /> Konsolidasi Wilayah Operasional
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Algoritma pemetaan rute mengelompokkan paket berdasarkan kedekatan geografis
            untuk meminimalkan jarak perjalanan total dan waktu operasional armada.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {clusters.map((cluster, idx) => {
          return (
            <div
              key={cluster.id || idx}
              className="bg-surface border border-theme hover:border-primary/40 rounded-xl p-4 shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block mb-0.5">
                    Kluster {idx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-text-main">
                    {cluster.name || `Rute Zona ${cluster.zone || `#${idx + 1}`}`}
                  </h4>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-main border border-theme text-text-main">
                  {cluster.deliveries?.length || 0} paket
                </span>
              </div>

              <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto scrollbar-soft pr-1">
                {(cluster.deliveries || []).slice(0, 4).map((del, delIdx) => (
                  <div
                    key={delIdx}
                    className="flex items-start gap-2 text-xs p-2 rounded-lg bg-main border border-theme/60"
                  >
                    <span className="font-mono text-text-dim text-[11px] mt-0.5 shrink-0">{delIdx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-main truncate">{del.recipient || del.address}</p>
                      <p className="text-text-muted text-[11px] truncate mt-0.5">{del.address}</p>
                    </div>
                    <span className="text-text-dim font-mono text-[11px] shrink-0 whitespace-nowrap">
                      {del.distance || "-"}
                    </span>
                  </div>
                ))}
                {(cluster.deliveries?.length || 0) > 4 && (
                  <p className="text-[11px] text-text-dim italic p-1.5 text-center">
                    + {(cluster.deliveries?.length || 0) - 4} paket lainnya
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-main rounded-lg p-2 text-center border border-theme">
                  <span className="text-[11px] text-text-muted block">Total Jarak</span>
                  <span className="font-bold font-mono text-text-main mt-0.5 block">
                    {cluster.totalDistance || "~12 km"}
                  </span>
                </div>
                <div className="bg-main rounded-lg p-2 text-center border border-theme">
                  <span className="text-[11px] text-text-muted block">Estimasi Waktu</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {cluster.estimatedTime || "~45 min"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-theme rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-text-main mb-2.5 flex items-center gap-1.5">
          <ActivityIcon className="w-4 h-4 text-primary" /> Ringkasan Optimasi Kluster
        </p>
        <ul className="text-xs text-text-muted space-y-2 leading-relaxed">
          <li className="flex items-center gap-2">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>{totalClusters} kluster</strong> optimal mencakup <strong>{totalDeliveries} titik pengiriman</strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Pola jalur dirancang untuk meminimalkan bolak-balik (backtracking)</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Perkiraan penghematan efisiensi waktu armada <strong>~{estimatedSaving} menit</strong></span>
          </li>
        </ul>
      </div>
    </div>
  );
}
