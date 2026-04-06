import fs from 'node:fs/promises';
import path from 'node:path';
import { IncomingForm } from 'formidable';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import jwt from 'jsonwebtoken';
import { buildStorageClient as makeStorageClient } from './storageCompat.mjs';
import { PrismaClient } from '@prisma/client';
import { presignedGetUrl } from '../lib/s3.js';
import crypto from 'node:crypto';

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

const prisma = new PrismaClient();

// Import PPTX aceita apenas multipart/form-data (upload direto do browser).
// Para imports feitos antes de o livro existir (ex.: `books/new`), o frontend envia um `bookId` temporário.
// O backend usa `bookId` apenas para compor caminhos no storage e gerar IDs no payload.
function normalizeBookId(raw) {
  const s = String(raw || 'temp-book').trim();
  if (!s) return 'temp-book';

  // Remove caracteres que poderiam quebrar paths; mantém strings legíveis.
  const cleaned = s.replace(/[\\/]/g, '_').replace(/[^\w.-]/g, '_');
  // Limite de tamanho para evitar keys absurdamente grandes.
  return cleaned.length > 60 ? cleaned.slice(0, 60) : cleaned;
}

function makeImportSessionId() {
  // URL-safe-ish: usamos base64url sem padding
  return crypto.randomBytes(12).toString('base64url');
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

function readUnderlineFromRPr(rPr) {
  if (!rPr || rPr.u == null) return undefined;
  const u = rPr.u;
  if (u === false || u === 0 || u === '0') return 'none';
  if (typeof u === 'object') {
    const val = u.val ?? u['@_val'];
    if (val === 'none' || val === 'noUnderline') return 'none';
    return 'underline';
  }
  const s = String(u).toLowerCase();
  if (s === 'none' || s === 'false') return 'none';
  return 'underline';
}

function extractParagraphDefaultCharStyle(p) {
  const base = {
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    fontFamily: 'Roboto',
    textDecoration: 'none',
    opacity: 1,
    strokeColor: undefined,
    strokeWidth: 0,
    shadowColor: undefined,
    shadowBlur: 0,
    shadowOpacity: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  const pPr = p?.pPr;
  if (!pPr) return base;
  let s = { ...base };
  if (pPr.defRPr) s = applyRunCharStyle(s, pPr.defRPr);
  if (pPr.endParaRPr) s = applyRunCharStyle(s, pPr.endParaRPr);
  return s;
}

function parsePctAlphaToOpacity(alphaVal) {
  const n = Number(alphaVal);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n / 100000));
}

function emuToPx(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 9525;
}

function readColorWithAlpha(fillNode) {
  const srgb = fillNode?.srgbClr || fillNode?.['a:srgbClr'];
  const val = srgb?.val || srgb?.['@_val'];
  const alphaRaw = srgb?.alpha?.val || srgb?.alpha?.['@_val'];
  const opacity = parsePctAlphaToOpacity(alphaRaw);
  return {
    color: val ? srgbToHex(val) : null,
    opacity,
  };
}

function parseTextStrokeFromRPr(rPr) {
  const ln = rPr?.ln || rPr?.['a:ln'];
  if (!ln || ln.noFill !== undefined) return null;
  const { color } = readColorWithAlpha(ln.solidFill || ln);
  const w = Number(ln.w ?? ln['@_w']);
  if (!Number.isFinite(w) || w <= 0) {
    if (!color) return null;
    return { strokeColor: color, strokeWidth: 1 };
  }
  const strokeWidth = Math.max(0, Math.round((w / 12700) * 1.333 * 100) / 100);
  return {
    strokeColor: color || '#000000',
    strokeWidth,
  };
}

