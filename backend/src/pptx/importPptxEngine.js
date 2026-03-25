import fs from 'node:fs/promises';
import path from 'node:path';
import { IncomingForm } from 'formidable';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import jwt from 'jsonwebtoken';
import { buildStorageClient as makeStorageClient } from './storageCompat.mjs';
import { PrismaClient } from '@prisma/client';

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_TOTAL_SIZE = 600 * 1024 * 1024;

/** Mesmo canvas do CMS / app (16:9) */
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

/** Widescreen 16:9 padrão Office (EMU) */
const DEFAULT_SLIDE_CX = 12192000;
const DEFAULT_SLIDE_CY = 6858000;

/** Logs no terminal do Next: dev sempre; produção só com IMPORT_PPTX_DEBUG=1 */
function importDebug(...args) {
  const enabled =
    process.env.NODE_ENV === 'development' ||
    process.env.IMPORT_PPTX_DEBUG === '1';
  if (!enabled) return;
  console.log('[import-pptx-debug]', new Date().toISOString(), ...args);
}

function importDebugError(label, err, extra = {}) {
  const enabled =
    process.env.NODE_ENV === 'development' ||
    process.env.IMPORT_PPTX_DEBUG === '1';
  if (!enabled) return;
  console.error('[import-pptx-debug]', label, {
    message: err?.message,
    name: err?.name,
    code: err?.code,
    statusCode: err?.statusCode,
    ...extra,
    stack: err?.stack,
  });
}

async function parseForm(req) {
  const form = new IncomingForm({
    maxFileSize: MAX_FILE_SIZE,
    maxTotalFileSize: MAX_TOTAL_SIZE,
  });
  // Formidable v3: sem callback retorna Promise<[fields, files]>
  const [fields, files] = await form.parse(req);
  return { fields, files };
}

/** Corpo JSON pequeno (referência a ficheiro já no Storage) — compatível com limite da Vercel. */
function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

const ALLOWED_PPTX_SOURCE_BUCKETS = new Set(['presentations']);
const prisma = new PrismaClient();

function assertBookId(raw) {
  const s = String(raw || '').trim();
  if (!s || !/^\d+$/.test(s) || s.length > 30) {
    throw new Error('Livro inválido para importação.');
  }
  return s;
}

