type IconProps = { active?: boolean };

function color(active?: boolean) {
  return active ? "var(--gold)" : "var(--text-dim)";
}

export function NestIcon({ active }: IconProps) {
  const c = color(active);
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 16.5c0-4.1 3.6-7.3 8-7.3s8 3.2 8 7.3" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="12" cy="10" rx="3.1" ry="4" fill={c} />
    </svg>
  );
}

export function VaultIcon({ active }: IconProps) {
  const c = color(active);
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke={c} strokeWidth="2" />
      <circle cx="12" cy="12" r="2.3" stroke={c} strokeWidth="2" />
      <path d="M12 9.7v.7M12 13.6v.7" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function RiftIcon({ active }: IconProps) {
  const c = color(active);
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7.2" stroke={c} strokeWidth="2" />
      <circle cx="12" cy="12" r="3.4" stroke={c} strokeWidth="2" />
      <circle cx="12" cy="12" r="1.1" fill={c} />
    </svg>
  );
}

export function ArenaIcon({ active }: IconProps) {
  const c = color(active);
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke={c} strokeWidth="1.5" opacity="0.5" />
      <path d="M7 7l10 10M17 7L7 17" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
