/**
 * Motor «Escolha sua aventura» — páginas numeradas, ramificações, estado e save/load.
 * Compatível com cenas legadas (`scene_id` / `scene_1`).
 */

export const PAGE_TYPE_INTERACTIVE_META = 'interactive_meta';
export const ENDING_TYPES = ['good', 'bad', 'secret', 'neutral'];

const QUIZ = 'quiz';

export function isQuizPageRow(row) {
  return String(row?.page_type || '').toLowerCase() === QUIZ;
}

export function isInteractiveMetaRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (String(row.page_type || '').toLowerCase() === PAGE_TYPE_INTERACTIVE_META) return true;
  // Legado: bloco meta sem page_type (evita validar como «Página 1» sem escolhas)
  if (getPageId(row) || String(row.scene_id ?? '').trim()) return false;
  return (
    row.version != null ||
    Array.isArray(row.items_catalog) ||
    (Array.isArray(row.characters) && String(row.story_title ?? '').trim())
  );
}

/** Página de história (não quiz, não meta). */
export function isStoryPageRow(row) {
  return row && typeof row === 'object' && !isQuizPageRow(row) && !isInteractiveMetaRow(row);
}

/** ID numérico único da página. */
export function getPageId(page) {
  if (!page || typeof page !== 'object') return null;
  const n = Number(page.page_id);
  if (Number.isFinite(n) && n > 0 && Math.floor(n) === n) return n;

  const sid = String(page.scene_id ?? '').trim();
  const m = /^scene_(\d+)$/i.exec(sid);
  if (m) return Number(m[1]);
  const asNum = Number(sid);
  if (Number.isFinite(asNum) && asNum > 0 && Math.floor(asNum) === asNum) return asNum;
  return null;
}

export function getChoiceTargetPageId(choice) {
  if (!choice || typeof choice !== 'object') return null;
  const n = Number(choice.target_page_id);
  if (Number.isFinite(n) && n > 0) return n;
  const legacy = String(choice.target_scene_id ?? '').trim();
  const m = /^scene_(\d+)$/i.exec(legacy);
  if (m) return Number(m[1]);
  const asNum = Number(legacy);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  return null;
}

export function emptyInteractiveMeta() {
  return {
    page_type: PAGE_TYPE_INTERACTIVE_META,
    version: 1,
    story_title: '',
    characters: [],
    items_catalog: [],
  };
}

export function emptyAdventurePage(pageId, { isFirst = false, isEnding = false, endingType = null } = {}) {
  const id = Number(pageId);
  return {
    page_id: id,
    scene_id: String(id),
    scene_title: '',
    text: '',
    image_url: '',
    choices: [],
    characters: [],
    on_enter: null,
    is_start: isFirst,
    is_ending: isEnding,
    ending_type: isEnding && endingType ? endingType : null,
  };
}

export function emptyChoice() {
  return {
    label: '',
    target_page_id: null,
    target_scene_id: '',
    conditions: null,
    effects: null,
  };
}

/** Atribui `page_id` únicos e sincroniza `scene_id` + destinos das escolhas. */
export function normalizeAdventurePages(pages) {
  const raw = Array.isArray(pages) ? [...pages] : [];
  const meta = raw.find(isInteractiveMetaRow) || null;
  const quizRows = raw.filter(isQuizPageRow);
  let story = raw.filter(isStoryPageRow).map((p) => ({ ...p }));

  const used = new Set();
  story.forEach((page, idx) => {
    let id = getPageId(page);
    if (!id || used.has(id)) {
      id = 1;
      while (used.has(id)) id += 1;
    }
    page.page_id = id;
    page.scene_id = String(id);
    used.add(id);
    if (idx === 0 && !story.some((s) => s.is_start)) page.is_start = true;
  });

  const idSet = new Set(story.map((p) => getPageId(p)).filter((id) => id != null));
  story = story.map((page) => ({
    ...page,
    choices: (Array.isArray(page.choices) ? page.choices : []).map((ch) => {
      const target = getChoiceTargetPageId(ch);
      const valid = target != null && idSet.has(target);
      return {
        ...ch,
        target_page_id: valid ? target : null,
        target_scene_id: valid ? String(target) : '',
      };
    }),
  }));

  const hasStart = story.some((p) => p.is_start);
  if (story.length && !hasStart) {
    story[0].is_start = true;
    for (let i = 1; i < story.length; i += 1) story[i].is_start = false;
  }

  const out = meta ? [meta, ...story, ...quizRows] : [...story, ...quizRows];
  return { pages: out, meta, story };
}