function assertPptxStoragePathForUser(storagePath, userId) {
  const normalized = String(storagePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!normalized.toLowerCase().endsWith('.pptx')) {
    throw new Error('Caminho inválido: é necessário um arquivo .pptx.');
  }
  if (normalized.includes('..')) {
    throw new Error('Caminho de armazenamento inválido.');
  }
  const prefix = `${userId}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error('Caminho de armazenamento não autorizado para este usuário.');
  }
  if (!normalized.includes('/imports/staging/')) {
    throw new Error(
      'Use apenas arquivos enviados para a pasta de importação (staging).',
    );
  }
  return normalized;
}

async function removeStagingImportFile({ supabase, bucket, storagePath }) {
  if (!storagePath || !bucket || !supabase) return;
  try {
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (error) {
      importDebug('remover staging pptx (não bloqueia)', {
        message: error.message,
        path: storagePath,
      });
    }
  } catch (err) {
    importDebug('remover staging pptx exceção', { message: err?.message });
  }
}

function normalizeRels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/** Caminho no ZIP a partir do Target do .rels do slide (relativo ou absoluto OOXML). */
function resolveSlideRelMediaPath(target) {
  const t = String(target || '').trim().replace(/\\/g, '/');
  if (!t) return null;
  if (t.startsWith('/')) {
    return path.posix.normalize(t.replace(/^\/+/, ''));
  }
  return path.posix.normalize(path.posix.join('ppt/slides', t));
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getSlideDimensionsEMU(zip, xmlParser) {
  const file = zip.file('ppt/presentation.xml');
  if (!file) {
    return { cx: DEFAULT_SLIDE_CX, cy: DEFAULT_SLIDE_CY };
  }
  const xml = await file.async('text');
  const parsed = xmlParser.parse(xml);
  const sldSz =
    parsed.presentation?.sldSz ||
    parsed['p:presentation']?.sldSz ||
    parsed['p:presentation']?.['p:sldSz'] ||
    null;
  if (sldSz?.cx != null && sldSz?.cy != null) {
    return { cx: toNum(sldSz.cx, DEFAULT_SLIDE_CX), cy: toNum(sldSz.cy, DEFAULT_SLIDE_CY) };
  }
  return { cx: DEFAULT_SLIDE_CX, cy: DEFAULT_SLIDE_CY };
}

function emuRectToCanvas(offX, offY, extCx, extCy, slideCx, slideCy) {
  const x = (toNum(offX) / slideCx) * CANVAS_WIDTH;
  const y = (toNum(offY) / slideCy) * CANVAS_HEIGHT;
  const w = (toNum(extCx) / slideCx) * CANVAS_WIDTH;
  const h = (toNum(extCy) / slideCy) * CANVAS_HEIGHT;
  return {
    x: Math.round(Math.max(0, x)),
    y: Math.round(Math.max(0, y)),
    width: Math.round(Math.max(40, w)),
    height: Math.round(Math.max(28, h)),
  };
}

function extractTNodeValue(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'number') return String(t);
  if (t['#text'] != null) return String(t['#text']);
  if (Array.isArray(t)) return t.map(extractTNodeValue).join('');
  return '';
}

function paragraphPlainText(p) {
  if (!p) return '';
  const parts = [];
  if (p.r) {
    const runs = Array.isArray(p.r) ? p.r : [p.r];
    runs.forEach((r) => {
      parts.push(extractTNodeValue(r.t));
    });
  }
  if (p.fld) {
    const flds = Array.isArray(p.fld) ? p.fld : [p.fld];
    flds.forEach((f) => {
      parts.push(extractTNodeValue(f.t));
    });
  }
  if (p.br) parts.push('\n');
  return parts.join('');
}

function extractTxBodyPlainText(txBody) {
  if (!txBody?.p) return '';
  const ps = Array.isArray(txBody.p) ? txBody.p : [txBody.p];
  return ps
    .map((p) => paragraphPlainText(p))
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

function extractParagraphDefaultCharStyle(p) {
  const base = {
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    fontFamily: 'Roboto',
  };
  const pPr = p?.pPr;
  if (!pPr) return base;
  let s = { ...base };
  if (pPr.defRPr) s = applyRunCharStyle(s, pPr.defRPr);
  if (pPr.endParaRPr) s = applyRunCharStyle(s, pPr.endParaRPr);
  return s;
}

/** Herança de estilo entre runs (OOXML): só sobrescreve propriedades presentes em rPr. */
function applyRunCharStyle(prev, rPr) {
  const next = { ...prev };
  if (!rPr) return next;
  if (rPr.sz != null) {
    next.fontSize = Math.max(8, Math.round(toNum(rPr.sz, 2400) / 100));
  }
  if (rPr.b !== undefined && rPr.b !== null) {
    next.fontWeight =
      rPr.b === '1' || rPr.b === 1 || rPr.b === true ? 'bold' : 'normal';
  }
  if (rPr.i !== undefined && rPr.i !== null) {
    next.fontStyle =
      rPr.i === '1' || rPr.i === 1 || rPr.i === true ? 'italic' : 'normal';
  }
  const rgb =
    rPr.solidFill?.srgbClr?.val ||
    rPr.solidFill?.['a:srgbClr']?.val ||
    rPr.srgbClr?.val;
  if (rgb) next.color = srgbToHex(rgb);
  const typeface =
    rPr.latin?.typeface ||
    rPr.latin?.['@_typeface'] ||
    rPr.ea?.typeface ||
    rPr.cs?.typeface;
  if (typeface && String(typeface).trim()) {
    next.fontFamily = String(typeface).trim();
  }
  return next;
}

function mergeAdjacentIdenticalSpans(spans) {
  if (!spans?.length) return [];
  const out = [{ ...spans[0] }];
  for (let i = 1; i < spans.length; i++) {
    const cur = spans[i];
    const last = out[out.length - 1];
    if (
      last.fontWeight === cur.fontWeight &&
      last.fontStyle === cur.fontStyle &&
      last.color === cur.color &&
      last.fontSize === cur.fontSize &&
      last.fontFamily === cur.fontFamily
    ) {
      last.text += cur.text;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function paragraphToSpans(p) {
  const parts = [];
  const paraDefault = extractParagraphDefaultCharStyle(p);
  let style = { ...paraDefault };

  const pushFromRun = (r) => {
    style = applyRunCharStyle(style, r?.rPr);
    const text = extractTNodeValue(r?.t);
    if (!text) return;
    parts.push({
      text,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      color: style.color,
      fontFamily: style.fontFamily,
    });
  };

  if (p.r) {
    const runs = Array.isArray(p.r) ? p.r : [p.r];
    runs.forEach(pushFromRun);
  }
  if (p.fld) {
    const flds = Array.isArray(p.fld) ? p.fld : [p.fld];
    flds.forEach((f) => {
      style = applyRunCharStyle(style, f?.rPr);
      const text = extractTNodeValue(f.t);
      if (!text) return;
      parts.push({
        text,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        color: style.color,
        fontFamily: style.fontFamily,
      });
    });
  }

  return mergeAdjacentIdenticalSpans(parts);
}

/**
 * Texto completo + trechos com estilo (negrito por run, etc.).
 */
function extractTxBodyStructured(txBody) {
  if (!txBody?.p) {
    return { plain: '', spans: [], textAlign: 'left' };
  }
  const ps = Array.isArray(txBody.p) ? txBody.p : [txBody.p];
  let textAlign = 'left';
  if (ps[0]?.pPr?.algn) {
    textAlign = mapAlign(ps[0].pPr.algn);
  }

  const mergedParagraphSpans = [];
  let isFirstPara = true;

  for (const p of ps) {
    const lineSpans = paragraphToSpans(p);
    if (!lineSpans.length) continue;
    if (!isFirstPara) {
      const s0 = lineSpans[0];
      mergedParagraphSpans.push({
        text: '\n',
        fontSize: s0.fontSize,
        fontWeight: s0.fontWeight,
        fontStyle: s0.fontStyle,
        color: s0.color,
        fontFamily: s0.fontFamily,
      });
    }
    mergedParagraphSpans.push(...lineSpans);
    isFirstPara = false;
  }

  const spans = mergeAdjacentIdenticalSpans(mergedParagraphSpans);
  const plain = spans.map((s) => s.text).join('');
  return { plain, spans, textAlign };
}

function mapAlign(algn) {
  if (!algn) return 'left';
  const a = String(algn).toLowerCase();
  if (a === 'ctr' || a === 'center') return 'center';
  if (a === 'r' || a === 'right') return 'right';
  return 'left';
}

function srgbToHex(val) {
  if (!val) return '#000000';
  const s = String(val).replace(/^#/, '').trim();
  if (s.length === 6) return `#${s}`;
  if (s.length === 8) return `#${s.slice(2)}`;
  return '#000000';
}

