import Link from 'next/link';

/** Cartão de secção na home `/app` — accent: primary | success | info | warning | danger */
export default function AppHubCard({ href, title, description, icon: Icon, accent = 'primary' }) {
  return (
    <Link href={href} className={`luditeca-app-hub-card luditeca-app-accent-${accent}`}>
      <span className="luditeca-app-hub-card-bar" aria-hidden />
      <span className="luditeca-app-hub-card-body">
        <span className={`luditeca-app-hub-icon icon-shape icon-shape-${accent}`}>
          <Icon size={22} />
        </span>
        <span className="luditeca-app-hub-text">
          <span className="luditeca-app-hub-title">{title}</span>
          <span className="luditeca-app-hub-desc">{description}</span>
        </span>
      </span>
    </Link>
  );
}