function parseTextShadowFromRPr(rPr) {
  const outer =
    rPr?.effectLst?.outerShdw ||
    rPr?.effectLst?.['a:outerShdw'] ||
    rPr?.['a:effectLst']?.outerShdw ||
    rPr?.['a:effectLst']?.['a:outerShdw'] ||
    null;
  if (!outer) return null;

  const { color, opacity } = readColorWithAlpha(outer);
  const blur = emuToPx(outer.blurRad ?? outer['@_blurRad']);
  const dist = emuToPx(outer.dist ?? outer['@_dist']);
  const dirRaw = Number(outer.dir ?? outer['@_dir']);
  const dirDeg = Number.isFinite(dirRaw) ? dirRaw / 60000 : 270;
  const rad = (dirDeg * Math.PI) / 180;
  return {
    shadowColor: color || '#000000',
    shadowBlur: Math.max(0, Math.round(blur * 100) / 100),
    shadowOpacity: opacity != null ? opacity : 0.35,
    shadowOffsetX: Math.round(Math.cos(rad) * dist * 100) / 100,
    shadowOffsetY: Math.round(Math.sin(rad) * dist * 100) / 100,
  };
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
  const alphaRaw =
    rPr.solidFill?.srgbClr?.alpha?.val ||
    rPr.solidFill?.srgbClr?.alpha?.['@_val'] ||
    rPr.solidFill?.['a:srgbClr']?.alpha?.val ||
    rPr.solidFill?.['a:srgbClr']?.alpha?.['@_val'];
  const opacity = parsePctAlphaToOpacity(alphaRaw);
  if (opacity != null) next.opacity = opacity;
  const typeface =
    rPr.latin?.typeface ||
    rPr.latin?.['@_typeface'] ||
    rPr.ea?.typeface ||
    rPr.cs?.typeface;
  if (typeface && String(typeface).trim()) {
    next.fontFamily = String(typeface).trim();
  }
  const und = readUnderlineFromRPr(rPr);
  if (und !== undefined) {
    next.textDecoration = und === 'underline' ? 'underline' : 'none';
  }
  const stroke = parseTextStrokeFromRPr(rPr);
  if (stroke) {
    next.strokeColor = stroke.strokeColor;
    next.strokeWidth = stroke.strokeWidth;
  }
  const shadow = parseTextShadowFromRPr(rPr);
  if (shadow) {
    next.shadowColor = shadow.shadowColor;
    next.shadowBlur = shadow.shadowBlur;
    next.shadowOpacity = shadow.shadowOpacity;
    next.shadowOffsetX = shadow.shadowOffsetX;
    next.shadowOffsetY = shadow.shadowOffsetY;
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
      last.fontFamily === cur.fontFamily &&
      Boolean(last.underline) === Boolean(cur.underline) &&
      (last.opacity ?? 1) === (cur.opacity ?? 1) &&
      (last.strokeColor || '') === (cur.strokeColor || '') &&
      (last.strokeWidth || 0) === (cur.strokeWidth || 0) &&
      (last.shadowColor || '') === (cur.shadowColor || '') &&
      (last.shadowBlur || 0) === (cur.shadowBlur || 0) &&
      (last.shadowOpacity || 0) === (cur.shadowOpacity || 0) &&
      (last.shadowOffsetX || 0) === (cur.shadowOffsetX || 0) &&
      (last.shadowOffsetY || 0) === (cur.shadowOffsetY || 0)
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
      underline: style.textDecoration === 'underline',
      opacity: style.opacity,
      strokeColor: style.strokeColor,
      strokeWidth: style.strokeWidth,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
      shadowOpacity: style.shadowOpacity,
      shadowOffsetX: style.shadowOffsetX,
      shadowOffsetY: style.shadowOffsetY,
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
        underline: style.textDecoration === 'underline',
        opacity: style.opacity,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        shadowColor: style.shadowColor,
        shadowBlur: style.shadowBlur,
        shadowOpacity: style.shadowOpacity,
        shadowOffsetX: style.shadowOffsetX,
        shadowOffsetY: style.shadowOffsetY,
      });
    });
  }

  // Quebras manuais dentro do mesmo parágrafo (Shift+Enter no PPTX).
  if (p.br) {
    const breaks = Array.isArray(p.br) ? p.br.length : 1;
    for (let i = 0; i < breaks; i += 1) {
      parts.push({
        text: '\n',
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        color: style.color,
        fontFamily: style.fontFamily,
        underline: style.textDecoration === 'underline',
        opacity: style.opacity,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        shadowColor: style.shadowColor,
        shadowBlur: style.shadowBlur,
        shadowOpacity: style.shadowOpacity,
        shadowOffsetX: style.shadowOffsetX,
        shadowOffsetY: style.shadowOffsetY,
      });
    }
  }

  return mergeAdjacentIdenticalSpans(parts);
}