function extractFirstRunStyle(txBody) {
  let fontSize = 24;
  let fontWeight = 'normal';
  let fontStyle = 'normal';
  let color = '#000000';
  let textAlign = 'left';
  let fontFamily = 'Roboto';

  if (!txBody?.p) {
    return { fontSize, fontWeight, fontStyle, color, textAlign, fontFamily };
  }
  const ps = Array.isArray(txBody.p) ? txBody.p : [txBody.p];
  const firstP = ps[0];
  if (firstP?.pPr?.algn) {
    textAlign = mapAlign(firstP.pPr.algn);
  }
  const firstR = firstP?.r
    ? Array.isArray(firstP.r)
      ? firstP.r[0]
      : firstP.r
    : null;
  const rPr = firstR?.rPr;
  if (rPr) {
    if (rPr.sz != null) {
      fontSize = Math.max(8, Math.round(toNum(rPr.sz, 2400) / 100));
    }
    if (rPr.b === '1' || rPr.b === 1 || rPr.b === true) fontWeight = 'bold';
    if (rPr.i === '1' || rPr.i === 1 || rPr.i === true) fontStyle = 'italic';
    const rgb =
      rPr.solidFill?.srgbClr?.val ||
      rPr.solidFill?.['a:srgbClr']?.val ||
      rPr.srgbClr?.val;
    if (rgb) color = srgbToHex(rgb);
    const typeface =
      rPr.latin?.typeface ||
      rPr.latin?.['@_typeface'] ||
      rPr.ea?.typeface ||
      rPr.cs?.typeface;
    if (typeface && String(typeface).trim()) {
      fontFamily = String(typeface).trim();
    }
  }
  return { fontSize, fontWeight, fontStyle, color, textAlign, fontFamily };
}

function collectSpShapes(spTree) {
  const shapes = [];
  if (!spTree) return shapes;
  const visit = (st) => {
    if (!st) return;
    if (st.sp) {
      const list = Array.isArray(st.sp) ? st.sp : [st.sp];
      list.forEach((s) => shapes.push(s));
    }
    if (st.grpSp) {
      const groups = Array.isArray(st.grpSp) ? st.grpSp : [st.grpSp];
      groups.forEach((g) => {
        if (g.spTree) visit(g.spTree);
      });
    }
  };
  visit(spTree);
  return shapes;
}

function getSlideSpTreeRoot(parsed) {
  return (
    parsed.sld?.cSld?.spTree ||
    parsed['p:sld']?.['p:cSld']?.['p:spTree'] ||
    null
  );
}

function parseSlideXmlSafe(slideXml, xmlParser) {
  try {
    return xmlParser.parse(slideXml);
  } catch {
    return null;
  }
}

function spdToDurationMs(spd) {
  if (!spd || typeof spd !== 'string') return 500;
  const s = spd.toLowerCase();
  if (s === 'fast') return 280;
  if (s === 'slow') return 900;
  return 500;
}

/** Mapeia filho de p:transition (OOXML sem prefixo) → tipo canónico */
function mapTransitionChildKey(key) {
  const k = String(key || '').toLowerCase();
  const map = {
    fade: 'fade',
    push: 'push',
    wipe: 'wipe',
    split: 'split',
    pull: 'pull',
    cover: 'cover',
    uncover: 'uncover',
    randombar: 'randomBars',
    blinds: 'blinds',
    checker: 'checker',
    circle: 'circle',
    comb: 'comb',
    cut: 'cut',
    diamond: 'diamond',
    dissolve: 'dissolve',
    newsflash: 'flash',
    plus: 'plus',
    strips: 'strips',
    wedge: 'wedge',
    wheel: 'wheel',
    zoom: 'zoom',
    morph: 'morph',
    reveal: 'reveal',
    flash: 'flash',
    fallover: 'fallOver',
    drape: 'drape',
    curtains: 'curtains',
    prism: 'prism',
    honeycomb: 'honeycomb',
    ripple: 'ripple',
    vortex: 'vortex',
    shreds: 'shreds',
  };
  return map[k] || null;
}

