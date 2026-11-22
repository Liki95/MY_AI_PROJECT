export function ShieldCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ts-shield-grad" x1="4" y1="3" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M14 2.5L4.5 6.2v6.6c0 6.1 4 11.4 9.5 12.9 5.5-1.5 9.5-6.8 9.5-12.9V6.2L14 2.5Z" fill="url(#ts-shield-grad)" />
      <path d="M9.8 14.1l2.8 2.8 5.8-5.8" stroke="#0b1120" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StrategyDocIcon() {
  return (
    <svg width="74" height="74" viewBox="0 0 74 74" fill="none" aria-hidden="true" className="hero-icon">
      <defs>
        <linearGradient id="ts-doc-grad" x1="12" y1="8" x2="62" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M21 10h21l15 15v35a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5Z"
        stroke="url(#ts-doc-grad)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M41 10v13a3 3 0 0 0 3 3h13" stroke="url(#ts-doc-grad)" strokeWidth="3.5" strokeLinejoin="round" />
      <line x1="25" y1="26" x2="36" y2="26" stroke="url(#ts-doc-grad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="25" y1="35" x2="40" y2="35" stroke="url(#ts-doc-grad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="25" y1="44" x2="32" y2="44" stroke="url(#ts-doc-grad)" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="33" y="49" width="4.5" height="9" rx="1.5" fill="url(#ts-doc-grad)" />
      <rect x="41" y="43" width="4.5" height="15" rx="1.5" fill="url(#ts-doc-grad)" />
      <rect x="49" y="37" width="4.5" height="21" rx="1.5" fill="url(#ts-doc-grad)" />
    </svg>
  );
}

export function LinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 2l2.2 6.8L20 11l-6.8 2.2L11 20l-2.2-6.8L2 11l6.8-2.2L11 2z" />
      <path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" opacity="0.85" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 .92-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .92 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51.92H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51.92Z" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M11.2 12.2L21 2.5" />
      <path d="M17 6.5l2.5 2.5" />
      <path d="M14.5 9l2.5 2.5" />
    </svg>
  );
}

export function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2v5" />
      <path d="M15 2v5" />
      <path d="M6 7h12v4a6 6 0 0 1-12 0V7Z" />
      <path d="M12 17v5" />
    </svg>
  );
}

export function LlamaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="provider-badge-icon">
      <path d="M7 4l1 4v4a3 3 0 0 1 3-1h4a3 3 0 0 1 3 3v6h-2.5v-4h-4.5v4H8.5v-6.5L7 12V7.5L5.5 6.5 7 4Z" />
      <path d="M10.5 4.2L10 7.5" />
      <circle cx="8.3" cy="8.8" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function BrainIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 4a3 3 0 0 0-3 3c0 .4.1.8.2 1.1A3 3 0 0 0 4 11a3 3 0 0 0 1.4 2.5A3 3 0 0 0 7 18.5a3 3 0 0 0 5-1.5V4.5A2.5 2.5 0 0 0 9.5 4Z" />
      <path d="M14.5 4a3 3 0 0 1 3 3c0 .4-.1.8-.2 1.1A3 3 0 0 1 20 11a3 3 0 0 1-1.4 2.5A3 3 0 0 1 17 18.5a3 3 0 0 1-5-1.5V4.5A2.5 2.5 0 0 1 14.5 4Z" />
      <path d="M9 9.5h1.5M13.5 9.5H15M8.5 14h2M13.5 14h2" />
    </svg>
  );
}
