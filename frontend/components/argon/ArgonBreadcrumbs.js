import Link from 'next/link';

/**
 * Navegação contextual — último item sem link (página atual).
 * @param {{ items: { label: string, href?: string }[] }} props
 */
export default function ArgonBreadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="luditeca-breadcrumbs" aria-label="Navegação">
      <ol className="list-inline mb-0 pl-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="list-inline-item">
              {index > 0 ? (
                <span className="separator" aria-hidden="true">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="luditeca-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'current' : undefined} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