function spansToRichSpans(contentSpans) {
  const spans = Array.isArray(contentSpans) ? contentSpans : [];
  const out = [];
  let pos = 0;
  for (const s of spans) {
    const text = String(s?.text ?? '');
    const start = pos;
    const end = pos + text.length;
    pos = end;
    const weight = s?.fontWeight;
    const bold =
      weight === true ||
      weight === 'bold' ||
      weight === 'bolder' ||
      (typeof weight === 'number' && weight >= 600) ||
      (typeof weight === 'string' && /^\d+$/.test(weight) && Number(weight) >= 600);
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
  return out;
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
        opacity: s0.opacity,
        strokeColor: s0.strokeColor,
        strokeWidth: s0.strokeWidth,
        shadowColor: s0.shadowColor,
        shadowBlur: s0.shadowBlur,
        shadowOpacity: s0.shadowOpacity,
        shadowOffsetX: s0.shadowOffsetX,
        shadowOffsetY: s0.shadowOffsetY,
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
  if (!txBody?.p) {
    return {
      fontSize: 24,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      textAlign: 'left',
      fontFamily: 'Roboto',
      opacity: 1,
      strokeColor: undefined,
      strokeWidth: 0,
      shadowColor: undefined,
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };
  }
  const ps = Array.isArray(txBody.p) ? txBody.p : [txBody.p];
  const firstP = ps[0];
  let style = extractParagraphDefaultCharStyle(firstP);
  let textAlign = 'left';
  if (firstP?.pPr?.algn) {
    textAlign = mapAlign(firstP.pPr.algn);
  }
  const firstR = firstP?.r
    ? Array.isArray(firstP.r)
      ? firstP.r[0]
      : firstP.r
    : null;
  style = applyRunCharStyle(style, firstR?.rPr);
  return {
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    textAlign,
    fontFamily: style.fontFamily,
    opacity: style.opacity,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    shadowColor: style.shadowColor,
    shadowBlur: style.shadowBlur,
    shadowOpacity: style.shadowOpacity,
    shadowOffsetX: style.shadowOffsetX,
    shadowOffsetY: style.shadowOffsetY,
  };
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

function normalizeDurationMs(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(200, Math.min(4000, Math.round(n)));
}

function normalizeTransitionTypeForRuntime(type) {
  const t = String(type || '').toLowerCase();
  if (!t || t === 'none') return 'none';
  const supported = new Set([
    'esmaecer',
    'fade',
    'dissolve',
    'push',
    'reveal',
    'wipe',
    'cover',
    'uncover',
    'shreds',
    'split',
    'zoom',
    'morph',
    'flash',
  ]);
  if (supported.has(t)) return t;
  const fallbackMap = {
    pull: 'push',
    newsflash: 'flash',
    randombars: 'dissolve',
    blinds: 'wipe',
    checker: 'dissolve',
    circle: 'zoom',
    comb: 'wipe',
    cut: 'fade',
    diamond: 'zoom',
    plus: 'zoom',
    strips: 'wipe',
    wedge: 'wipe',
    wheel: 'dissolve',
    fallover: 'zoom',
    drape: 'wipe',
    curtains: 'wipe',
    prism: 'zoom',
    honeycomb: 'dissolve',
    ripple: 'dissolve',
    vortex: 'zoom',
    // "esmaecer" é alias explícito para fade no runtime antigo.
    esmaecer: 'fade',
  };
  return fallbackMap[t] || 'fade';
}

function normalizePptxFontFamily(fontFamily, themeFonts = null) {
  const raw = String(fontFamily || '').trim();
  if (!raw) return 'Roboto';
  const lower = raw.toLowerCase();
  if (lower === '+mn-lt' || lower === '+mn-ea' || lower === '+mn-cs') {
    return themeFonts?.minorLatin || 'Roboto';
  }
  if (lower === '+mj-lt' || lower === '+mj-ea' || lower === '+mj-cs') {
    return themeFonts?.majorLatin || 'Roboto';
  }
  if (raw.startsWith('+')) {
    return themeFonts?.minorLatin || 'Roboto';
  }
  return raw;
}

async function extractThemeFonts(zip, xmlParser) {
  const out = { majorLatin: 'Roboto', minorLatin: 'Roboto' };
  const themeFile = zip.file('ppt/theme/theme1.xml');
  if (!themeFile) return out;
  try {
    const xml = await themeFile.async('text');
    const parsed = xmlParser.parse(xml);
    const theme =
      parsed?.theme ||
      parsed?.['a:theme'] ||
      null;
    const fontScheme =
      theme?.themeElements?.fontScheme ||
      theme?.['a:themeElements']?.['a:fontScheme'] ||
      null;
    const majorLatin =
      fontScheme?.majorFont?.latin?.typeface ||
      fontScheme?.majorFont?.latin?.['@_typeface'] ||
      fontScheme?.['a:majorFont']?.['a:latin']?.typeface ||
      null;
    const minorLatin =
      fontScheme?.minorFont?.latin?.typeface ||
      fontScheme?.minorFont?.latin?.['@_typeface'] ||
      fontScheme?.['a:minorFont']?.['a:latin']?.typeface ||
      null;
    if (majorLatin && String(majorLatin).trim()) {
      out.majorLatin = String(majorLatin).trim();
    }
    if (minorLatin && String(minorLatin).trim()) {
      out.minorLatin = String(minorLatin).trim();
    }
  } catch {
    // Mantém fallback padrão se falhar leitura do tema.
  }
  return out;
}

function normalizeTextElementsFonts(elements, themeFonts) {
  return (Array.isArray(elements) ? elements : []).map((el) => {
    if (String(el?.type || '') !== 'text') return el;
    const next = { ...el };
    next.fontFamily = normalizePptxFontFamily(el?.fontFamily, themeFonts);
    if (Array.isArray(el?.contentSpans)) {
      next.contentSpans = el.contentSpans.map((s) => ({
        ...s,
        fontFamily: normalizePptxFontFamily(s?.fontFamily, themeFonts),
      }));
    }
    return next;
  });
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

function findTransitionNodeDeep(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findTransitionNodeDeep(item);
      if (hit) return hit;
    }
    return null;
  }
  if (node.transition != null) return node.transition;
  if (node['p:transition'] != null) return node['p:transition'];
  for (const value of Object.values(node)) {
    const hit = findTransitionNodeDeep(value);
    if (hit) return hit;
  }
  return null;
}

/**
 * Transição entre slides (separador p:transition no slide XML).
 */
function extractSlideTransitionFromParsed(parsed) {
  const base = { type: 'none', durationMs: 500, direction: null, source: 'pptx' };
  if (!parsed) return base;
  const sld = parsed.sld || parsed['p:sld'];
  if (!sld) return base;
  const tr = sld.transition || sld['p:transition'] || findTransitionNodeDeep(sld);
  if (!tr || typeof tr !== 'object') return base;

  const spd = tr.spd || tr['@_spd'];
  const durRaw = tr.dur ?? tr['@_dur'];
  const durationMs = normalizeDurationMs(durRaw) ?? spdToDurationMs(spd);
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
      return {
        type: normalizeTransitionTypeForRuntime(type),
        durationMs,
        direction,
        source: 'pptx',
        via: 'child',
        rawType: key,
      };
    }
  }

  // Alguns geradores (ou conversões) expõem tipo como atributo sem child explícito.
  // Ex.: <p:transition type="fade" .../> ou <p:transition val="push" .../>
  const attrTypeRaw =
    tr.type ??
    tr['@_type'] ??
    tr.val ??
    tr['@_val'] ??
    null;
  if (attrTypeRaw != null) {
    const mapped = normalizeTransitionTypeForRuntime(String(attrTypeRaw));
    if (mapped && mapped !== 'none') {
      return {
        type: mapped,
        durationMs,
        direction: extractTransitionDirection(tr),
        source: 'pptx',
        via: 'attr',
        rawType: String(attrTypeRaw),
      };
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
  // OOXML padrão: p:timing é filho direto de p:sld (irmão de p:cSld).
  // Mantemos fallback para variações não padrão em cSld.
  const sld = parsed.sld || parsed['p:sld'];
  const cSld = sld?.cSld || sld?.['p:cSld'];
  const timing =
    sld?.timing ||
    sld?.['p:timing'] ||
    cSld?.timing ||
    cSld?.['p:timing'];
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

function emuRotationToDegrees(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 60000) * 100) / 100;
}

