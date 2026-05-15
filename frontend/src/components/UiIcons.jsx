import React from "react";

function makeIcon(paths) {
  return function Icon({ className = "w-5 h-5", strokeWidth = 2.2 }) {
    return (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
      >
        {paths}
      </svg>
    );
  };
}

export const AppMarkIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9zm8-3.5v16m-8-9 8 3.5 8-3.5"
  />,
);

export const SunIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
    />
  </>,
);

export const MoonIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  />,
);

export const LogoutIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
    />
  </>,
);

export const LeafIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25"
  />,
);

export const CloudIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15z"
  />,
);

export const RainIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M1.166 14.833a4.5 4.5 0 0 1 .412-8.333 3 3 0 0 1 3.758-3.848 5.25 5.25 0 0 1 10.233 2.33 4.5 4.5 0 0 1 .412 8.333M7 16l-1 3m5-3-1 3m5-3-1 3"
  />,
);

export const BoltIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
  />,
);

export const ActivityIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M2.25 18 9 11.25l4.5 4.5L21.75 7.5M21.75 7.5V12m0-4.5H17.25"
  />,
);

export const RobotIcon = makeIcon(
  <>
    <rect x="7" y="6" width="10" height="10" rx="2" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2v4m-3 0h6M9 11h0m6 0h0M9 20v-2m6 2v-2"
    />
    <circle cx="10" cy="11" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="14" cy="11" r="0.8" fill="currentColor" stroke="none" />
  </>,
);

export const RouteIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 4a3 3 0 1 0 0 6h10a3 3 0 1 1 0 6H8a3 3 0 1 0 0 6"
    />
    <circle cx="7" cy="7" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="17" cy="17" r="1.25" fill="currentColor" stroke="none" />
  </>,
);

export const MapPinIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z"
    />
    <circle cx="12" cy="11" r="2" />
  </>,
);

export const PackageIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 8-9 5-9-5 9-5 9 5v8l-9 5-9-5V8"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v8" />
  </>,
);

export const CameraIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 8a2 2 0 0 1 2-2h1.2a2 2 0 0 0 1.6-.8l.8-1.2A2 2 0 0 1 11.2 3h1.6a2 2 0 0 1 1.6.8l.8 1.2a2 2 0 0 0 1.6.8H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
    />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const MicIcon = makeIcon(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8"
    />
  </>,
);

export const TrashIcon = makeIcon(
  <>
    <polyline points="3 6 5 6 21 6" strokeLinecap="round" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    />
  </>,
);

export const SendIcon = makeIcon(
  <>
    <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
    <polygon
      points="22 2 15 22 11 13 2 9 22 2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>,
);

export const ShieldIcon = makeIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 3 19 6v5c0 5-3.5 8.2-7 10-3.5-1.8-7-5-7-10V6l7-3z"
  />,
);

export const AlertIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v4m0 4h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"
    />
  </>,
);

export const HubIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 19V5m0 14h16M8 15l2-4 3 3 3-6 2 4"
    />
    <circle cx="8" cy="15" r="1" />
    <circle cx="11" cy="11" r="1" />
    <circle cx="14" cy="14" r="1" />
    <circle cx="17" cy="8" r="1" />
  </>,
);

export const CheckIcon = makeIcon(
  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />,
);

export const ClockIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
  </>,
);

export const LockIcon = makeIcon(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 11V8a4 4 0 0 1 8 0v3"
    />
  </>,
);

export const PackageOpenIcon = makeIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4 7 8-4 8 4-8 4-8-4zm0 0v10l8 4 8-4V7"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="m12 11v10" />
  </>,
);

export const ChevronIcon = makeIcon(
  <path strokeLinecap="round" strokeLinejoin="round" d="m8 10 4 4 4-4" />,
);

export const TruckIcon = makeIcon(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h3l3 3v4h-6z" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </>,
);
