type LegacyElement = {
  id?: string;
  type?: string;
  content?: unknown;
  position?: { x?: number; y?: number };
  size?: { width?: number; height?: number | string };
  rotation?: number;
  zIndex?: number;
  step?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  imageStyle?: unknown;
  shapeProperties?: unknown;
  audio?: unknown;
  [k: string]: unknown;
};

type LegacyPage = {
  id?: string;
  background?: unknown;
  elements?: LegacyElement[];
  orientation?: string;
  sourceSlide?: number;
  transition?: unknown;
  needsAdjustment?: boolean;
  adjustmentReason?: string;
  [k: string]: unknown;
};

export type PagesV2 = {
  version: 2;
  canvas: { width: number; height: number };
  pages: Array<{
    id: string;
    background: {
      url: string;
      position?: { x: number; y: number };
      scale?: number;
      storage?: unknown;
    } | null;
    nodes: Array<Record<string, unknown>>;
    meta?: Record<string, unknown>;
  }>;
};

export function isPagesV2(v: unknown): v is PagesV2 {
  if (!v || typeof v !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o: any = v;
  return o.version === 2 && o.canvas && Array.isArray(o.pages);
}

function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBg(bg: unknown): PagesV2['pages'][number]['background'] {
  if (!bg) return null;
  if (typeof bg === 'string') {
    return bg.trim() ? { url: bg.trim() } : null;
  }
  if (typeof bg === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = bg;
    const url = typeof b.url === 'string' ? b.url : '';
    const pos =
      b.position && typeof b.position === 'object'
        ? { x: toNum(b.position.x, 0.5), y: toNum(b.position.y, 0.5) }
        : undefined;
    const scale = b.scale != null ? toNum(b.scale, 1) : undefined;
    const storage = b.storage != null ? b.storage : undefined;
    if (!url && !storage) return null;
    return { url, ...(pos ? { position: pos } : {}), ...(scale ? { scale } : {}), ...(storage ? { storage } : {}) };
  }
  return null;
}

function normalizeNodes(elements: LegacyElement[] | undefined) {
  const els = Array.isArray(elements) ? elements : [];
  return els.map((el, idx) => {
    const id = String(el?.id || `el-${Date.now()}-${idx}`);
    const type = String(el?.type || 'unknown');
    const x = toNum(el?.position?.x, 0);
    const y = toNum(el?.position?.y, 0);
    const width = toNum(el?.size?.width, 120);
    const hRaw = el?.size?.height;
    const height =
      typeof hRaw === 'string'
        ? 40
        : toNum(hRaw, type === 'text' ? 40 : 120);
    const rotation = toNum(el?.rotation, 0);
    const zIndex = toNum(el?.zIndex, idx + 1);
    const step = toNum(el?.step, 0);

    return {
      id,
      type,
      transform: { x, y, width, height, rotation },
      zIndex,
      step,
      props: {
        content: el?.content ?? '',
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
      },
      legacy: el,
    };
  });
}

export function migratePagesLegacyToV2(
  legacy: unknown,
  opts: { canvasWidth?: number; canvasHeight?: number } = {},
): PagesV2 {
  const width = opts.canvasWidth ?? 1280;
  const height = opts.canvasHeight ?? 720;

  const pagesArr: LegacyPage[] = Array.isArray(legacy) ? (legacy as LegacyPage[]) : [];
  const outPages: PagesV2['pages'] = pagesArr.map((p, idx) => {
    const id = String(p?.id || `page-${Date.now()}-${idx}`);
    const background = normalizeBg(p?.background);
    const nodes = normalizeNodes(p?.elements);
    const meta: Record<string, unknown> = {};
    if (p?.orientation) meta.orientation = p.orientation;
    if (p?.sourceSlide != null) meta.sourceSlide = p.sourceSlide;
    if (p?.transition != null) meta.transition = p.transition;
    if (p?.needsAdjustment != null) meta.needsAdjustment = p.needsAdjustment;
    if (p?.adjustmentReason != null) meta.adjustmentReason = p.adjustmentReason;
    return { id, background, nodes, meta };
  });

  return {
    version: 2,
    canvas: { width, height },
    pages: outPages,
  };
}

