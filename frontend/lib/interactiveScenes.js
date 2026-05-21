/**
 * Helpers do editor interativo (IDs internos; rótulos amigáveis na UI).
 */

export function nextSceneId(scenes) {
  const list = Array.isArray(scenes) ? scenes : [];
  let n = list.length + 1;
  const used = new Set(list.map((s) => String(s?.scene_id || '').trim()).filter(Boolean));
  while (used.has(`scene_${n}`)) n += 1;
  return `scene_${n}`;
}

export function getSceneDisplayLabel(scene, index = 0) {
  const title = String(scene?.scene_title ?? '').trim();
  if (title) return title;
  const text = String(scene?.text ?? '').trim();
  if (text) return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  return `Cena ${index + 1}`;
}

function isQuizPageRow(row) {
  return String(row?.page_type || '').toLowerCase() === 'quiz';
}

/** Garante IDs únicos e marca a primeira cena como inicial quando há só uma ou nenhuma marcada. */
export function normalizeInteractiveScenes(scenes) {
  const list = (Array.isArray(scenes) ? scenes : [])
    .filter((s) => !isQuizPageRow(s))
    .map((s) => ({ ...s }));
  if (!list.length) return list;

  const used = new Set();
  list.forEach((scene, idx) => {
    let id = String(scene.scene_id ?? '').trim();
    if (!id || used.has(id)) {
      id = nextSceneId(list.slice(0, idx));
      while (used.has(id)) {
        id = `${id}_${idx}`;
      }
    }
    scene.scene_id = id;
    used.add(id);
  });

  const hasStart = list.some((s) => s.is_start);
  if (!hasStart) {
    list[0].is_start = true;
    for (let i = 1; i < list.length; i += 1) list[i].is_start = false;
  }

  return list;
}

/** Ao remover uma cena, limpa escolhas que apontavam para ela. */
export function remapChoicesAfterSceneRemoval(scenes, removedSceneId) {
  const id = String(removedSceneId || '').trim();
  if (!id) return scenes;
  return (Array.isArray(scenes) ? scenes : []).map((scene) => ({
    ...scene,
    choices: (scene.choices || []).map((ch) => {
      if (String(ch?.target_scene_id || '') === id) {
        return { ...ch, target_scene_id: '' };
      }
      return ch;
    }),
  }));
}

/** Validação no cliente antes do submit (mensagens para editores). */
export function validateInteractiveScenesClient(scenes, { requireContent = false } = {}) {
  const raw = Array.isArray(scenes) ? scenes : [];
  const list = normalizeInteractiveScenes(raw);
  if (!list.length && raw.some(isQuizPageRow)) {
    return { ok: false, error: 'Adicione pelo menos uma cena além das perguntas de quiz.' };
  }
  if (!list.length) {
    return { ok: false, error: 'Adicione pelo menos uma cena.' };
  }

  for (let i = 0; i < list.length; i += 1) {
    const scene = list[i];
    const label = getSceneDisplayLabel(scene, i);
    if (requireContent && !String(scene.image_url || '').trim()) {
      return { ok: false, error: `«${label}» precisa de uma imagem.` };
    }
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    for (const ch of choices) {
      const target = String(ch?.target_scene_id || '').trim();
      if (target && !list.some((s) => s.scene_id === target)) {
        return {
          ok: false,
          error: `Uma escolha em «${label}» aponta para uma cena que já não existe.`,
        };
      }
    }
  }

  if (list.length > 1 && !list.some((s) => s.is_start)) {
    return { ok: false, error: 'Marque qual cena inicia a história.' };
  }

  return { ok: true, scenes: list };
}

const GRAPH_NODE_W = 148;
const GRAPH_NODE_H = 52;
const GRAPH_GAP_X = 28;
const GRAPH_GAP_Y = 72;

/**
 * Layout simples (BFS a partir da cena inicial) para desenhar o grafo no CMS.
 */
export function buildInteractiveSceneGraph(scenes) {
  const list = normalizeInteractiveScenes(scenes);
  if (!list.length) {
    return { nodes: [], edges: [], width: 320, height: 120, issues: [] };
  }

  const byId = new Map(list.map((s, index) => [s.scene_id, { scene: s, index }]));
  const startScene = list.find((s) => s.is_start) || list[0];
  const depths = new Map();
  const queue = [[startScene.scene_id, 0]];
  const visited = new Set();

  while (queue.length) {
    const [id, depth] = queue.shift();
    if (!visited.has(id)) {
      visited.add(id);
      depths.set(id, depth);
    }
    const scene = byId.get(id)?.scene;
    if (!scene) continue;
    for (const ch of scene.choices || []) {
      const target = String(ch?.target_scene_id || '').trim();
      if (target && byId.has(target)) queue.push([target, depth + 1]);
    }
  }

  list.forEach((s) => {
    if (!depths.has(s.scene_id)) depths.set(s.scene_id, 0);
  });

  const layerMap = new Map();
  depths.forEach((depth, id) => {
    if (!layerMap.has(depth)) layerMap.set(depth, []);
    layerMap.get(depth).push(id);
  });

  const sortedDepths = [...layerMap.keys()].sort((a, b) => a - b);
  let maxRowWidth = 0;
  sortedDepths.forEach((depth) => {
    const ids = layerMap.get(depth);
    const rowW = ids.length * GRAPH_NODE_W + Math.max(0, ids.length - 1) * GRAPH_GAP_X;
    maxRowWidth = Math.max(maxRowWidth, rowW);
  });

  const nodes = [];
  sortedDepths.forEach((depth) => {
    const ids = layerMap.get(depth);
    const rowW = ids.length * GRAPH_NODE_W + Math.max(0, ids.length - 1) * GRAPH_GAP_X;
    const offsetX = (maxRowWidth - rowW) / 2;
    ids.forEach((id, col) => {
      const meta = byId.get(id);
      const x = offsetX + col * (GRAPH_NODE_W + GRAPH_GAP_X) + GRAPH_NODE_W / 2;
      const y = depth * (GRAPH_NODE_H + GRAPH_GAP_Y) + GRAPH_NODE_H / 2 + 24;
      nodes.push({
        id,
        x,
        y,
        label: getSceneDisplayLabel(meta.scene, meta.index),
        isStart: Boolean(meta.scene.is_start),
        isEnding: Boolean(meta.scene.is_ending),
      });
    });
  });

  const edges = [];
  list.forEach((scene) => {
    (scene.choices || []).forEach((ch, ci) => {
      const to = String(ch?.target_scene_id || '').trim();
      if (!to) return;
      edges.push({
        id: `${scene.scene_id}-${ci}-${to}`,
        from: scene.scene_id,
        to,
        label: String(ch?.label || '').trim() || '→',
        broken: !byId.has(to),
      });
    });
  });

  const maxDepth = sortedDepths.length ? sortedDepths[sortedDepths.length - 1] : 0;
  const height = (maxDepth + 1) * (GRAPH_NODE_H + GRAPH_GAP_Y) + 48;
  const width = Math.max(maxRowWidth + 48, 280);

  const issues = [];
  if (list.length > 1 && !list.some((s) => s.is_start)) {
    issues.push('Nenhuma cena está marcada como início.');
  }
  edges.forEach((e) => {
    if (e.broken) issues.push(`Ligação inválida para «${e.label}».`);
  });

  return { nodes, edges, width, height, issues };
}
