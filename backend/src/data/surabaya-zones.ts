import type { TrafficZone } from "../types/index.js";

/**
 * Master reference data for Surabaya traffic monitoring zones.
 * Separated from traffic-agent business logic so zones can be replaced
 * by a database collection or spatial grid (H3/S2) without changing algorithms.
 */
export const SURABAYA_ZONES: TrafficZone[] = [
  {
    id: "gubeng",
    name: "Gubeng / Stasiun",
    lat: -7.2652,
    lng: 112.7523,
    radius: 1.5,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
  {
    id: "wonokromo",
    name: "Wonokromo / Sutos",
    lat: -7.2988,
    lng: 112.7341,
    radius: 1.8,
    area: "Surabaya Selatan",
    peakHours: [
      [7, 9],
      [12, 13],
      [17, 19],
    ],
  },
  {
    id: "tunjungan",
    name: "Tunjungan / Pusat Kota",
    lat: -7.2641,
    lng: 112.7394,
    radius: 1.2,
    area: "Surabaya Pusat",
    peakHours: [
      [8, 10],
      [17, 19],
    ],
  },
  {
    id: "kenjeran",
    name: "Kenjeran / Bulak",
    lat: -7.2312,
    lng: 112.7751,
    radius: 1.5,
    area: "Surabaya Utara",
    peakHours: [
      [7, 8],
      [17, 18],
    ],
  },
  {
    id: "waru",
    name: "Bundaran Waru (Cito)",
    lat: -7.3489,
    lng: 112.7228,
    radius: 2.0,
    area: "Pintu Masuk Selatan",
    peakHours: [
      [6, 9],
      [16, 19],
    ],
  },
  {
    id: "perak",
    name: "Pelabuhan Perak",
    lat: -7.2012,
    lng: 112.7295,
    radius: 1.5,
    area: "Surabaya Utara",
    peakHours: [
      [7, 10],
      [13, 14],
    ],
  },
  {
    id: "merr",
    name: "MERR / Sukolilo",
    lat: -7.2878,
    lng: 112.7962,
    radius: 2.0,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
  {
    id: "rungkut",
    name: "Rungkut / SIER",
    lat: -7.3178,
    lng: 112.7851,
    radius: 1.5,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [16, 18],
    ],
  },
  {
    id: "kembang",
    name: "Jl. Kembang Jepun",
    lat: -7.2443,
    lng: 112.7448,
    radius: 1.0,
    area: "Surabaya Pusat",
    peakHours: [
      [8, 10],
      [16, 18],
    ],
  },
  {
    id: "darmo",
    name: "Jl. Raya Darmo",
    lat: -7.2821,
    lng: 112.7366,
    radius: 1.5,
    area: "Surabaya Selatan",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
];

export const FLOOD_PRONE_ZONE_IDS = ["wonokromo", "kenjeran", "merr", "waru"] as const;