function emuLineWidthToPx(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // 1pt = 12700 EMU e ~1.333px em 96dpi.
  const pt = n / 12700;
  return Math.max(0, Math.round(pt * 1.333));
}

function parseFillFromSpPr(spPr) {
  if (!spPr || typeof spPr !== 'object') return null;
  if (spPr.noFill !== undefined) return 'transparent';
  const rgb =
    spPr.solidFill?.srgbClr?.val ||
    spPr.solidFill?.['a:srgbClr']?.val ||
    spPr.srgbClr?.val;
  if (rgb) return srgbToHex(rgb);
  return null;
}

function parseStrokeFromSpPr(spPr) {
  if (!spPr || typeof spPr !== 'object') return { borderColor: '#0d0d0d', borderWidth: 0 };
  const ln = spPr.ln || spPr['a:ln'];
  if (!ln || ln.noFill !== undefined) return { borderColor: '#0d0d0d', borderWidth: 0 };
  const rgb =
    ln.solidFill?.srgbClr?.val ||
    ln.solidFill?.['a:srgbClr']?.val ||
    ln.srgbClr?.val;
  const borderColor = rgb ? srgbToHex(rgb) : '#0d0d0d';
  const borderWidth = emuLineWidthToPx(ln.w ?? ln['@_w']);
  return { borderColor, borderWidth };
}

function mapPptxShapeType(prst) {
  const t = String(prst || '').toLowerCase();
  if (t.includes('ellipse') || t.includes('circle')) return 'circle';
  if (t.includes('triangle')) return 'triangle';
  if (t.includes('star')) return 'star';
  if (t.includes('arrow')) return 'arrow';
  if (t.includes('line')) return 'line';
  return 'rectangle';
}

function pushIgnoredItem(collector, item) {
  if (!Array.isArray(collector)) return;
  collector.push({
    slideNumber: item?.slideNumber ?? 0,
    category: item?.category || 'unknown',
    reason: item?.reason || 'unspecified',
    details: item?.details || {},
  });
}

