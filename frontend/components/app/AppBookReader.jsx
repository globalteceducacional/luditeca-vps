import { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { isPagesV2 } from '../../lib/pagesV2/migrate';

function pct(value, total) {
  if (!total || !Number.isFinite(value)) return 0;
  return (value / total) * 100;
}

function AppNode({ node, canvasW, canvasH }) {
  const x = node?.position?.x ?? 0;
  const y = node?.position?.y ?? 0;
  const w = node?.size?.width ?? 120;
  const h = node?.size?.height ?? 40;
  const props = node?.props || {};
  const style = {
    left: `${pct(x, canvasW)}%`,
    top: `${pct(y, canvasH)}%`,
    width: `${pct(w, canvasW)}%`,
    height: `${pct(h, canvasH)}%`,
    transform: node?.rotation ? `rotate(${node.rotation}deg)` : undefined,
    zIndex: node?.zIndex ?? 1,
  };

  if (node.type === 'image') {
    const src = props.content || props.url;
    if (!src) return null;
    return (
      <img
        src={src}
        alt=""
        className="absolute object-contain pointer-events-none"
        style={style}
      />
    );
  }

  if (node.type === 'text') {
    return (
      <div
        className="absolute overflow-hidden pointer-events-none text-luditeca-ink"
        style={{
          ...style,
          fontSize: props.fontSize ? `${Math.max(10, props.fontSize * 0.55)}px` : '14px',
          fontWeight: props.bold ? 'bold' : 'normal',
          fontStyle: props.italic ? 'italic' : 'normal',
          textAlign: props.align || 'left',
          color: props.color || '#0f172a',
        }}
      >
        {props.content || ''}
      </div>
    );
  }

  if (node.type === 'video' && props.content) {
    return (
      <video
        src={props.content}
        poster={props.poster || undefined}
        controls
        className="absolute object-contain"
        style={style}
      />
    );
  }

  return null;
}

function AppPageView({ page, canvas }) {
  const cw = canvas?.width || 1920;
  const ch = canvas?.height || 1080;
  const bg = page?.background?.url;
  const nodes = useMemo(
    () =>
      [...(Array.isArray(page?.nodes) ? page.nodes : [])].sort(
        (a, b) => (a?.zIndex ?? 0) - (b?.zIndex ?? 0),
      ),
    [page?.nodes],
  );

  return (
    <div
      className="relative w-full bg-luditeca-surface rounded-lg overflow-hidden shadow-inner"
      style={{ aspectRatio: `${cw} / ${ch}` }}
    >
      {bg ? (
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-luditeca-primary-50 to-luditeca-subtle" />
      )}
      {nodes.map((node) => (
        <AppNode key={node.id} node={node} canvasW={cw} canvasH={ch} />
      ))}
    </div>
  );
}

/** Leitor somente leitura para `pages_v2` hidratado pela API `/app/books/:id`. */
export default function AppBookReader({ pagesV2 }) {
  const [index, setIndex] = useState(0);

  if (!isPagesV2(pagesV2)) {
    return (
      <p className="text-sm text-luditeca-muted bg-luditeca-primary-50 border border-luditeca-primary-100 rounded-lg p-4">
        Este livro ainda não tem páginas no formato v2.
      </p>
    );
  }

  const pages = pagesV2.pages;
  if (!pages.length) {
    return <p className="text-sm text-luditeca-muted">Livro sem páginas.</p>;
  }

  const safeIndex = Math.min(index, pages.length - 1);
  const page = pages[safeIndex];

  return (
    <div className="space-y-4">
      <AppPageView page={page} canvas={pagesV2.canvas} />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={safeIndex <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="app-btn-nav"
        >
          <FiChevronLeft />
          Anterior
        </button>
        <span className="text-sm text-luditeca-body font-medium">
          {safeIndex + 1} / {pages.length}
        </span>
        <button
          type="button"
          disabled={safeIndex >= pages.length - 1}
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
          className="app-btn-nav"
        >
          Seguinte
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