export function extractStoryPages(pages) {
  return normalizeAdventurePages(pages).story;
}

export function extractInteractiveMeta(pages) {
  return normalizeAdventurePages(pages).meta;
}

export function buildPageIndex(storyPages) {
  const map = new Map();
  (Array.isArray(storyPages) ? storyPages : []).forEach((p) => {
    const id = getPageId(p);
    if (id) map.set(id, p);
  });
  return map;
}

export function getStartPageId(storyPages) {
  const list = Array.isArray(storyPages) ? storyPages : [];
  const start = list.find((p) => p.is_start);
  if (start) return getPageId(start);
  return list.length ? getPageId(list[0]) : null;
}

function flagTruthy(flags, key) {
  return Boolean(flags && flags[key]);
}

/** Condições opcionais numa escolha. */
export function choiceMeetsConditions(state, conditions, pageIndex) {
  if (!conditions || typeof conditions !== 'object') return true;
  const flags = state?.flags || {};
  const inv = state?.inventory || [];

  const all = conditions.flags_all || conditions.flags;
  if (all && typeof all === 'object') {
    for (const [k, v] of Object.entries(all)) {
      if (v && !flagTruthy(flags, k)) return false;
    }
  }

  const any = conditions.flags_any;
  if (any && typeof any === 'object') {
    const keys = Object.keys(any).filter((k) => any[k]);
    if (keys.length && !keys.some((k) => flagTruthy(flags, k))) return false;
  }

  const req = conditions.requires_items;
  if (Array.isArray(req) && req.some((item) => !inv.includes(item))) return false;

  const ex = conditions.excludes_items;
  if (Array.isArray(ex) && ex.some((item) => inv.includes(item))) return false;

  const minVisited = Number(conditions.min_visited_page_id);
  if (Number.isFinite(minVisited) && pageIndex && !pageIndex.has(minVisited)) return false;

  return true;
}

function mergeFlags(flags, patch, clearKeys = []) {
  const next = { ...flags };
  if (patch && typeof patch === 'object') {
    for (const [k, v] of Object.entries(patch)) next[k] = Boolean(v);
  }
  if (Array.isArray(clearKeys)) {
    clearKeys.forEach((k) => {
      delete next[k];
    });
  }
  return next;
}

function mergeInventory(inv, { add = [], remove = [] } = {}) {
  const set = new Set(Array.isArray(inv) ? inv : []);
  (Array.isArray(add) ? add : []).forEach((i) => {
    if (i) set.add(String(i));
  });
  (Array.isArray(remove) ? remove : []).forEach((i) => {
    if (i) set.delete(String(i));
  });
  return [...set];
}

export function applyEffects(state, effects) {
  if (!effects || typeof effects !== 'object') return state;
  return {
    ...state,
    flags: mergeFlags(state.flags, effects.set_flags, effects.clear_flags),
    inventory: mergeInventory(state.inventory, {
      add: effects.add_items,
      remove: effects.remove_items,
    }),
  };
}

export function applyPageEnter(state, page) {
  if (!page?.on_enter || typeof page.on_enter !== 'object') return state;
  return applyEffects(state, page.on_enter);
}

export function getAvailableChoices(page, state, pageIndex) {
  const choices = Array.isArray(page?.choices) ? page.choices : [];
  return choices.filter((ch) => {
    const target = getChoiceTargetPageId(ch);
    if (!target || !pageIndex.has(target)) return false;
    return choiceMeetsConditions(state, ch.conditions, pageIndex);
  });
}