function buildShapeElementsFromParsedSlide(
  parsed,
  slideCx,
  slideCy,
  slideNumber,
  idPrefix,
  shapeAnimBySpid = {},
  ignoredItems = [],
) {
  if (!parsed) return [];
  const spTree = getSlideSpTreeRoot(parsed);
  if (!spTree) return [];
  const shapes = collectSpShapes(spTree);
  const out = [];

  shapes.forEach((sp, idx) => {
    const spPr = sp.spPr || sp['p:spPr'];
    const xfrm = spPr?.xfrm || spPr?.['a:xfrm'] || sp['xfrm'];
    const off = xfrm?.off || xfrm?.['a:off'];
    const ext = xfrm?.ext || xfrm?.['a:ext'];
    if (!off || !ext) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'shape',
        reason: 'missing_transform',
        details: { index: idx },
      });
      return;
    }
    const ox = off.x ?? off['@_x'];
    const oy = off.y ?? off['@_y'];
    const cx = ext.cx ?? ext['@_cx'];
    const cy = ext.cy ?? ext['@_cy'];
    if (ox == null || oy == null || cx == null || cy == null) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'shape',
        reason: 'missing_dimensions',
        details: { index: idx },
      });
      return;
    }

    const rect = emuRectToCanvas(ox, oy, cx, cy, slideCx, slideCy);
    const fill = parseFillFromSpPr(spPr);
    const { borderColor, borderWidth } = parseStrokeFromSpPr(spPr);
    const hasVisibleShape = (fill && fill !== 'transparent') || borderWidth > 0;
    if (!hasVisibleShape) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'shape',
        reason: 'invisible_shape_no_fill_or_stroke',
        details: { index: idx },
      });
      return;
    }

    const prst =
      spPr?.prstGeom?.prst ||
      spPr?.prstGeom?.['@_prst'] ||
      spPr?.['a:prstGeom']?.prst ||
      'rect';
    const hasText = Boolean(sp.txBody);
    const shapeType = mapPptxShapeType(prst);
    const rotation = emuRotationToDegrees(xfrm?.rot ?? xfrm?.['@_rot']);
    const flipX = Boolean(xfrm?.flipH ?? xfrm?.['@_flipH']);
    const spid = getShapeSpid(sp);
    const entranceAnim =
      spid && shapeAnimBySpid && typeof shapeAnimBySpid === 'object'
        ? shapeAnimBySpid[spid] || ''
        : '';
    const structuredText = hasText ? extractTxBodyStructured(sp.txBody) : null;
    const shapeText = structuredText?.plain ? String(structuredText.plain).trim() : '';
    const shapeTextBase = hasText ? extractFirstRunStyle(sp.txBody) : null;
    const shapeTextSpansPayload =
      structuredText?.spans?.length
        ? structuredText.spans.map((s) => ({
            text: s.text,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            fontStyle: s.fontStyle,
            color: s.color,
            fontFamily: s.fontFamily,
            underline: Boolean(s.underline),
            opacity: s.opacity,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            shadowColor: s.shadowColor,
            shadowBlur: s.shadowBlur,
            shadowOpacity: s.shadowOpacity,
            shadowOffsetX: s.shadowOffsetX,
            shadowOffsetY: s.shadowOffsetY,
          }))
        : null;
    const shapeTextRichSpans =
      shapeTextSpansPayload && shapeTextSpansPayload.length
        ? spansToRichSpans(shapeTextSpansPayload)
        : [];

    out.push({
      id: `${idPrefix}-shp-${slideNumber}-${idx}`,
      type: 'shape',
      ...(shapeText
        ? {
            content: shapeText,
            ...(shapeTextSpansPayload ? { contentSpans: shapeTextSpansPayload } : {}),
            ...(shapeTextRichSpans.length ? { richSpans: shapeTextRichSpans } : {}),
            fontSize: shapeTextBase?.fontSize,
            fontFamily: shapeTextBase?.fontFamily,
            fontWeight: shapeTextBase?.fontWeight,
            fontStyle: shapeTextBase?.fontStyle,
            textAlign: structuredText?.textAlign || shapeTextBase?.textAlign || 'center',
            color: shapeTextBase?.color || '#111111',
            lineHeight: 1.2,
            ...(shapeTextBase?.opacity != null ? { opacity: shapeTextBase.opacity } : {}),
            ...(shapeTextBase?.strokeColor ? { strokeColor: shapeTextBase.strokeColor } : {}),
            ...(shapeTextBase?.strokeWidth ? { strokeWidth: shapeTextBase.strokeWidth } : {}),
            ...(shapeTextBase?.shadowColor ? { shadowColor: shapeTextBase.shadowColor } : {}),
            ...(shapeTextBase?.shadowBlur ? { shadowBlur: shapeTextBase.shadowBlur } : {}),
            ...(shapeTextBase?.shadowOpacity != null
              ? { shadowOpacity: shapeTextBase.shadowOpacity }
              : {}),
            ...(shapeTextBase?.shadowOffsetX ? { shadowOffsetX: shapeTextBase.shadowOffsetX } : {}),
            ...(shapeTextBase?.shadowOffsetY ? { shadowOffsetY: shapeTextBase.shadowOffsetY } : {}),
          }
        : {}),
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
      step: 0,
      // Mantém a forma atrás do texto do mesmo shape.
      zIndex: idx * 2 + 1,
      animation: entranceAnim,
      shapeProperties: {
        type: shapeType,
        fill: fill || '#fcfdff',
        borderColor,
        borderWidth,
        rotation,
        flipX,
      },
      // Mantém rastreio de origem; útil para ajustes futuros de import.
      sourceShape: {
        prst,
        hasText,
      },
    });
  });

  return out;
}

/**
 * Extrai textos dos shapes (slide já parseado) → elementos compatíveis com o editor.
 * @param {Record<string, string>} shapeAnimBySpid
 */
