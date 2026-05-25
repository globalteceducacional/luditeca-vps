/**
 * Ilustração decorativa do painel de autenticação (livros, leitura, app).
 */
export default function AuthHeroIllustration({ className = '' }) {
  return (
    <svg
      className={`luditeca-auth-illustration ${className}`.trim()}
      viewBox="0 0 360 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="280" cy="240" rx="120" ry="28" fill="rgba(255,255,255,0.12)" />
      <g opacity="0.9">
        <rect x="48" y="88" width="88" height="112" rx="10" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
        <rect x="56" y="96" width="72" height="8" rx="4" fill="rgba(255,255,255,0.55)" />
        <rect x="56" y="112" width="56" height="6" rx="3" fill="rgba(255,255,255,0.35)" />
        <rect x="56" y="124" width="64" height="6" rx="3" fill="rgba(255,255,255,0.35)" />
        <rect x="56" y="136" width="48" height="6" rx="3" fill="rgba(255,255,255,0.35)" />
        <circle cx="120" cy="108" r="14" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
        <path d="M114 108l4 4 8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g opacity="0.85">
        <rect x="128" y="72" width="96" height="128" rx="12" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <path d="M176 72v128" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <rect x="140" y="92" width="52" height="6" rx="3" fill="rgba(255,255,255,0.5)" />
        <rect x="188" y="92" width="24" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
        <rect x="140" y="108" width="40" height="5" rx="2.5" fill="rgba(255,255,255,0.35)" />
        <rect x="188" y="108" width="28" height="5" rx="2.5" fill="rgba(255,255,255,0.35)" />
        <rect x="140" y="122" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.35)" />
        <rect x="140" y="148" width="72" height="36" rx="8" fill="rgba(124,58,237,0.35)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <circle cx="176" cy="166" r="10" fill="rgba(255,255,255,0.5)" />
        <path d="M172 166l3 3 7-7" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" />
      </g>
      <g opacity="0.75">
        <rect x="232" y="96" width="80" height="104" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.38)" strokeWidth="2" />
        <path d="M252 120h40M252 136h32M252 152h36" stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="300" cy="64" r="6" fill="#fde68a" opacity="0.9" />
      <circle cx="32" cy="48" r="4" fill="#fff" opacity="0.5" />
      <circle cx="318" cy="120" r="3" fill="#fff" opacity="0.4" />
      <path
        d="M200 48c12-8 28-6 36 4s4 26-8 34"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
      />
    </svg>
  );
}
