import { LuditecaAlert } from '../argon/luditeca';
import { AppListGridSkeleton } from '../argon/LuditecaSkeleton';

/**
 * Estados de carregamento, erro e lista vazia na área `/app`.
 * @param {'spinner'|'list'} [loadingVariant] — `list` usa skeleton (Fase 4)
 */
export default function AppStatusBlock({
  loading,
  error,
  empty,
  emptyMessage = 'Nenhum registo disponível.',
  loadingVariant = 'list',
  skeletonCount = 6,
  children,
}) {
  if (loading) {
    if (loadingVariant === 'list') {
      return <AppListGridSkeleton count={skeletonCount} />;
    }
    return (
      <div className="luditeca-app-status text-center py-4 text-luditeca-muted" role="status">
        A carregar…
      </div>
    );
  }

  if (error) {
    return (
      <LuditecaAlert color="danger" className="luditeca-app-alert shadow-sm mb-0">
        {error}
      </LuditecaAlert>
    );
  }

  if (empty) {
    return <p className="luditeca-app-empty text-luditeca-muted mb-0">{emptyMessage}</p>;
  }

  return children ?? null;
}
