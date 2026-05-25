import { useMemo, useState } from 'react';
import { Button } from 'reactstrap';
import { buildInteractiveSceneGraph } from '../../../lib/interactiveScenes';

function truncate(str, max = 22) {
  const s = String(str || '').trim();
  if (s.length <= max) return s || '—';
  return `${s.slice(0, max)}…`;
}

export default function InteractiveSceneGraph({ pages = [] }) {
  const [open, setOpen] = useState(false);
  const graph = useMemo(
    () => (open ? buildInteractiveSceneGraph(pages) : null),
    [open, pages],
  );

  if (!open) {
    return (
      <div className="mb-3">
        <Button color="secondary" outline size="sm" type="button" onClick={() => setOpen(true)}>
          Ver grafo visual
        </Button>
      </div>
    );
  }

  if (!graph?.nodes.length) return null;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="mb-3">
      <Button color="secondary" outline size="sm" type="button" onClick={() => setOpen(false)}>
        Ocultar grafo visual
      </Button>
      {open ? (
        <div className="mt-2 p-2 border rounded bg-white overflow-auto">
          <svg
            width={graph.width}
            height={graph.height}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
            role="img"
            aria-label="Grafo das cenas interativas"
            style={{ minWidth: graph.width, display: 'block' }}
          >
            <defs>
              <marker
                id="scene-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#8898aa" />
              </marker>
            </defs>
            {graph.edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const stroke = edge.broken ? '#f5365c' : '#8898aa';
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={edge.id}>
                  <line
                    x1={from.x}
                    y1={from.y + 26}
                    x2={to.x}
                    y2={to.y - 26}
                    stroke={stroke}
                    strokeWidth="1.5"
                    markerEnd="url(#scene-arrow)"
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fontSize="10"
                    fill={stroke}
                    className="font-weight-bold"
                  >
                    {truncate(edge.label, 16)}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const rx = node.x - 74;
              const ry = node.y - 26;
              const fill = node.isStart ? '#d4edda' : node.isEnding ? '#e9ecef' : '#f8f9fe';
              const stroke = node.isStart ? '#2dce89' : node.isEnding ? '#8898aa' : '#5e72e4';
              return (
                <g key={node.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={148}
                    height={52}
                    rx="8"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1.5"
                  />
                  <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#32325d">
                    {truncate(node.label, 18)}
                  </text>
                  <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize="9" fill="#8898aa">
                    {node.isStart ? 'Início' : node.isEnding ? 'Final' : 'Cena'}
                  </text>
                </g>
              );
            })}
          </svg>
          {graph.issues.length ? (
            <p className="small text-warning mb-0 mt-2">{graph.issues.join(' ')}</p>
          ) : (
            <p className="small text-success mb-0 mt-2">Grafo sem ligações quebradas.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
