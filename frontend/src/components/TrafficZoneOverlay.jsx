import React from 'react';

// Maps lat/lng to roughly pixel coordinates for our mock map overlay.
// Dispatcher map center is usually Surabaya main hub.
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };
const SCALE_X = 8000;
const SCALE_Y = 8000;

function latLngToPx(lat, lng) {
  // Simple flat projection relative to center
  const x = (lng - SURABAYA_CENTER.lng) * SCALE_X + 200; // 200 is center X
  const y = (SURABAYA_CENTER.lat - lat) * SCALE_Y + 200; // 200 is center Y
  return { x, y };
}

export default function TrafficZoneOverlay({ trafficZones }) {
  if (!trafficZones || trafficZones.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* SVG overlay covering the map container */}
      <svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="opacity-60 mix-blend-screen">
        {trafficZones.map((zone) => {
          const { x, y } = latLngToPx(zone.lat, zone.lng);
          const r = (zone.radius || 1.5) * 15; // Rough km to px scaling

          let fill, stroke;
          switch (zone.level) {
            case 'critical': fill = '#ef4444'; stroke = '#b91c1c'; break;
            case 'high':     fill = '#f97316'; stroke = '#c2410c'; break;
            case 'medium':   fill = '#eab308'; stroke = '#a16207'; break;
            case 'low':      fill = '#22c55e'; stroke = '#15803d'; break;
            default:         fill = '#6b7280'; stroke = '#374151'; break;
          }

          const isDanger = zone.level === 'high' || zone.level === 'critical';

          return (
            <g key={zone.id} transform={`translate(${x}, ${y})`}>
              {/* Outer glow/pulse for high traffic */}
              {isDanger && (
                <circle
                  cx="0" cy="0" r={r * 1.5}
                  fill={fill}
                  className="animate-ping opacity-20"
                  style={{ animationDuration: '3s' }}
                />
              )}
              {/* Main Zone Area */}
              <circle
                cx="0" cy="0" r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
                opacity="0.4"
              />
              {/* Center Dot */}
              <circle cx="0" cy="0" r="3" fill="#fff" opacity="0.8" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
