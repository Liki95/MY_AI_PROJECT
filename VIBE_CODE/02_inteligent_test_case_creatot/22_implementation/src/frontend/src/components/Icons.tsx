export function CheckSquareBadgeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tc-green-badge" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="32" height="32" rx="9" fill="url(#tc-green-badge)" />
      <path d="M10.5 17.5l4.4 4.4 8.8-9.2" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChecklistDocIcon() {
  return (
    <svg width="74" height="74" viewBox="0 0 74 74" fill="none" aria-hidden="true" className="hero-icon">
      <defs>
        <linearGradient id="tc-doc-grad" x1="12" y1="8" x2="62" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M21 10h21l15 15v35a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5Z"
        stroke="url(#tc-doc-grad)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M41 10v13a3 3 0 0 0 3 3h13" stroke="url(#tc-doc-grad)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M24 27l3 3 6-6" stroke="url(#tc-doc-grad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 40l3 3 6-6" stroke="url(#tc-doc-grad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="38" y1="41" x2="49" y2="41" stroke="url(#tc-doc-grad)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 53l3 3 6-6" stroke="url(#tc-doc-grad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="38" y1="54" x2="49" y2="54" stroke="url(#tc-doc-grad)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function JiraMarkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tc-jira-a" x1="12" y1="3" x2="21" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2684ff" />
          <stop offset="100%" stopColor="#0052cc" />
        </linearGradient>
      </defs>
      <path d="M12.3 2.5a.8.8 0 0 0-1.1 0L2.5 11.2a.8.8 0 0 0 0 1.1l8.7 8.7a.8.8 0 0 0 1.1 0l8.7-8.7a.8.8 0 0 0 0-1.1L12.3 2.5Z" fill="url(#tc-jira-a)" />
      <path d="M11.75 8.1L8.1 11.75l3.65 3.65 3.65-3.65-3.65-3.65Z" fill="#ffffff" />
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