function buildTextElementsFromParsedSlide(
  parsed,
  slideCx,
  slideCy,
  slideNumber,
  idPrefix,
  shapeAnimBySpid = {},
  ignoredItems = [],
) {
  if (!parsed) return [];
  const spTree = getSlideSpTreeRoot(parsed);
  if (!spTree) return [];

  const shapes = collectSpShapes(spTree);
  const elements = [];
  shapes.forEach((sp, idx) => {
    const txBody = sp.txBody;
    if (!txBody) return;
    const structured = extractTxBodyStructured(txBody);
    const content = structured.plain;
    if (!content || !content.trim()) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'text',
        reason: 'empty_content',
        details: { index: idx },
      });
      return;
    }

    const xfrm = sp.spPr?.xfrm || sp['p:spPr']?.['p:xfrm'];
    const off = xfrm?.off || xfrm?.['a:off'];
    const ext = xfrm?.ext || xfrm?.['a:ext'];
    if (!off || ext == null) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'text',
        reason: 'missing_transform',
        details: { index: idx },
      });
      return;
    }

    const ox = off.x ?? off['@_x'];
    const oy = off.y ?? off['@_y'];
    const cx = ext.cx ?? ext['@_cx'];
    const cy = ext.cy ?? ext['@_cy'];
    if (ox == null || oy == null || cx == null || cy == null) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'text',
        reason: 'missing_dimensions',
        details: { index: idx },
      });
      return;
    }

    const rect = emuRectToCanvas(ox, oy, cx, cy, slideCx, slideCy);
    const spans = structured.spans;
    const base = spans.length
      ? spans[0]
      : extractFirstRunStyle(txBody);
    const textAlign = structured.textAlign || base.textAlign || 'left';
    const contentSpansPayload =
      spans.length > 0
        ? spans.map((s) => ({
            text: s.text,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            fontStyle: s.fontStyle,
            color: s.color,
            fontFamily: s.fontFamily,
            underline: Boolean(s.underline),
            opacity: s.opacity,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            shadowColor: s.shadowColor,
            shadowBlur: s.shadowBlur,
            shadowOpacity: s.shadowOpacity,
            shadowOffsetX: s.shadowOffsetX,
            shadowOffsetY: s.shadowOffsetY,
          }))
        : null;
    const richSpansPayload = contentSpansPayload ? spansToRichSpans(contentSpansPayload) : [];

    const spid = getShapeSpid(sp);
    // Se o shape já tem geometria visível, o texto é incorporado no próprio elemento de forma.
    // Evita desalinhamento de "texto solto" sobre forma no editor/runtime.
    const spPr = sp.spPr || sp['p:spPr'];
    const hasVisibleShapeForInlineText = (() => {
      const fill = parseFillFromSpPr(spPr);
      const stroke = parseStrokeFromSpPr(spPr);
      return (fill && fill !== 'transparent') || (stroke?.borderWidth || 0) > 0;
    })();
    if (hasVisibleShapeForInlineText) {
      pushIgnoredItem(ignoredItems, {
        slideNumber,
        category: 'text',
        reason: 'embedded_into_shape_element',
        details: { index: idx, mode: 'inline-shape-text' },
      });
      return;
    }
    const entranceAnim =
      spid && shapeAnimBySpid && typeof shapeAnimBySpid === 'object'
        ? shapeAnimBySpid[spid] || ''
        : '';

    elements.push({
      id: `${idPrefix}-txt-${slideNumber}-${idx}${spid ? `-${spid}` : ''}`,
      type: 'text',
      textStyle: 'normal',
      content,
      ...(contentSpansPayload ? { contentSpans: contentSpansPayload } : {}),
      ...(richSpansPayload.length > 0 ? { richSpans: richSpansPayload } : {}),
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
      animation: entranceAnim,
      step: 0,
      // Texto fica acima da forma base do mesmo shape.
      zIndex: idx * 2 + 2,
      fontSize: base.fontSize,
      fontFamily: base.fontFamily || 'Roboto',
      fontWeight: base.fontWeight,
      fontStyle: base.fontStyle,
      textAlign,
      color: base.color,
      opacity: base.opacity,
      strokeColor: base.strokeColor,
      strokeWidth: base.strokeWidth,
      shadowColor: base.shadowColor,
      shadowBlur: base.shadowBlur,
      shadowOpacity: base.shadowOpacity,
      shadowOffsetX: base.shadowOffsetX,
      shadowOffsetY: base.shadowOffsetY,
    });
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

function isNumericBookId(bookId) {
  return /^\d+$/.test(String(bookId || ''));
}

function buildImportBaseDir({ userId, bookId, importSessionId }) {
  if (isNumericBookId(bookId)) {
    return `${userId}/books/${String(bookId)}`;
  }
  return `${userId}/imports/${String(importSessionId)}`;
}

async function uploadSlideImage({ supabase, userId, bookId, importSessionId, importStamp, slideNumber, fileName, binary }) {
  const extension = path.extname(fileName || '.png') || '.png';
  const cleanExtension = extension.toLowerCase();
  const baseDir = buildImportBaseDir({ userId, bookId, importSessionId });
  const targetPath = `${baseDir}/ativos-importacao/pptx-${importStamp}/slide-${String(slideNumber).padStart(3, '0')}${cleanExtension}`;
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

  // MinIO local costuma ser privado; para o browser visualizar, precisamos de URL assinada.
  const publicUrl = await presignedGetUrl('pages', targetPath, 3600);

  try {
    await prisma.mediaFile.create({
      data: {
        userId,
        bookId: isNumericBookId(bookId) ? BigInt(String(bookId)) : null,
        filePath: targetPath,
        fileName: path.basename(targetPath),
        fileType: contentType,
        fileSize: BigInt(binary.length),
        bucketName: 'pages',
      },
    });
  } catch (metadataError) {
    importDebug('media_files create ignorado (não bloqueia)', {
      message: metadataError?.message,
      code: metadataError?.code,
    });
  }

  return {
    slideNumber,
    targetPath,
    publicUrl,
    bucket: 'pages',
  };
}

