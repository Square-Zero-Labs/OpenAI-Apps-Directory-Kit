import React from "react";

const defaultMessage = "Gathering fresh recommendations…";
const defaultSubMessage = "Our helpful map gnome is sprinting back with the latest picks.";

function getThemeColors(theme) {
  return {
    primary: theme?.primary ?? "#2563EB",
    accent: theme?.accent ?? "#10B981",
    background: theme?.background ?? "#F8FAFC"
  };
}

export default function LoadingPlaceholder({
  theme,
  message = defaultMessage,
  subMessage = defaultSubMessage,
  className = ""
}) {
  const colors = React.useMemo(() => getThemeColors(theme), [theme]);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 py-10 px-6 text-center ${className}`}
      style={{ background: "transparent" }}
    >
      <div className="relative w-36 h-36">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full drop-shadow-sm"
          role="img"
          aria-label="Map gnome chasing pins"
        >
          <defs>
            <linearGradient id="directory-loading-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.95" />
              <stop offset="100%" stopColor={colors.accent} stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="72" fill={colors.background} stroke={colors.primary} strokeWidth="4" />
          <g transform="translate(0, -6)">
            <path
              d="M54 108c8-8 18-12 26-12s16 4 24 12"
              stroke={colors.primary}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <ellipse cx="62" cy="72" rx="10" ry="14" fill="#fff" stroke={colors.primary} strokeWidth="4" />
            <ellipse cx="98" cy="72" rx="10" ry="14" fill="#fff" stroke={colors.primary} strokeWidth="4" />
            <circle cx="62" cy="72" r="4" fill={colors.primary} />
            <circle cx="98" cy="72" r="4" fill={colors.primary} />
            <path
              d="M80 82c3 2 6 2 9 0"
              stroke={colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </g>
          <g transform="translate(0, 12)">
            <path
              d="M52 114c-8 10-12 18-12 24 0 12 10 20 22 20s20-8 20-20c0-6-4-14-12-24l-8-10-10 10z"
              fill="url(#directory-loading-gradient)"
              stroke={colors.primary}
              strokeWidth="4"
            />
            <path
              d="M92 114c-8 10-12 18-12 24 0 12 8 20 20 20s22-8 22-20c0-6-4-14-12-24l-10-10-8 10z"
              fill="url(#directory-loading-gradient)"
              stroke={colors.primary}
              strokeWidth="4"
            />
            <circle cx="74" cy="132" r="5" fill="#fff" opacity="0.5" />
            <circle cx="110" cy="132" r="5" fill="#fff" opacity="0.35" />
          </g>
          <g className="animate-spin-slow origin-[80px_32px]">
            <path
              d="M80 26c-12 0-22 10-22 22s22 38 22 38 22-26 22-38-10-22-22-22zm0 32a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"
              fill={colors.primary}
              opacity="0.15"
            />
            <circle cx="80" cy="26" r="4" fill={colors.accent} />
          </g>
        </svg>
        <div
          className="absolute inset-0 rounded-full border-4 border-dashed"
          style={{
            borderColor: `${colors.primary}40`,
            animation: "loadingPulse 2.5s ease-in-out infinite"
          }}
        />
      </div>
      <div className="max-w-xs space-y-1">
        <div className="font-medium text-sm text-black/70">{message}</div>
        <div className="text-sm text-black/45">{subMessage}</div>
      </div>
    </div>
  );
}

// Tailwind doesn't provide keyframes for custom pulse here; fallback inline
const styleId = "directory-loading-style";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
@keyframes loadingPulse {
  0%, 100% { transform: scale(0.96); opacity: 0.6; }
  50% { transform: scale(1.04); opacity: 1; }
}
@keyframes directorySpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: directorySpin 6s linear infinite;
}
`;
  document.head.appendChild(style);
}