export function createInitialRunState(bookId, storyPages) {
  const index = buildPageIndex(storyPages);
  const startId = getStartPageId(storyPages);
  const startPage = startId ? index.get(startId) : null;
  let state = {
    bookId: String(bookId),
    currentPageId: startId,
    flags: {},
    inventory: [],
    history: startId ? [startId] : [],
    visitedPageIds: startId ? [startId] : [],
    savedAt: new Date().toISOString(),
  };
  if (startPage) state = applyPageEnter(state, startPage);
  return state;
}

export function navigateToPage(state, targetPageId, storyPages) {
  const index = buildPageIndex(storyPages);
  const page = index.get(targetPageId);
  if (!page) return state;

  const visited = new Set(state.visitedPageIds || []);
  visited.add(targetPageId);

  let next = {
    ...state,
    currentPageId: targetPageId,
    history: [...(state.history || []), targetPageId],
    visitedPageIds: [...visited],
    savedAt: new Date().toISOString(),
  };
  next = applyPageEnter(next, page);
  return next;
}

export function goBack(state) {
  const hist = [...(state.history || [])];
  if (hist.length < 2) return state;
  hist.pop();
  const prev = hist[hist.length - 1];
  return {
    ...state,
    currentPageId: prev,
    history: hist,
    savedAt: new Date().toISOString(),
  };
}

export function storageKey(bookId) {
  return `luditeca-adventure-${bookId}`;
}

export function saveRunState(bookId, state) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(bookId), JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
  } catch {
    /* ignore quota */
  }
}

export function loadRunState(bookId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(bookId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearRunState(bookId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(bookId));
  } catch {
    /* ignore */
  }
}

export function getPageLabel(page, index = 0) {
  const title = String(page?.scene_title ?? '').trim();
  if (title) return title;
  const id = getPageId(page);
  if (id) return `Página ${id}`;
  return `Página ${index + 1}`;
}

export function endingLabel(endingType) {
  const t = String(endingType || '').toLowerCase();
  if (t === 'good') return 'Final feliz';
  if (t === 'bad') return 'Final infeliz';
  if (t === 'secret') return 'Final secreto';
  if (t === 'neutral') return 'Final';
  return 'Fim da história';
}

/** Validação editorial (CMS). */
export function validateAdventureStory(storyPages, { requireContent = false } = {}) {
  const list = extractStoryPages(storyPages);
  if (!list.length) return { ok: false, error: 'Adicione pelo menos uma página da história.' };

  const index = buildPageIndex(list);
  const ids = [...index.keys()];

  if (ids.length !== list.length) {
    return { ok: false, error: 'IDs de página duplicados. Use números únicos em cada página.' };
  }

  for (const page of list) {
    const id = getPageId(page);
    const label = getPageLabel(page);
    if (requireContent && !String(page.text || '').trim()) {
      return { ok: false, error: `«${label}» precisa de texto de narração.` };
    }
    const choices = Array.isArray(page.choices) ? page.choices : [];
    if (!page.is_ending && choices.length === 0) {
      return {
        ok: false,
        error: `«${label}» não é final e não tem escolhas. Adicione pelo menos uma escolha com destino noutra página.`,
      };
    }
    for (const ch of choices) {
      const target = getChoiceTargetPageId(ch);
      if (!target || !index.has(target)) {
        return { ok: false, error: `Uma escolha em «${label}» aponta para uma página inexistente.` };
      }
    }
    if (page.is_ending && page.ending_type && !ENDING_TYPES.includes(String(page.ending_type))) {
      return { ok: false, error: `«${label}»: tipo de final inválido.` };
    }
  }

  if (list.length > 1 && !list.some((p) => p.is_start)) {
    return { ok: false, error: 'Marque qual página inicia a história.' };
  }

  return { ok: true, story: list };
}