function extractTransitionDirection(val) {
  if (!val || typeof val !== 'object') return null;
  const d = val.dir ?? val['@_dir'];
  return d != null ? String(d).toLowerCase() : null;
}

/**
 * Transição entre slides (separador p:transition no slide XML).
 */
function extractSlideTransitionFromParsed(parsed) {
  const base = { type: 'none', durationMs: 500, direction: null, source: 'pptx' };
  if (!parsed) return base;
  const sld = parsed.sld || parsed['p:sld'];
  if (!sld) return base;
  const tr = sld.transition || sld['p:transition'];
  if (!tr || typeof tr !== 'object') return base;

  const spd = tr.spd || tr['@_spd'];
  const durationMs = spdToDurationMs(spd);
  const reserved = new Set([
    'spd',
    '@_spd',
    'advClick',
    '@_advClick',
    'advTm',
    '@_advTm',
    'dur',
    '@_dur',
  ]);

  const keys = Object.keys(tr).filter((k) => !k.startsWith('@_') && !reserved.has(k));
  for (const key of keys) {
    const val = tr[key];
    if (val === undefined || val === null) continue;
    const type = mapTransitionChildKey(key);
    if (type) {
      const direction =
        typeof val === 'object'
          ? extractTransitionDirection(val)
          : null;
      return { type, durationMs, direction, source: 'pptx', rawType: key };
    }
  }

  return { ...base, durationMs };
}

function findSpTgtSpidDeep(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const id = findSpTgtSpidDeep(item);
      if (id) return id;
    }
    return null;
  }
  const st = node.spTgt || node['p:spTgt'];
  if (st) {
    const o = Array.isArray(st) ? st[0] : st;
    const id = o?.spid ?? o?.['@_spid'];
    if (id != null && id !== '') return String(id);
  }
  for (const v of Object.values(node)) {
    const id = findSpTgtSpidDeep(v);
    if (id) return id;
  }
  return null;
}

const PPTX_FILTER_TO_ANIMATE = {
  fade: 'animate__fadeIn',
  dissolve: 'animate__fadeIn',
  '': 'animate__fadeIn',
  wipe: 'animate__slideInRight',
  plus: 'animate__zoomIn',
  wheel: 'animate__fadeIn',
  circle: 'animate__zoomIn',
  box: 'animate__zoomIn',
  diamond: 'animate__zoomIn',
  newsflash: 'animate__fadeIn',
};

/** presetID com presetClass entr (subset Office) → classe animate.css do CMS/app */
function mapPresetEntrIdToAnimate(presetID) {
  const n = toNum(presetID, -1);
  const table = {
    1: 'animate__fadeIn',
    2: 'animate__fadeIn',
    4: 'animate__fadeInUp',
    5: 'animate__fadeInDown',
    8: 'animate__fadeInLeft',
    9: 'animate__fadeInRight',
    10: 'animate__fadeIn',
    12: 'animate__fadeInUp',
    13: 'animate__fadeIn',
    14: 'animate__slideInRight',
    17: 'animate__zoomIn',
    18: 'animate__zoomIn',
    21: 'animate__zoomIn',
    22: 'animate__zoomIn',
    23: 'animate__bounce',
    24: 'animate__pulse',
    25: 'animate__rubberBand',
    26: 'animate__slideInLeft',
    27: 'animate__slideInRight',
  };
  if (n >= 0 && table[n]) return table[n];
  return 'animate__fadeIn';
}

function walkTimingForAnimations(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walkTimingForAnimations(n, out));
    return;
  }

  if (node.animEffect) {
    const list = Array.isArray(node.animEffect) ? node.animEffect : [node.animEffect];
    list.forEach((ae) => {
      const spid = findSpTgtSpidDeep(ae);
      if (!spid) return;
      const filter = String(ae.filter ?? ae['@_filter'] ?? 'fade').toLowerCase();
      const cls = PPTX_FILTER_TO_ANIMATE[filter] || PPTX_FILTER_TO_ANIMATE.fade;
      if (!out[spid]) out[spid] = cls;
    });
  }

  if (node.anim) {
    const list = Array.isArray(node.anim) ? node.anim : [node.anim];
    list.forEach((an) => {
      const spid = findSpTgtSpidDeep(an);
      if (!spid) return;
      const presetClass = String(an.presetClass ?? an['@_presetClass'] ?? '').toLowerCase();
      if (presetClass !== 'entr' && presetClass !== 'entry') return;
      const presetID = an.presetID ?? an['@_presetID'];
      const cls = mapPresetEntrIdToAnimate(presetID);
      if (!out[spid]) out[spid] = cls;
    });
  }

  for (const v of Object.values(node)) {
    walkTimingForAnimations(v, out);
  }
}

/**
 * Animações de entrada por shape (p:timing no cSld) → spid → classe animate.css
 */