function buildWarningPage({ slideNumber, reason, elements = [], idStamp, transition }) {
  const stamp = idStamp ?? Date.now();
  return {
    id: `${stamp}-warn-${slideNumber}`,
    background: null,
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

async function uploadOriginalPptx({ supabase, userId, bookId, importSessionId, importStamp, fileName, binary }) {
  const safeFileName = fileName || `book-${bookId}.pptx`;
  const baseDir = buildImportBaseDir({ userId, bookId, importSessionId });
  const targetPath = `${baseDir}/imports/${importStamp}/${safeFileName}`;

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

  try {
    await prisma.mediaFile.create({
      data: {
        userId,
        bookId: isNumericBookId(bookId) ? BigInt(String(bookId)) : null,
        filePath: targetPath,
        fileName: path.basename(targetPath),
        fileType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSize: BigInt(binary.length),
        bucketName: 'presentations',
      },
    });
  } catch (metadataError) {
    importDebug('media_files create (pptx) ignorado (não bloqueia)', {
      message: metadataError?.message,
      code: metadataError?.code,
    });
  }

  return {
    path: targetPath,
    publicUrl: null,
    bucket: 'presentations',
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

    let bookId = 'temp-book';
    let importSessionId = null;
    let dryRun = false;
    let fileBuffer;
    let originalName = '';

    // Multipart-only: o frontend envia `FormData` com o ficheiro .pptx.
    importDebug('parse multipart…');
    const { fields, files } = await parseForm(req);
    importDebug('parse OK', {
      fieldKeys: Object.keys(fields || {}),
      fileKeys: Object.keys(files || {}),
    });

    const rawFile = Array.isArray(files.file) ? files.file[0] : files.file;
    const rawBookId = Array.isArray(fields.bookId) ? fields.bookId[0] : fields.bookId;
    const rawDryRun = Array.isArray(fields.dryRun) ? fields.dryRun[0] : fields.dryRun;
    dryRun = String(rawDryRun || '').toLowerCase() === 'true';
    bookId = normalizeBookId(rawBookId);
    importSessionId = isNumericBookId(bookId) ? null : makeImportSessionId();

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

    // Valida existência do livro apenas quando `bookId` é numérico (caso contrário, é um import "temporário").
    if (isNumericBookId(bookId)) {
      const exists = await prisma.book.findUnique({
        where: { id: BigInt(bookId) },
        select: { id: true },
      });
      if (!exists) {
        res.status(404).json({ error: 'Livro não encontrado para importação.' });
        return;
      }
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
    const importDiagnostics = {
      slidesWithTimingAnimations: 0,
      totalAnimatedShapesDetected: 0,
      transitionsByChild: 0,
      transitionsByAttr: 0,
      transitionsNone: 0,
      ignoredElementsByReason: {},
      ignoredItems: [],
    };

    let supabase = null;
    const importStamp = Date.now();
    if (!dryRun) {
      supabase = buildStorageClient(req);
      // O .pptx original é usado apenas para processamento em memória.
      // Não persistimos o arquivo no storage para evitar acúmulo desnecessário.
      importDebug('upload do .pptx original desativado (uso temporário apenas)', {
        bookId,
        importStamp,
      });
    }

    const { cx: slideCx, cy: slideCy } = await getSlideDimensionsEMU(zip, xmlParser);
    const themeFonts = await extractThemeFonts(zip, xmlParser);
    importDebug('dimensões do slide (EMU)', { slideCx, slideCy });
    importDebug('fontes do tema PPTX', themeFonts);

    importDebug(
      dryRun ? 'dryRun: só detecta slides' : 'iniciando upload de imagens por slide',
      { bookId, importStamp, dryRun },
    );

    /** @type {{ slideNumber: number, fileName: string|null, fileSize: number, textCount: number, shapeCount: number }[]} */
    const slideSummaries = [];
    /** @type {{ slideNumber: number, uploaded: object|null, textElements: object[], shapeElements: object[], uploadWarning: object|null, transition: object }[]} */
    const slidePayloads = [];

    for (const slideXmlPath of slideXmlPaths) {
      const slideNumber = parseInt(slideXmlPath.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      if (!slideNumber) continue;

      try {
        const slideFile = zip.file(slideXmlPath);
        if (!slideFile) continue;
        const slideXml = await slideFile.async('text');
        const parsedSlide = parseSlideXmlSafe(slideXml, xmlParser);
        const slideTransition = extractSlideTransitionFromParsed(parsedSlide);
        const shapeAnimBySpid = extractShapeEntranceAnimations(parsedSlide);
        const animatedShapeCount = Object.keys(shapeAnimBySpid || {}).length;
        if (animatedShapeCount > 0) {
          importDiagnostics.slidesWithTimingAnimations += 1;
          importDiagnostics.totalAnimatedShapesDetected += animatedShapeCount;
        }
        if (slideTransition?.type && slideTransition.type !== 'none') {
          if (slideTransition?.via === 'child') {
            importDiagnostics.transitionsByChild += 1;
          } else if (slideTransition?.via === 'attr') {
            importDiagnostics.transitionsByAttr += 1;
          }
        } else {
          importDiagnostics.transitionsNone += 1;
        }
        const shapeElements = buildShapeElementsFromParsedSlide(
          parsedSlide,
          slideCx,
          slideCy,
          slideNumber,
          String(importStamp),
          shapeAnimBySpid,
          importDiagnostics.ignoredItems,
        );
        const textElementsRaw = buildTextElementsFromParsedSlide(
          parsedSlide,
          slideCx,
          slideCy,
          slideNumber,
          String(importStamp),
          shapeAnimBySpid,
          importDiagnostics.ignoredItems,
        );
        const textElements = normalizeTextElementsFonts(textElementsRaw, themeFonts);

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

        if (!binary && textElements.length === 0 && shapeElements.length === 0) {
          pushIgnoredItem(importDiagnostics.ignoredItems, {
            slideNumber,
            category: 'slide',
            reason: 'no_image_and_no_visible_elements',
          });
          importDebug(`slide ${slideNumber}: ignorado (sem imagem, texto ou forma)`);
          continue;
        }

        const summary = {
          slideNumber,
          fileName: chosenName,
          fileSize: binary ? binary.length : 0,
          textCount: textElements.length,
          shapeCount: shapeElements.length,
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
            formas: shapeElements.length,
          });
          try {
            uploaded = await uploadSlideImage({
              supabase,
              userId,
              bookId,
              importSessionId,
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
            formas: shapeElements.length,
          });
        }

        slidePayloads.push({
          slideNumber,
          uploaded,
          textElements,
          shapeElements,
          uploadWarning,
          transition: slideTransition,
        });
      } catch (slideUnhandledError) {
        const warning = {
          slideNumber,
          fileName: null,
          error:
            slideUnhandledError?.message ||
            'Falha inesperada ao processar o slide.',
        };
        warnings.push(warning);
        importDebugError('falha inesperada no slide (continua importação)', slideUnhandledError, {
          slideNumber,
        });
      }
    }

    importDebug('loop slides concluído', {
      summaries: slideSummaries.length,
      uploaded: uploadedSlides.length,
      warnings: warnings.length,
      dryRun,
      diagnostics: importDiagnostics,
    });
    importDiagnostics.ignoredElementsByReason = importDiagnostics.ignoredItems.reduce(
      (acc, item) => {
        const key = String(item?.reason || 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    if (dryRun) {
      res.status(200).json({
        dryRun: true,
        totalSlidesDetected: slideSummaries.length,
        slides: slideSummaries,
        message: `Dry-run concluído com ${slideSummaries.length} slides detectados.`,
        diagnostics: importDiagnostics,
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
      const { slideNumber, uploaded, textElements, shapeElements, uploadWarning, transition } = payload;
      const transitionMeta = transition || {
        type: 'none',
        durationMs: 500,
        direction: null,
        source: 'pptx',
      };

      /** Fundo do slide vira nó imagem (fica nos ativos do livro); sem background na página. */
      const elementsWithSlideImage = () => {
        const mergedElements = [...(shapeElements || []), ...(textElements || [])].sort(
          (a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0),
        );
        if (!uploaded) return mergedElements;
        const imageEl = {
          id: `${importStamp}-img-${slideNumber}`,
          type: 'image',
          content: uploaded.publicUrl,
          storage: {
            bucket: uploaded.bucket,
            filePath: uploaded.targetPath,
            ...(importSessionId ? { importSessionId } : {}),
          },
          position: { x: 0, y: 0 },
          size: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          zIndex: 0,
          step: 0,
        };
        return [imageEl, ...mergedElements];
      };

      if (uploaded) {
        pages.push({
          id: `${importStamp}-slide-${slideNumber}`,
          background: null,
          elements: elementsWithSlideImage(),
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
            elements: [...(shapeElements || []), ...(textElements || [])].sort(
              (a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0),
            ),
            idStamp: importStamp,
            transition: transitionMeta,
          }),
        );
        continue;
      }

      pages.push({
        id: `${importStamp}-slide-${slideNumber}-textonly`,
        background: null,
        elements: [...(shapeElements || []), ...(textElements || [])].sort(
          (a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0),
        ),
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
      diagnostics: importDiagnostics,
    });

    res.status(200).json({
      importSessionId,
      bookId,
      pages,
      warnings,
      totalSlides: pages.length,
      totalSlidesWithImage: uploadedSlides.length,
      totalSlidesWithWarning: warnings.length,
      diagnostics: importDiagnostics,
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
