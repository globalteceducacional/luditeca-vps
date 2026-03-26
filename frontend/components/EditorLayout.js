/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'default' | 'editor'} [props.variant] — `editor`: viewport fixa sem scroll externo (página de edição de livro)
 */
export default function EditorLayout({ children, variant = 'default' }) {
  const isEditor = variant === 'editor';

  return (
    <div
      className={
        isEditor
          ? 'flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-slate-950 text-slate-200'
          : 'flex min-h-screen bg-slate-50 text-slate-900'
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <main
          className={
            isEditor
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'flex-1 overflow-auto'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
