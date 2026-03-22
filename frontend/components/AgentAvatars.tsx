"use client";

/**
 * Agent role avatars — polished, distinctive icons for each role.
 * Each avatar uses a soft tinted background with a refined icon.
 */

interface AvatarProps {
  size?: number;
  className?: string;
}

/* Investor: ascending bar chart — growth & ambition */
export function InvestorAvatar({ size = 36, className = "" }: AvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className}>
      <rect width="44" height="44" rx="14" fill="#FEF3C7" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="13.5" stroke="#D97706" strokeOpacity="0.15" />
      {/* Three ascending bars */}
      <rect x="12" y="25" width="5" height="8" rx="1.5" fill="#D97706" fillOpacity="0.25" />
      <rect x="19.5" y="19" width="5" height="14" rx="1.5" fill="#D97706" fillOpacity="0.5" />
      <rect x="27" y="13" width="5" height="20" rx="1.5" fill="#D97706" />
      {/* Trend arrow */}
      <path d="M14 22L22 16L30 11" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2" opacity="0.5" />
    </svg>
  );
}

/* CTO: terminal window — technical expertise */
export function CTOAvatar({ size = 36, className = "" }: AvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className}>
      <rect width="44" height="44" rx="14" fill="#ECFEFF" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="13.5" stroke="#0891B2" strokeOpacity="0.15" />
      {/* Terminal window frame */}
      <rect x="9" y="11" width="26" height="22" rx="4" stroke="#0891B2" strokeWidth="1.5" fill="#0891B2" fillOpacity="0.06" />
      {/* Title bar dots */}
      <circle cx="14" cy="15.5" r="1.2" fill="#0891B2" fillOpacity="0.4" />
      <circle cx="18" cy="15.5" r="1.2" fill="#0891B2" fillOpacity="0.25" />
      {/* Prompt arrow */}
      <path d="M14 22L18 25L14 28" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Cursor line */}
      <path d="M21 28H28" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* User: person with speech bubble — voice of the customer */
export function UserAvatar({ size = 36, className = "" }: AvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className}>
      <rect width="44" height="44" rx="14" fill="#ECFDF5" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="13.5" stroke="#059669" strokeOpacity="0.15" />
      {/* Person */}
      <circle cx="19" cy="17" r="4.5" stroke="#059669" strokeWidth="1.8" />
      <path d="M10 32C10 27.5 14 24 19 24C24 24 28 27.5 28 32" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
      {/* Speech bubble */}
      <rect x="26" y="12" width="9" height="7" rx="3" fill="#059669" fillOpacity="0.2" stroke="#059669" strokeWidth="1.2" />
      <path d="M28 19L26 21.5" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" />
      {/* Dots inside bubble */}
      <circle cx="28.8" cy="15.5" r="0.8" fill="#059669" fillOpacity="0.6" />
      <circle cx="31.5" cy="15.5" r="0.8" fill="#059669" fillOpacity="0.6" />
    </svg>
  );
}

/* Competitor: magnifying glass over chart — strategic analysis */
export function CompetitorAvatar({ size = 36, className = "" }: AvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className}>
      <rect width="44" height="44" rx="14" fill="#FFF1F2" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="13.5" stroke="#E11D48" strokeOpacity="0.15" />
      {/* Mini chart bars behind */}
      <rect x="11" y="24" width="3.5" height="8" rx="1" fill="#E11D48" fillOpacity="0.12" />
      <rect x="16.5" y="20" width="3.5" height="12" rx="1" fill="#E11D48" fillOpacity="0.12" />
      <rect x="22" y="22" width="3.5" height="10" rx="1" fill="#E11D48" fillOpacity="0.12" />
      {/* Magnifying glass */}
      <circle cx="24" cy="18" r="7" stroke="#E11D48" strokeWidth="1.8" fill="#FFF1F2" fillOpacity="0.8" />
      <path d="M29 23L33 27" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" />
      {/* Trend line inside glass */}
      <path d="M19 20L22 17L26 19" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Orchestrator: balance scales — fair judgment */
export function OrchestratorAvatar({ size = 36, className = "" }: AvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className}>
      <rect width="44" height="44" rx="14" fill="#F5F3FF" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="13.5" stroke="#7C3AED" strokeOpacity="0.15" />
      {/* Center pole */}
      <path d="M22 12V30" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" />
      {/* Beam */}
      <path d="M12 17H32" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" />
      {/* Top diamond */}
      <circle cx="22" cy="12" r="2" fill="#7C3AED" fillOpacity="0.25" stroke="#7C3AED" strokeWidth="1.2" />
      {/* Left pan */}
      <path d="M12 17L10 24H18L16 17" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#7C3AED" fillOpacity="0.08" />
      {/* Right pan */}
      <path d="M28 17L26 24H34L32 17" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#7C3AED" fillOpacity="0.08" />
      {/* Base */}
      <path d="M18 30H26" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const AGENT_AVATARS: Record<string, React.ComponentType<AvatarProps>> = {
  investor: InvestorAvatar,
  cto: CTOAvatar,
  user_rep: UserAvatar,
  competitor: CompetitorAvatar,
  orchestrator: OrchestratorAvatar,
};