function extractShapeEntranceAnimations(parsed) {
  const out = {};
  if (!parsed) return out;
  const cSld = parsed.sld?.cSld || parsed['p:sld']?.['p:cSld'];
  const timing = cSld?.timing || cSld?.['p:timing'];
  if (!timing) return out;
  walkTimingForAnimations(timing, out);
  return out;
}

function getShapeSpid(sp) {
  const nv = sp.nvSpPr || sp['p:nvSpPr'];
  const cn = nv?.cNvPr || nv?.['p:cNvPr'];
  if (!cn) return null;
  const id = cn.id ?? cn['@_id'];
  if (id == null || id === '') return null;
  return String(id);
}

/**
 * Extrai textos dos shapes (slide já parseado) → elementos compatíveis com o editor.
 * @param {Record<string, string>} shapeAnimBySpid
 */
function buildTextElementsFromParsedSlide(parsed, slideCx, slideCy, slideNumber, idPrefix, shapeAnimBySpid = {}) {
  if (!parsed) return [];
  const spTree = getSlideSpTreeRoot(parsed);
  if (!spTree) return [];

  const shapes = collectSpShapes(spTree);
  const elements = [];
  let z = 1;

  shapes.forEach((sp, idx) => {
    const txBody = sp.txBody;
    if (!txBody) return;
    const structured = extractTxBodyStructured(txBody);
    const content = structured.plain;
    if (!content || !content.trim()) return;

    const xfrm = sp.spPr?.xfrm || sp['p:spPr']?.['p:xfrm'];
    const off = xfrm?.off || xfrm?.['a:off'];
    const ext = xfrm?.ext || xfrm?.['a:ext'];
    if (!off || ext == null) return;

    const ox = off.x ?? off['@_x'];
    const oy = off.y ?? off['@_y'];
    const cx = ext.cx ?? ext['@_cx'];
    const cy = ext.cy ?? ext['@_cy'];
    if (ox == null || oy == null || cx == null || cy == null) return;

    const rect = emuRectToCanvas(ox, oy, cx, cy, slideCx, slideCy);
    const spans = structured.spans;
    const base = spans.length
      ? spans[0]
      : extractFirstRunStyle(txBody);
    const textAlign = structured.textAlign || base.textAlign || 'left';
    const useRichSpans = spans.length > 1;

    const spid = getShapeSpid(sp);
    const entranceAnim =
      spid && shapeAnimBySpid && typeof shapeAnimBySpid === 'object'
        ? shapeAnimBySpid[spid] || ''
        : '';

    elements.push({
      id: `${idPrefix}-txt-${slideNumber}-${idx}-${z}`,
      type: 'text',
      textStyle: 'normal',
      content,
      ...(useRichSpans
        ? {
            contentSpans: spans.map((s) => ({
              text: s.text,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              fontStyle: s.fontStyle,
              color: s.color,
              fontFamily: s.fontFamily,
            })),
          }
        : {}),
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
      animation: entranceAnim,
      step: 0,
      zIndex: z,
      fontSize: base.fontSize,
      fontFamily: base.fontFamily || 'Roboto',
      fontWeight: base.fontWeight,
      fontStyle: base.fontStyle,
      textAlign,
      color: base.color,
    });
    z += 1;
  });

  return elements;
}

function getMimeFromExtension(ext) {
  const lower = ext.toLowerCase();
  if (lower === '.jpg' || lower === '.jpeg') return 'image/jpeg';
  if (lower === '.png') return 'image/png';
  if (lower === '.gif') return 'image/gif';
  if (lower === '.webp') return 'image/webp';
  if (lower === '.bmp') return 'image/bmp';
  if (lower === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function buildStorageClient(req) {
  return makeStorageClient();
}

async function getUserIdFromRequest(req) {
  const authHeader = (req.headers.authorization || '').trim();
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado.');
    }
    const payload = jwt.verify(token, secret);
    const sub = payload.sub;
    if (!sub) {
      throw new Error('Token inválido.');
    }
    importDebug('auth OK', { userId: sub });
    return sub;
  } catch (e) {
    importDebugError('getUser JWT falhou', e);
    throw new Error('Não foi possível validar o usuário. Faça login novamente.');
  }
}

