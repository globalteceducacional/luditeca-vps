import { Alert, Spinner } from 'reactstrap';

/** Estados de carregamento, erro e lista vazia na área `/app`. */
export default function AppStatusBlock({
  loading,
  error,
  empty,
  emptyMessage = 'Nenhum registo disponível.',
  children,
}) {
  if (loading) {
    return (
      <div className="luditeca-app-status text-center py-4">
        <Spinner color="primary" size="sm" className="mr-2" />
        A carregar…
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger" className="luditeca-app-alert shadow-sm">
        {error}
      </Alert>
    );
  }

  if (empty) {
    return <p className="luditeca-app-empty text-muted mb-0">{emptyMessage}</p>;
  }

  return children ?? null;
}
