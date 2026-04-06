import React, { useMemo, useState } from 'react';
import { FiEye, FiEyeOff, FiLock, FiMove, FiUnlock } from 'react-icons/fi';
import { toNum } from '../../../../lib/editorUtils';

function getNodeTypeLabel(node) {
  const type = String(node?.type || '');
  if (type === 'text') return 'Texto';
  if (type === 'image') return 'Imagem';
  if (type === 'video') return 'Video';
  if (type === 'shape') return 'Forma';
  return 'Item';
}

function getNodeTitle(node) {
  if (!node) return 'Elemento';
  const type = String(node?.type || '');
  const content = String(node?.props?.content || '').trim();
  if (type === 'text') {
    return content ? (content.length > 34 ? `${content.slice(0, 34)}...` : content) : 'Texto sem conteudo';
  }
  if (type === 'video') {
    const poster = String(node?.props?.poster || '').trim();
    if (poster) return 'Video com poster';
    return 'Video';
  }
  if (type === 'image' && content) return 'Imagem';
  return getNodeTypeLabel(node);
}

function toggleNodeFlag(node, flagName, onPatchNode) {
  const next = !Boolean(node?.props?.[flagName]);
  onPatchNode?.(node.id, {
    props: {
      ...(node?.props || {}),
      [flagName]: next,
    },
  });
}

export default function LayerManagerPanel({
  nodes = [],
  selectedNodeId,
  onSelectNode,
  onPatchNode,
}) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const list = Array.isArray(nodes) ? nodes : [];
    const byZ = [...list].sort((a, b) => toNum(b?.zIndex, 0) - toNum(a?.zIndex, 0));
    if (!query.trim()) return byZ;
    const q = query.trim().toLowerCase();
    return byZ.filter((node) => {
      const title = getNodeTitle(node).toLowerCase();
      const type = String(node?.type || '').toLowerCase();
      return title.includes(q) || type.includes(q);
    });
  }, [nodes, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-800 text-slate-200">
      <div className="shrink-0 border-b border-slate-700 bg-slate-900 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-200">
            Camadas ({Array.isArray(nodes) ? nodes.length : 0})
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Topo para base
          </div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar camada..."
          className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-500">
            Nenhuma camada encontrada.
          </div>
        ) : (
          sorted.map((node) => {
            const id = String(node?.id || '');
            const selected = String(selectedNodeId || '') === id;
            const hidden = Boolean(node?.props?.hidden);
            const locked = Boolean(node?.props?.locked);
            const zIndex = Math.max(0, Math.trunc(toNum(node?.zIndex, 0)));

            return (
              <div
                key={id}
                className={`rounded border p-2 transition-colors ${
                  selected
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectNode?.(id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-100">
                      {getNodeTitle(node)}
                    </span>
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-200">
                      {getNodeTypeLabel(node)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Camada {zIndex}
                  </div>
                </button>

                <div className="mt-2 grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => toggleNodeFlag(node, 'hidden', onPatchNode)}
                    className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-700"
                    title={hidden ? 'Mostrar camada' : 'Ocultar camada'}
                  >
                    {hidden ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleNodeFlag(node, 'locked', onPatchNode)}
                    className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-700"
                    title={locked ? 'Desbloquear camada' : 'Bloquear camada'}
                  >
                    {locked ? <FiLock size={12} /> : <FiUnlock size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPatchNode?.(id, { zIndex: Math.max(0, zIndex - 1) })}
                    className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-700"
                    title="Descer camada"
                  >
                    <FiMove size={12} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPatchNode?.(id, { zIndex: zIndex + 1 })}
                    className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-700"
                    title="Subir camada"
                  >
                    <FiMove size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
