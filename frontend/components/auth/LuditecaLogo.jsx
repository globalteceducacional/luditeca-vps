import { useId } from 'react';

/**
 * Logótipo Luditeca em SVG (marca + wordmark opcional).
 * @param {'mark' | 'full'} [variant]
 * @param {'sm' | 'md' | 'lg'} [size]
 * @param {'brand' | 'on-dark' | 'auto'} [tone] — `auto` segue tokens do tema
 */
export default function LuditecaLogo({
  variant = 'mark',
  size = 'md',
  tone = 'auto',
  className = '',
  title = 'Luditeca',
}) {
  const gradId = useId().replace(/:/g, '');
  const dim = { sm: 36, md: 48, lg: 64 }[size] || 48;
  const toneClass =
    tone === 'on-dark'
      ? 'luditeca-logo--on-dark'
      : tone === 'brand'
        ? 'luditeca-logo--brand'
        : 'luditeca-logo--auto';

  const mark = (
    <svg
      className="luditeca-logo__mark-svg"
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={variant === 'full'}
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--luditeca-logo-grad-a, #4f46e5)" />
          <stop offset="1" stopColor="var(--luditeca-logo-grad-b, #7c3aed)" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${gradId})`} />
      <path
        d="M14 16.5c0-1.1.9-2 2-2h6.2c.6 0 1.2.3 1.6.8l1.2 1.6c.4.5 1 .8 1.6.8H32c1.1 0 2 .9 2 2v14.5c0 1.1-.9 2-2 2H16c-1.1 0-2-.9-2-2V16.5z"
        fill="rgba(255,255,255,0.95)"
      />
      <path d="M24 14.5v22" stroke="rgba(79,70,229,0.35)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M18 22h4M26 22h4M18 26.5h4M26 26.5h3"
        stroke="rgba(79,70,229,0.45)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="33" cy="15" r="3" fill="#fbbf24" stroke="#fff" strokeWidth="1.25" />
    </svg>
  );

  const sizeClass = `luditeca-logo--size-${size}`;

  if (variant === 'mark') {
    return (
      <span
        className={`luditeca-logo luditeca-logo--mark ${sizeClass} ${toneClass} ${className}`.trim()}
        role="img"
        aria-label={title}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      className={`luditeca-logo luditeca-logo--full ${sizeClass} ${toneClass} ${className}`.trim()}
      role="img"
      aria-label={title}
    >
      {mark}
      <span className="luditeca-logo__wordmark" aria-hidden>
        Luditeca
      </span>
    </span>
  );
}
