function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isPagesV2(v) {
  if (!v || typeof v !== 'object') return false;
  return v.version === 2 && v.canvas && Array.isArray(v.pages);
}

/** Converte spans vindos do import PPTX (por pedaço) para richSpans do editor (intervalos no texto). */
function legacyContentSpansToRichSpans(content, contentSpans) {
  const full = String(content ?? '');
  const spans = Array.isArray(contentSpans) ? contentSpans : [];
  let pos = 0;
  const out = [];
  for (const s of spans) {
    const t = String(s?.text ?? '');
    const start = pos;
    const end = pos + t.length;
    pos = end;
    const w = s?.fontWeight;
    const bold =
      w === true ||
      w === 'bold' ||
      w === 'bolder' ||
      (typeof w === 'number' && w >= 600) ||
      (typeof w === 'string' && /^\d+$/.test(w) && Number(w) >= 600);
    const italic = s?.fontStyle === 'italic' || s?.fontStyle === 'oblique';
    const underline = Boolean(s?.underline);
    if (bold || italic || underline) {
      out.push({
        start,
        end,
        ...(bold ? { bold: true } : {}),
        ...(italic ? { italic: true } : {}),
        ...(underline ? { underline: true } : {}),
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeBg(bg) {
  if (!bg) return null;
  if (typeof bg === 'string') return bg.trim() ? { url: bg.trim() } : null;
  if (typeof bg === 'object') {
    const url = typeof bg.url === 'string' ? bg.url : '';
    const position =
      bg.position && typeof bg.position === 'object'
        ? { x: toNum(bg.position.x, 0.5), y: toNum(bg.position.y, 0.5) }
        : undefined;
    const scale = bg.scale != null ? toNum(bg.scale, 1) : undefined;
    const storage = bg.storage != null ? bg.storage : undefined;
    const mediaKind = typeof bg.mediaKind === 'string' ? bg.mediaKind : undefined;
    if (!url && !storage) return null;
    return {
      url,
      ...(position ? { position } : {}),
      ...(scale ? { scale } : {}),
      ...(storage ? { storage } : {}),
      ...(mediaKind ? { mediaKind } : {}),
    };
  }
  return null;
}

function normalizeNodes(elements) {
  const els = Array.isArray(elements) ? elements : [];
  return els.map((el, idx) => {
    const id = String(el?.id || `el-${Date.now()}-${idx}`);
    const type = String(el?.type || 'unknown');
    const x = toNum(el?.position?.x, 0);
    const y = toNum(el?.position?.y, 0);
    const width = toNum(el?.size?.width, 120);
    const hRaw = el?.size?.height;
    const height = typeof hRaw === 'string' ? 40 : toNum(hRaw, type === 'text' ? 40 : 120);
    const rotation = toNum(el?.rotation, 0);
    const zIndex = toNum(el?.zIndex, idx + 1);
    const step = toNum(el?.step, 0);

    const contentStr = el?.content ?? '';
    const richFromLegacy = Array.isArray(el?.richSpans) ? el.richSpans : undefined;
    const richFromImport =
      type === 'text' && el?.contentSpans
        ? legacyContentSpansToRichSpans(contentStr, el.contentSpans)
        : undefined;
    const richSpans = richFromLegacy ?? richFromImport;

    return {
      id,
      type,
      transform: { x, y, width, height, rotation },
      zIndex,
      step,
      animation: el?.animation ?? undefined,
      props: {
        content: contentStr,
        fontSize: el?.fontSize,
        fontFamily: el?.fontFamily,
        fontWeight: el?.fontWeight,
        fontStyle: el?.fontStyle,
        textAlign: el?.textAlign,
        color: el?.color,
        lineHeight: el?.lineHeight,
        letterSpacing: el?.letterSpacing,
        textDecoration: el?.textDecoration,
        imageStyle: el?.imageStyle,
        mediaKind: el?.mediaKind,
        storage: el?.storage,
        shapeProperties: el?.shapeProperties,
        audio: el?.audio,
        ...(richSpans ? { richSpans } : {}),
      },
      legacy: el,
    };
  });
}

export function migratePagesLegacyToV2(legacy, opts = {}) {
  const width = opts.canvasWidth ?? 1280;
  const height = opts.canvasHeight ?? 720;
  const pagesArr = Array.isArray(legacy) ? legacy : [];

  return {
    version: 2,
    canvas: { width, height },
    pages: pagesArr.map((p, idx) => {
      const id = String(p?.id || `page-${Date.now()}-${idx}`);
      const background = normalizeBg(p?.background);
      const nodes = normalizeNodes(p?.elements);
      const meta = {};
      if (p?.orientation) meta.orientation = p.orientation;
      if (p?.sourceSlide != null) meta.sourceSlide = p.sourceSlide;
      if (p?.transition != null) meta.transition = p.transition;
      if (p?.needsAdjustment != null) meta.needsAdjustment = p.needsAdjustment;
      if (p?.adjustmentReason != null) meta.adjustmentReason = p.adjustmentReason;
      return { id, background, nodes, meta };
    }),
  };
}

export function migratePagesV2ToLegacy(v2) {
  if (!isPagesV2(v2)) return [];
  const pages = Array.isArray(v2.pages) ? v2.pages : [];
  return pages.map((p, pIdx) => {
    const nodes = Array.isArray(p?.nodes) ? p.nodes : [];
    const elements = nodes.map((n, nIdx) => {
      const t = n?.transform || {};
      const props = n?.props || {};
      return {
        id: String(n?.id || `el-${pIdx}-${nIdx}`),
        type: String(n?.type || 'shape'),
        content: props?.content ?? '',
        position: { x: toNum(t.x, 0), y: toNum(t.y, 0) },
        size: {
          width: toNum(t.width, 120),
          height: toNum(t.height, n?.type === 'text' ? 40 : 120),
        },
        rotation: toNum(t.rotation, 0),
        zIndex: toNum(n?.zIndex, nIdx + 1),
        step: toNum(n?.step, 0),
        animation: n?.animation ?? undefined,
        fontSize: props?.fontSize,
        fontFamily: props?.fontFamily,
        fontWeight: props?.fontWeight,
        fontStyle: props?.fontStyle,
        textAlign: props?.textAlign,
        color: props?.color,
        lineHeight: props?.lineHeight,
        letterSpacing: props?.letterSpacing,
        textDecoration: props?.textDecoration,
        imageStyle: props?.imageStyle,
        mediaKind: props?.mediaKind,
        storage: props?.storage,
        shapeProperties: props?.shapeProperties,
        audio: props?.audio,
        ...(Array.isArray(props?.richSpans) && props.richSpans.length
          ? { richSpans: props.richSpans }
          : {}),
      };
    });
    return {
      id: String(p?.id || `page-${pIdx + 1}`),
      background: p?.background || '',
      elements,
      orientation: p?.meta?.orientation || 'landscape',
      sourceSlide: p?.meta?.sourceSlide,
      transition: p?.meta?.transition,
      needsAdjustment: p?.meta?.needsAdjustment,
      adjustmentReason: p?.meta?.adjustmentReason,
    };
  });
}