async function uploadSlideImage({ supabase, userId, bookId, importStamp, slideNumber, fileName, binary }) {
  const extension = path.extname(fileName || '.png') || '.png';
  const cleanExtension = extension.toLowerCase();
  const targetPath = `${userId}/books/${bookId}/imports/${importStamp}/slide-${String(slideNumber).padStart(3, '0')}${cleanExtension}`;
  const contentType = getMimeFromExtension(cleanExtension);

  const body =
    binary instanceof Buffer ? new Uint8Array(binary) : binary;

  const { error: uploadError } = await supabase.storage
    .from('pages')
    .upload(targetPath, body, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (uploadError) {
    importDebugError(`storage upload slide ${slideNumber}`, uploadError, {
      targetPath,
      contentType,
      bytes: body?.length ?? binary?.length,
      supabaseError: JSON.stringify(uploadError),
    });
    throw new Error(`Falha ao subir slide ${slideNumber}: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from('pages').getPublicUrl(targetPath);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    throw new Error(`Não foi possível gerar URL pública do slide ${slideNumber}.`);
  }

  const { error: metadataError } = await supabase.from('media_files').insert({
    user_id: userId,
    file_path: targetPath,
    file_name: path.basename(targetPath),
    file_type: contentType,
    file_size: binary.length,
    bucket_name: 'pages',
    created_at: new Date().toISOString(),
  });
  if (metadataError) {
    importDebug('media_files insert ignorado (não bloqueia)', {
      message: metadataError.message,
      code: metadataError.code,
      details: metadataError.details,
      hint: metadataError.hint,
    });
  }

  return {
    slideNumber,
    targetPath,
    publicUrl,
  };
}

function buildWarningPage({ slideNumber, reason, elements = [], idStamp, transition }) {
  const stamp = idStamp ?? Date.now();
  return {
    id: `${stamp}-warn-${slideNumber}`,
    background: '',
    elements: Array.isArray(elements) ? elements : [],
    orientation: 'landscape',
    needsAdjustment: true,
    adjustmentReason: reason,
    sourceSlide: slideNumber,
    transition:
      transition || {
        type: 'none',
        durationMs: 500,
        direction: null,
        source: 'pptx',
      },
  };
}

async function uploadOriginalPptx({ supabase, userId, bookId, importStamp, fileName, binary }) {
  const safeFileName = fileName || `book-${bookId}.pptx`;
  const targetPath = `${userId}/books/${bookId}/imports/${importStamp}/${safeFileName}`;

  const body =
    binary instanceof Buffer ? new Uint8Array(binary) : binary;

  const { error } = await supabase.storage
    .from('presentations')
    .upload(targetPath, body, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

  if (error) {
    importDebug('upload presentations bucket (opcional) falhou — segue sem .pptx no storage', {
      message: error.message,
      path: targetPath,
      full: JSON.stringify(error),
    });
    return null;
  }

  const { data: urlData } = supabase.storage.from('presentations').getPublicUrl(targetPath);
  return {
    path: targetPath,
    publicUrl: urlData?.publicUrl || null,
  };
}

export async function runImportPptxEngine(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  importDebug('POST recebido', {
    hasAuth: Boolean((req.headers.authorization || '').trim()),
    contentType: req.headers['content-type']?.slice(0, 80),
  });

  try {
    const authUserId = await getUserIdFromRequest(req);
    const userId = authUserId;

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const isJsonBody = contentType.includes('application/json');

    let bookId = 'temp-book';
    let dryRun = false;
    let fileBuffer;
    let originalName = '';
    /** Caminho no Storage a remover após sucesso (upload via cliente). */
    let stagingPathToRemove = null;
    let stagingBucket = null;

    if (isJsonBody) {
      importDebug('parse JSON (referência ao Storage)…');
      const body = await readRequestJson(req);
      bookId = assertBookId(body.bookId);
      dryRun = String(body.dryRun || '').toLowerCase() === 'true';
      const bucket = String(body.bucket || 'presentations');
      if (!ALLOWED_PPTX_SOURCE_BUCKETS.has(bucket)) {
        res.status(400).json({ error: 'Bucket de origem não permitido.' });
        return;
      }
      let storagePath;
      try {
        storagePath = assertPptxStoragePathForUser(body.storagePath, userId);
      } catch (pathErr) {
        res.status(400).json({ error: pathErr.message || 'Caminho inválido.' });
        return;
      }

      const supabaseDl = buildStorageClient(req);
      importDebug('download PPTX do Storage', { bucket, storagePath });
      const { data: blob, error: dlError } = await supabaseDl.storage
        .from(bucket)
        .download(storagePath);

      if (dlError || !blob) {
        importDebugError('download staging pptx', dlError || new Error('sem blob'));
        res.status(400).json({
          error:
            dlError?.message ||
            'Não foi possível baixar o arquivo do armazenamento. Confirme o upload e as políticas do bucket.',
        });
        return;
      }

      const ab = await blob.arrayBuffer();
      fileBuffer = Buffer.from(ab);
      stagingPathToRemove = storagePath;
      stagingBucket = bucket;
      originalName = path.posix.basename(storagePath);

      if (fileBuffer.length > MAX_FILE_SIZE) {
        res.status(400).json({ error: 'Arquivo muito grande. Limite de 500MB.' });
        return;
      }

      importDebug('buffer do Storage', { bytes: fileBuffer.length, originalName });
    } else {
      importDebug('parse multipart…');
      const { fields, files } = await parseForm(req);
      importDebug('parse OK', {
        fieldKeys: Object.keys(fields || {}),
        fileKeys: Object.keys(files || {}),
      });

      const rawFile = Array.isArray(files.file) ? files.file[0] : files.file;
      const rawBookId = Array.isArray(fields.bookId)
        ? fields.bookId[0]
        : fields.bookId;
      const rawDryRun = Array.isArray(fields.dryRun)
        ? fields.dryRun[0]
        : fields.dryRun;
      dryRun = String(rawDryRun || '').toLowerCase() === 'true';
      bookId = assertBookId(rawBookId);

      if (!rawFile) {
        importDebug('erro: nenhum files.file', { files });
        res.status(400).json({ error: 'Arquivo .pptx não enviado.' });
        return;
      }

      importDebug('arquivo temporário', {
        originalFilename: rawFile.originalFilename,
        newFilename: rawFile.newFilename,
        filepath: rawFile.filepath,
        size: rawFile.size,
        mimetype: rawFile.mimetype,
      });

      originalName = rawFile.originalFilename || '';
      if (!originalName.toLowerCase().endsWith('.pptx')) {
        res.status(400).json({ error: 'Arquivo inválido. Envie um .pptx.' });
        return;
      }

      if (rawFile.size > MAX_FILE_SIZE) {
        res.status(400).json({ error: 'Arquivo muito grande. Limite de 500MB.' });
        return;
      }

      fileBuffer = await fs.readFile(rawFile.filepath);
      importDebug('buffer lido', { bytes: fileBuffer.length });
    }

    // Valida existência do livro antes de processar (evita path estranho e import em livro inexistente).
    const exists = await prisma.book.findUnique({
      where: { id: BigInt(bookId) },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: 'Livro não encontrado para importação.' });
      return;
    }

    const zip = await JSZip.loadAsync(fileBuffer);
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      // Preserva espaços em <a:t xml:space="preserve"> (senão "Dedicado " + "a" vira "Dedicadoa")
      trimValues: false,
    });

    const slideXmlPaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        const bNum = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        return aNum - bNum;
      });

    if (!slideXmlPaths.length) {
      importDebug('erro: zip sem ppt/slides/slide*.xml');
      res.status(400).json({ error: 'Não foi possível encontrar slides no arquivo PPTX.' });
      return;
    }

    importDebug('slides XML encontrados', {
      count: slideXmlPaths.length,
      first: slideXmlPaths[0],
      last: slideXmlPaths[slideXmlPaths.length - 1],
    });

    const uploadedSlides = [];
    const discoveredSlides = [];
    const warnings = [];

    let supabase = null;
    const importStamp = Date.now();
    if (!dryRun) {
      supabase = buildStorageClient(req);
      importDebug('upload .pptx original (opcional)…', { bookId, importStamp });
      await uploadOriginalPptx({
        supabase,
        userId,
        bookId,
        importStamp,
        fileName: originalName,
        binary: fileBuffer,
      });
    }

    const { cx: slideCx, cy: slideCy } = await getSlideDimensionsEMU(zip, xmlParser);
    importDebug('dimensões do slide (EMU)', { slideCx, slideCy });

    importDebug(
      dryRun ? 'dryRun: só detecta slides' : 'iniciando upload de imagens por slide',
      { bookId, importStamp, dryRun },
    );

    /** @type {{ slideNumber: number, fileName: string|null, fileSize: number, textCount: number }[]} */
    const slideSummaries = [];
    /** @type {{ slideNumber: number, uploaded: object|null, textElements: object[], uploadWarning: object|null, transition: object }[]} */
    const slidePayloads = [];

    for (const slideXmlPath of slideXmlPaths) {
      const slideNumber = parseInt(slideXmlPath.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      if (!slideNumber) continue;

      const slideFile = zip.file(slideXmlPath);
      if (!slideFile) continue;
      const slideXml = await slideFile.async('text');
      const parsedSlide = parseSlideXmlSafe(slideXml, xmlParser);
      const slideTransition = extractSlideTransitionFromParsed(parsedSlide);
      const shapeAnimBySpid = extractShapeEntranceAnimations(parsedSlide);
      const textElements = buildTextElementsFromParsedSlide(
        parsedSlide,
        slideCx,
        slideCy,
        slideNumber,
        String(importStamp),
        shapeAnimBySpid,
      );

      const relPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
      const relFile = zip.file(relPath);
      let binary = null;
      let chosenName = null;

      if (relFile) {
        const relXml = await relFile.async('text');
        const relData = xmlParser.parse(relXml);
        const relationships = normalizeRels(relData?.Relationships?.Relationship);
        const imageRels = relationships.filter(
          (rel) => typeof rel?.Type === 'string' && rel.Type.includes('/image') && rel.Target,
        );

        let bestSize = 0;
        for (const rel of imageRels) {
          const normalizedTarget = resolveSlideRelMediaPath(rel.Target);
          if (!normalizedTarget) continue;
          const mediaFile = zip.file(normalizedTarget);
          if (!mediaFile) continue;
          const buf = Buffer.from(await mediaFile.async('uint8array'));
          if (buf.length >= bestSize) {
            bestSize = buf.length;
            binary = buf;
            chosenName = path.posix.basename(normalizedTarget);
          }
        }
      }

      if (!binary && textElements.length === 0) {
        importDebug(`slide ${slideNumber}: ignorado (sem imagem nem texto)`);
        continue;
      }

      const summary = {
        slideNumber,
        fileName: chosenName,
        fileSize: binary ? binary.length : 0,
        textCount: textElements.length,
      };
      slideSummaries.push(summary);
      discoveredSlides.push({
        slideNumber,
        fileName: chosenName || 'sem-imagem',
        fileSize: binary ? binary.length : 0,
      });

      if (dryRun) {
        continue;
      }

      let uploaded = null;
      let uploadWarning = null;

      if (binary) {
        importDebug(`slide ${slideNumber}: upload imagem`, {
          fileName: chosenName,
          bytes: binary.length,
          textos: textElements.length,
        });
        try {
          uploaded = await uploadSlideImage({
            supabase,
            userId,
            bookId,
            importStamp,
            slideNumber,
            fileName: chosenName || `slide-${slideNumber}.png`,
            binary,
          });
          uploadedSlides.push(uploaded);
        } catch (slideError) {
          uploadWarning = {
            slideNumber,
            fileName: chosenName,
            error: slideError?.message || 'Falha desconhecida no upload do slide',
          };
          warnings.push(uploadWarning);
          importDebug('slide com aviso (continua importação)', uploadWarning);
        }
      } else {
        importDebug(`slide ${slideNumber}: só texto (sem imagem de fundo)`, {
          textos: textElements.length,
        });
      }

      slidePayloads.push({
        slideNumber,
        uploaded,
        textElements,
        uploadWarning,
        transition: slideTransition,
      });
    }

    importDebug('loop slides concluído', {
      summaries: slideSummaries.length,
      uploaded: uploadedSlides.length,
      warnings: warnings.length,
      dryRun,
    });

    if (dryRun) {
      await removeStagingImportFile({
        supabase: buildStorageClient(req),
        bucket: stagingBucket,
        storagePath: stagingPathToRemove,
      });
      res.status(200).json({
        dryRun: true,
        totalSlidesDetected: slideSummaries.length,
        slides: slideSummaries,
        message: `Dry-run concluído com ${slideSummaries.length} slides detectados.`,
      });
      return;
    }

    if (!slidePayloads.length) {
      importDebug('erro 422: nenhum slide com conteúdo');
      res.status(422).json({
        error:
          'Nenhum slide com imagem ou texto foi encontrado. Verifique o arquivo PPTX.',
      });
      return;
    }

    slidePayloads.sort((a, b) => a.slideNumber - b.slideNumber);

    const pages = [];
    for (const payload of slidePayloads) {
      const { slideNumber, uploaded, textElements, uploadWarning, transition } = payload;
      const transitionMeta = transition || {
        type: 'none',
        durationMs: 500,
        direction: null,
        source: 'pptx',
      };

      if (uploaded) {
        pages.push({
          id: `${importStamp}-slide-${slideNumber}`,
          background: {
            url: uploaded.publicUrl,
            position: { x: 0.5, y: 0.5 },
            scale: 1,
          },
          elements: textElements,
          orientation: 'landscape',
          sourceSlide: slideNumber,
          transition: transitionMeta,
          ...(uploadWarning
            ? {
                needsAdjustment: true,
                adjustmentReason: uploadWarning.error,
              }
            : {}),
        });
        continue;
      }

      if (uploadWarning) {
        pages.push(
          buildWarningPage({
            slideNumber,
            reason: uploadWarning.error,
            elements: textElements,
            idStamp: importStamp,
            transition: transitionMeta,
          }),
        );
        continue;
      }

      pages.push({
        id: `${importStamp}-slide-${slideNumber}-textonly`,
        background: '',
        elements: textElements,
        orientation: 'landscape',
        sourceSlide: slideNumber,
        transition: transitionMeta,
      });
    }

    importDebug('sucesso', {
      pagesCount: pages.length,
      slidesComImagem: uploadedSlides.length,
      warnings: warnings.length,
      pagesJsonApproxBytes: JSON.stringify(pages).length,
    });

    await removeStagingImportFile({
      supabase: buildStorageClient(req),
      bucket: stagingBucket,
      storagePath: stagingPathToRemove,
    });

    res.status(200).json({
      pages,
      warnings,
      totalSlides: pages.length,
      totalSlidesWithImage: uploadedSlides.length,
      totalSlidesWithWarning: warnings.length,
      message:
        warnings.length > 0
          ? `Importação parcial: ${pages.length} página(s), ${uploadedSlides.length} com fundo enviado e ${warnings.length} com aviso.`
          : `Importação concluída com ${pages.length} página(s).`,
    });
  } catch (error) {
    console.error('[import-pptx]', error);
    importDebugError('catch final', error, {
      cause: error?.cause,
    });
    const message =
      error?.message || 'Erro interno ao processar o arquivo PPTX.';
    const isAuth =
      /login|autentica|Token|Sessão|usuário/i.test(message) ||
      message.includes('JWT');
    const status = isAuth ? 401 : 500;
    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && error?.stack
        ? { stack: error.stack }
        : {}),
    });
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
process.on('exit', () => {
  void prisma.$disconnect();
});
