/**
 * Helpers do editor interativo (páginas numeradas — «Escolha sua aventura»).
 */

import {
  extractStoryPages,
  getPageId,
  getChoiceTargetPageId,
  getPageLabel,
  isQuizPageRow,
  isInteractiveMetaRow,
  normalizeAdventurePages,
  validateAdventureStory,
} from './interactiveAdventure';

export function nextSceneId(scenes) {
  const list = extractStoryPages(scenes);
  const used = new Set(list.map((s) => getPageId(s)).filter(Boolean));
  let n = list.length + 1;
  while (used.has(n)) n += 1;
  return String(n);
}

export function nextPageId(scenes) {
  const list = extractStoryPages(scenes);
  const used = new Set(list.map((s) => getPageId(s)).filter(Boolean));
  let n = list.length + 1;
  while (used.has(n)) n += 1;
  return n;
}

export function getSceneDisplayLabel(scene, index = 0) {
  return getPageLabel(scene, index);
}

/** Garante page_id únicos, destinos e página inicial. */
export function normalizeInteractiveScenes(scenes) {
  return extractStoryPages(normalizeAdventurePages(scenes).pages);
}

/** Ao remover uma cena, limpa escolhas que apontavam para ela. */
export function remapChoicesAfterSceneRemoval(scenes, removedPageId) {
  const removed = Number(removedPageId) || String(removedPageId || '').trim();
  if (!removed) return scenes;
  return (Array.isArray(scenes) ? scenes : []).map((scene) => {
    if (isQuizPageRow(scene) || isInteractiveMetaRow(scene)) return scene;
    return {
      ...scene,
      choices: (scene.choices || []).map((ch) => {
        const target = getChoiceTargetPageId(ch);
        if (target === removed || String(ch?.target_scene_id) === String(removed)) {
          return { ...ch, target_page_id: null, target_scene_id: '' };
        }
        return ch;
      }),
    };
  });
}

/** Cenas disponíveis como destino de uma escolha (exclui a página actual). */
export function listChoiceDestinationScenes(scenes, currentScene) {
  const currentId = getPageId(currentScene);
  const list = extractStoryPages(Array.isArray(scenes) ? scenes : []);
  return list.filter((s) => {
    const pid = getPageId(s);
    return pid != null && pid !== currentId;
  });
}

/** Validação no cliente antes do submit (mensagens para editores). */
export function validateInteractiveScenesClient(scenes, { requireContent = false } = {}) {
  const raw = Array.isArray(scenes) ? scenes : [];
  if (!extractStoryPages(raw).length && raw.some(isQuizPageRow)) {
    return { ok: false, error: 'Adicione pelo menos uma página além das perguntas de quiz.' };
  }
  return validateAdventureStory(raw, { requireContent });
}

const GRAPH_NODE_W = 148;
const GRAPH_NODE_H = 52;
const GRAPH_GAP_X = 28;
const GRAPH_GAP_Y = 72;

function sceneGraphKey(scene) {
  const pid = getPageId(scene);
  return pid != null ? String(pid) : String(scene?.scene_id ?? '').trim();
}

/**
 * Layout simples (BFS a partir da cena inicial) para desenhar o grafo no CMS.
 */
export function buildInteractiveSceneGraph(scenes) {
  const list = normalizeInteractiveScenes(scenes);
  if (!list.length) {
    return { nodes: [], edges: [], width: 320, height: 120, issues: [] };
  }

  const byId = new Map();
  list.forEach((s, index) => {
    const key = sceneGraphKey(s);
    if (key) byId.set(key, { scene: s, index });
  });

  const startScene = list.find((s) => s.is_start) || list[0];
  const startKey = sceneGraphKey(startScene);
  const depths = new Map();
  const queue = startKey ? [[startKey, 0]] : [];
  const visited = new Set();

  while (queue.length) {
    const [id, depth] = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    depths.set(id, depth);
    const scene = byId.get(id)?.scene;
    if (!scene) continue;
    for (const ch of scene.choices || []) {
      const targetId = getChoiceTargetPageId(ch);
      const target = targetId != null ? String(targetId) : '';
      if (target && byId.has(target) && !visited.has(target)) {
        queue.push([target, depth + 1]);
      }
    }
  }

  list.forEach((s) => {
    const key = sceneGraphKey(s);
    if (key && !depths.has(key)) depths.set(key, 0);
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
    const from = sceneGraphKey(scene);
    if (!from) return;
    (scene.choices || []).forEach((ch, ci) => {
      const targetId = getChoiceTargetPageId(ch);
      const to = targetId != null ? String(targetId) : '';
      if (!to) return;
      edges.push({
        id: `${from}-${ci}-${to}`,
        from,
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
