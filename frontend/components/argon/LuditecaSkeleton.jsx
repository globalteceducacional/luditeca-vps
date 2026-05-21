import classNames from 'classnames';

/**
 * Bloco skeleton com shimmer (Design System v4).
 * @param {{ className?: string, style?: object, rounded?: boolean, tag?: keyof JSX.IntrinsicElements }} props
 */
export function LuditecaSkeleton({ className, style, rounded = true, tag: Tag = 'div' }) {
  return (
    <Tag
      className={classNames('luditeca-skeleton', rounded && 'luditeca-skeleton-rounded', className)}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Cartão de livro no catálogo CMS. */
export function BookCatalogCardSkeleton() {
  return (
    <div className="card shadow border-0 h-100 luditeca-skeleton-card">
      <LuditecaSkeleton className="luditeca-skeleton-book-cover" rounded={false} />
      <div className="card-body pt-3">
        <div className="d-flex justify-content-between mb-3">
          <LuditecaSkeleton style={{ height: 20, width: '70%' }} />
          <LuditecaSkeleton style={{ height: 18, width: 56 }} />
        </div>
        <LuditecaSkeleton className="mb-2" style={{ height: 14, width: '45%' }} />
        <LuditecaSkeleton className="mb-3" style={{ height: 40, width: '100%' }} />
        <LuditecaSkeleton className="mb-3" style={{ height: 36, width: '100%' }} />
        <div className="d-flex justify-content-between">
          <LuditecaSkeleton style={{ height: 32, width: 72 }} />
          <LuditecaSkeleton style={{ height: 32, width: 72 }} />
        </div>
      </div>
    </div>
  );
}

/** Grelha de cartões do catálogo `/books`. */
export function BookCatalogGridSkeleton({ count = 8 }) {
  return (
    <div className="luditeca-skeleton-grid" aria-busy="true" aria-label="A carregar livros">
      <div className="row">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="col-xl-3 col-lg-4 col-md-6 mb-4">
            <BookCatalogCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Linha da lista infantil `/app/library`. */
export function AppListItemSkeleton() {
  return (
    <li className="luditeca-app-list-card luditeca-skeleton-list-item">
      <LuditecaSkeleton className="luditeca-skeleton-list-thumb" rounded={false} />
      <div className="flex-grow-1 min-w-0 pl-3">
        <LuditecaSkeleton className="mb-2" style={{ height: 18, width: '75%' }} />
        <LuditecaSkeleton className="mb-2" style={{ height: 12, width: '40%' }} />
        <LuditecaSkeleton style={{ height: 14, width: '90%' }} />
      </div>
    </li>
  );
}

export function AppListGridSkeleton({ count = 6 }) {
  return (
    <ul className="luditeca-app-list-grid" aria-busy="true" aria-label="A carregar">
      {Array.from({ length: count }, (_, i) => (
        <AppListItemSkeleton key={i} />
      ))}
    </ul>
  );
}

/** Linhas de tabela CMS (autores, categorias, admin). */
export function TableRowsSkeleton({ rows = 5, cols = 4 }) {
  return (
    <tbody aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <LuditecaSkeleton style={{ height: 14, width: c === 0 ? '80%' : '55%' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default LuditecaSkeleton;
