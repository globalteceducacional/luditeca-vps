import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Ellipse, Image as KonvaImage, Transformer } from 'react-konva';
import { createPortal } from 'react-dom';
import Konva from 'konva';
import { useResolvedStorageUrl } from '../../lib/useResolvedStorageUrl';

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

const QUICK_FONT_OPTIONS = [
  'Roboto',
  'Open Sans',
  'Poppins',
  'Nunito',
  'Merriweather',
  'Montserrat',
  'Lato',
  'Inter',
  'Century Gothic',
  'Bookman Old Style',
  'Arial',
  'Verdana',
  'Tahoma',
  'Times New Roman',
  'Georgia',
  'Trebuchet MS',
  'Courier New',
];
const CONTEXT_MENU_WIDTH = 260;
const CONTEXT_MENU_HEIGHT = 420;
const CONTEXT_MENU_GAP = 16;
const CONTEXT_MENU_SCREEN_PADDING = 8;

function getSafeClientRect(node) {
  try {
    return node?.getClientRect ? node.getClientRect() : null;
  } catch {
    return null;
  }
}

function resolveContextMenuPositionFromViewportBox(box) {
  if (!box) return null;
  let x = box.x + box.width + CONTEXT_MENU_GAP;
  let y = box.y;

  if (x + CONTEXT_MENU_WIDTH > window.innerWidth - CONTEXT_MENU_SCREEN_PADDING) {
    x = box.x - CONTEXT_MENU_WIDTH - CONTEXT_MENU_GAP;
  }
  if (x < CONTEXT_MENU_SCREEN_PADDING) {
    x = CONTEXT_MENU_SCREEN_PADDING;
  }
  if (y + CONTEXT_MENU_HEIGHT > window.innerHeight - CONTEXT_MENU_SCREEN_PADDING) {
    y = window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_SCREEN_PADDING;
  }
  if (y < CONTEXT_MENU_SCREEN_PADDING) {
    y = CONTEXT_MENU_SCREEN_PADDING;
  }
  return { x, y };
}

function getLineGuideStops({ stage, layer, skipId, canvasW, canvasH }) {
  const vertical = [0, canvasW / 2, canvasW];
  const horizontal = [0, canvasH / 2, canvasH];

  const all = stage?.find?.('.selectable') || [];
  all.forEach((n) => {
    if (!n || !layer) return;
    const id = String(n?.id?.() || '');
    if (skipId && id === skipId) return;
    // ignora shapes "internos" (texto dentro da forma não é selectable)
    const rect = getSafeClientRect(n);
    if (!rect) return;
    vertical.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width);
    horizontal.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height);
  });

  return { vertical, horizontal };
}

function getObjectSnappingEdges(node) {
  const rect = getSafeClientRect(node);
  if (!rect) return { vertical: [], horizontal: [] };

  return {
    vertical: [
      { guide: rect.x, offset: 0, snap: 'start' },
      { guide: rect.x + rect.width / 2, offset: rect.width / 2, snap: 'center' },
      { guide: rect.x + rect.width, offset: rect.width, snap: 'end' },
    ],
    horizontal: [
      { guide: rect.y, offset: 0, snap: 'start' },
      { guide: rect.y + rect.height / 2, offset: rect.height / 2, snap: 'center' },
      { guide: rect.y + rect.height, offset: rect.height, snap: 'end' },
    ],
  };
}

function getGuides(lineGuideStops, itemBounds, tolerance = 6) {
  /** @type {Array<{orientation:'V'|'H', guide:number, diff:number, offset:number}>} */
  const guides = [];

  lineGuideStops.vertical.forEach((lg) => {
    itemBounds.vertical.forEach((it) => {
      const diff = Math.abs(lg - it.guide);
      if (diff <= tolerance) {
        guides.push({ orientation: 'V', guide: lg, diff, offset: it.offset });
      }
    });
  });

  lineGuideStops.horizontal.forEach((lg) => {
    itemBounds.horizontal.forEach((it) => {
      const diff = Math.abs(lg - it.guide);
      if (diff <= tolerance) {
        guides.push({ orientation: 'H', guide: lg, diff, offset: it.offset });
      }
    });
  });

  const v = guides.filter((g) => g.orientation === 'V').sort((a, b) => a.diff - b.diff)[0] || null;
  const h = guides.filter((g) => g.orientation === 'H').sort((a, b) => a.diff - b.diff)[0] || null;
  return { v, h };
}

/** Pequena folga para o pan não ficar preso quando o canvas cabe exactamente na área útil. */
const PAN_VIEW_SLACK_PX = 120;

function clampPanToViewport(pan, viewport, canvasW, canvasH, scale) {
  const contentW = canvasW * scale;
  const contentH = canvasH * scale;
  const slack = PAN_VIEW_SLACK_PX;
  const minX = Math.min(0, viewport.width - contentW) - slack;
  const minY = Math.min(0, viewport.height - contentH) - slack;
  const maxX = Math.max(0, viewport.width - contentW) + slack;
  const maxY = Math.max(0, viewport.height - contentH) + slack;
  return {
    x: clamp(pan.x, minX, maxX),
    y: clamp(pan.y, minY, maxY),
  };
}

function useHtmlImage(url) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    /** Sem crossOrigin por defeito: presigned S3/CDN sem Access-Control-Allow-Origin falha e o GIF nem aparece. */
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [url]);
  return image;
}

/**
 * Com `storage.filePath`, a URL em `content` pode ser presign expirado (import/minio);
 * renova via API antes de carregar no Image().
 */
function useStorageBackedImageUrl(url, storage) {
  const resolved = useResolvedStorageUrl(url, storage);
  return useHtmlImage(resolved);
}

function isGifUrl(url) {
  const s = String(url || '');
  if (/\.gif(?:$|[?#])/i.test(s)) return true;
  if (/[?&]format=gif(?:&|$)/i.test(s)) return true;
  return false;
}

function isGifMediaKind(v) {
  return String(v || '').toLowerCase() === 'gif';
}

function isNodeHidden(node) {
  return Boolean(node?.props?.hidden);
}

function isNodeLocked(node) {
  return Boolean(node?.props?.locked);
}

function nodeIsAnimatedGif(node) {
  const p = node?.props || {};
  if (isGifMediaKind(p.mediaKind)) return true;
  return isGifUrl(p.content);
}

function backgroundIsAnimatedGif(bgUrl, bgRaw) {
  if (bgRaw && typeof bgRaw === 'object' && isGifMediaKind(bgRaw.mediaKind)) return true;
  const storedPath =
    bgRaw && typeof bgRaw === 'object' && typeof bgRaw.storage?.filePath === 'string'
      ? bgRaw.storage.filePath
      : '';
  if (storedPath && isGifUrl(storedPath)) return true;
  return isGifUrl(bgUrl);
}

function ImageNode({
  id,
  node,
  t,
  visual,
  isPreviewMode,
  onSelectNode,
  commitNode,
  elementAnimationTest,
  timelinePlayback,
}) {
  const props = node?.props || {};
  const img = useStorageBackedImageUrl(String(props?.content || ''), props?.storage);
  const locked = isNodeLocked(node);

  const imgRef = useRef(null);

  useEffect(() => {
    let anim = '';
    if (elementAnimationTest?.nonce && String(elementAnimationTest?.elementId || '') === String(id)) {
      anim = String(elementAnimationTest?.animation || '').trim().toLowerCase();
    } else if (
      timelinePlayback != null &&
      timelinePlayback.nonce != null &&
      Number(node?.step ?? 0) === timelinePlayback.step
    ) {
      anim = String(node?.animation || '').trim().toLowerCase();
      if (!anim) anim = 'fadein';
    }
    if (!anim) return;

    const target = imgRef.current;
    if (!target) return;

    const baseX = t.x;
    const baseY = t.y;
    const finalOpacity = clamp(visual?.opacity ?? 1, 0, 1);

    target.opacity(0);

    const duration = 650;
    const ease = Konva.Easings.EaseInOut;
    const dx = 24;
    const dy = 24;

    const finish = () => {
      target.opacity(finalOpacity);
      target.x(baseX);
      target.y(baseY);
      target.scaleX(1);
      target.scaleY(1);
      target.getLayer()?.batchDraw();
    };

    let tween = null;
    // Ordem importa: 'fadeInUp' contém 'fadein', então precisa vir antes do caso genérico.
    if (anim.includes('fadeinup')) {
      target.y(baseY - dy);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeindown')) {
      target.y(baseY + dy);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinleft')) {
      target.x(baseX - dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinright')) {
      target.x(baseX + dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinleft')) {
      target.x(baseX - dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinright')) {
      target.x(baseX + dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadein') || anim === 'animate__fadein') {
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('zoom')) {
      target.opacity(0);
      target.scaleX(0.92);
      target.scaleY(0.92);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        scaleX: 1,
        scaleY: 1,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('bounce') || anim.includes('pulse') || anim.includes('rubberband') || anim.includes('flash')) {
      target.opacity(finalOpacity);
      target.scaleX(0.95);
      target.scaleY(0.95);
      const tween1 = new Konva.Tween({
        node: target,
        duration: 0.25,
        scaleX: 1.12,
        scaleY: 1.12,
        easing: Konva.Easings.EaseOut,
      });
      tween1.play();
      window.setTimeout(() => {
        const tween2 = new Konva.Tween({
          node: target,
          duration: 0.35,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseInOut,
          onFinish: finish,
        });
        tween2.play();
      }, 220);
      tween = null;
    } else {
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    }

    if (tween) tween.play();
  }, [
    elementAnimationTest?.nonce,
    elementAnimationTest?.elementId,
    elementAnimationTest?.animation,
    timelinePlayback?.nonce,
    timelinePlayback?.step,
    id,
    node?.step,
    node?.animation,
    t.x,
    t.y,
    visual?.opacity,
  ]);

  return (
    <KonvaImage
      ref={imgRef}
      id={`node-${id}`}
      name="selectable"
      perfectDrawEnabled={false}
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      image={img}
      opacity={visual?.opacity}
      draggable={!isPreviewMode && !locked}
      onClick={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onTap={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onDragEnd={(e) => {
        commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
      }}
    />
  );
}

function VideoNode({
  id,
  node,
  t,
  visual,
  isPreviewMode,
  onSelectNode,
  commitNode,
}) {
  const locked = isNodeLocked(node);
  const p = node?.props || {};
  const poster = useStorageBackedImageUrl(String(p.poster || ''), p.posterStorage);
  const titleRaw = String(p.title || '').trim();
  const label = titleRaw || 'Video';
  const caption = String(p.videoCaption || '').trim();
  const showTitleChrome = Boolean(titleRaw || caption);
  const layout = ['standard', 'poster_card', 'minimal_chrome'].includes(p.bookVideoLayout)
    ? p.bookVideoLayout
    : 'standard';
  const cr = Math.max(0, Math.min(48, toNum(p.videoCornerRadius, 12)));
  const placeholderFill = String(p.videoPlaceholderFill || '#111827');
  const showPlay = p.showPlayBadge !== false;
  const headerH = layout === 'standard' ? 28 : 0;
  const playR = layout === 'minimal_chrome' ? 12 : 16;
  const playCenterX =
    layout === 'poster_card' || layout === 'minimal_chrome'
      ? t.width - playR * 2 - 10
      : Math.max(playR + 4, t.width / 2 - playR);
  const playCenterY =
    layout === 'poster_card' || layout === 'minimal_chrome'
      ? t.height - playR * 2 - 10
      : Math.max(headerH + playR + 8, t.height / 2 - playR);
  const rawStrokeW = toNum(visual?.strokeWidth, 0);
  const effStrokeW = rawStrokeW > 0 ? Math.max(1, rawStrokeW) : 1;
  const effStrokeColor =
    visual?.stroke || (layout === 'minimal_chrome' ? '#94a3b8' : '#4b5563');
  const playScale = playR / 16;
  const playTri = [12 * playScale, 9 * playScale, 12 * playScale, 23 * playScale, 23 * playScale, 16 * playScale];

  return (
    <Group
      id={`node-${id}`}
      name="selectable"
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      opacity={visual?.opacity}
      draggable={!isPreviewMode && !locked}
      onClick={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onTap={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onDragEnd={(e) => {
        commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
      }}
    >
      <Rect
        width={t.width}
        height={t.height}
        cornerRadius={cr}
        fill={layout === 'minimal_chrome' && poster ? 'rgba(15, 23, 42, 0.25)' : placeholderFill}
        stroke={effStrokeColor}
        strokeWidth={effStrokeW}
        shadowColor={visual?.shadowColor}
        shadowBlur={visual?.shadowBlur}
        shadowOffsetX={visual?.shadowOffsetX}
        shadowOffsetY={visual?.shadowOffsetY}
        shadowOpacity={visual?.shadowOpacity}
      />
      {poster ? (
        <KonvaImage
          image={poster}
          width={t.width}
          height={t.height}
          cornerRadius={cr}
          perfectDrawEnabled={false}
          listening={false}
        />
      ) : null}
      {layout === 'standard' ? (
        <>
          <Rect
            width={t.width}
            height={headerH}
            cornerRadius={[cr, cr, 0, 0]}
            fill="rgba(15, 23, 42, 0.84)"
            listening={false}
          />
          <Text
            x={10}
            y={8}
            width={Math.max(20, t.width - 20)}
            fontSize={11}
            fontStyle="bold"
            fill="#e2e8f0"
            text={label}
            ellipsis
            listening={false}
          />
        </>
      ) : null}
      {layout === 'poster_card' && showTitleChrome ? (
        <>
          <Rect
            x={0}
            y={t.height - (titleRaw && caption ? 44 : 28)}
            width={t.width}
            height={titleRaw && caption ? 44 : 28}
            cornerRadius={[0, 0, cr, cr]}
            fill="rgba(2, 6, 23, 0.72)"
            listening={false}
          />
          {titleRaw ? (
            <Text
              x={10}
              y={t.height - (caption ? 40 : 22)}
              width={Math.max(20, t.width - 20)}
              fontSize={11}
              fontStyle="bold"
              fill="#f1f5f9"
              text={titleRaw}
              ellipsis
              listening={false}
            />
          ) : null}
          {caption ? (
            <Text
              x={10}
              y={t.height - (titleRaw ? 18 : 20)}
              width={Math.max(20, t.width - playR * 4)}
              fontSize={titleRaw ? 9 : 10}
              fill={titleRaw ? '#94a3b8' : '#f1f5f9'}
              fontStyle={titleRaw ? 'normal' : 'bold'}
              text={caption}
              ellipsis
              listening={false}
            />
          ) : null}
        </>
      ) : null}
      {layout === 'minimal_chrome' && showTitleChrome ? (
        <>
          {titleRaw ? (
            <Text
              x={10}
              y={t.height - (caption ? 34 : 18)}
              width={Math.max(20, t.width - playR * 4 - 8)}
              fontSize={10}
              fontStyle="bold"
              fill="#f8fafc"
              text={titleRaw}
              ellipsis
              listening={false}
            />
          ) : null}
          {caption ? (
            <Text
              x={10}
              y={t.height - (titleRaw ? 14 : 16)}
              width={Math.max(20, t.width - playR * 4 - 8)}
              fontSize={titleRaw ? 8 : 9}
              fill={titleRaw ? '#cbd5e1' : '#f8fafc'}
              fontStyle={titleRaw ? 'normal' : 'bold'}
              text={caption}
              ellipsis
              listening={false}
            />
          ) : null}
        </>
      ) : null}
      {showPlay ? (
        <Group x={playCenterX} y={playCenterY} listening={false}>
          <Rect width={playR * 2} height={playR * 2} cornerRadius={playR} fill="rgba(2, 6, 23, 0.75)" />
          <Line points={playTri} fill="#f8fafc" closed />
        </Group>
      ) : null}
    </Group>
  );
}

/** Preview HTML com URL assinada — o nó Konva continua só placeholder para arrastar/redimensionar. */
function SelectedVideoFloatingPreview({ node }) {
  const props = node?.props || {};
  const content = String(props.content || '');
  const storage = props.storage;
  const resolved = useResolvedStorageUrl(content, storage);
  const posterResolved = useResolvedStorageUrl(String(props.poster || ''), props.posterStorage);
  const videoRef = useRef(null);
  const startAt = toNum(props.startAt, 0);
  const muted = Boolean(props.muted);
  const loop = Boolean(props.loop);
  const volume = clamp(toNum(props.volume, 1), 0, 1);
  const objectFit = ['cover', 'contain', 'fill'].includes(props.objectFit) ? props.objectFit : 'cover';
  const showControls = props.controls !== false;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resolved) return;
    const onMeta = () => {
      try {
        v.currentTime = Math.max(0, startAt);
      } catch {
        /* seek pode falhar antes de metadata */
      }
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [resolved, startAt]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume;
  }, [volume]);

  const playbackRate = clamp(toNum(props.playbackRate, 1), 0.25, 2);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playbackRate;
  }, [playbackRate]);

  if (!resolved) {
    return (
      <div className="pointer-events-auto absolute right-3 bottom-3 z-[5] max-w-[min(20rem,90vw)] rounded border border-gray-700 bg-gray-950/90 px-3 py-2 text-xs text-gray-400 backdrop-blur">
        A carregar URL do video…
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute right-3 bottom-3 z-[5] w-80 max-w-[min(20rem,90vw)] rounded border border-gray-700 bg-gray-950/90 p-2 shadow-lg backdrop-blur">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Preview do video</div>
      <video
        ref={videoRef}
        key={resolved}
        src={resolved}
        poster={posterResolved || undefined}
        controls={showControls}
        playsInline
        muted={muted}
        loop={loop}
        className="w-full rounded border border-gray-800 bg-black"
        style={{ maxHeight: '12rem', objectFit }}
      />
      <p className="mt-1 text-[10px] leading-snug text-gray-500">
        Volume e encaixe: painel Propriedades. No canvas use o quadro para posicao e tamanho.
      </p>
    </div>
  );
}

function getNodeTransform(node) {
  const t = node?.transform || {};
  return {
    x: toNum(t.x, 0),
    y: toNum(t.y, 0),
    width: Math.max(1, toNum(t.width, 120)),
    height: Math.max(1, toNum(t.height, 40)),
    rotation: toNum(t.rotation, 0),
  };
}

function getNodeFill(node) {
  const props = node?.props || {};
  if (node?.type === 'shape') {
    const sp = props.shapeProperties || {};
    return typeof sp.fill === 'string' ? sp.fill : '#fcfdff';
  }
  return 'transparent';
}

function getNodeVisualProps(node) {
  const props = node?.props || {};
  const strokeWidth = Math.max(0, toNum(props?.strokeWidth, 0));
  const shadowBlur = Math.max(0, toNum(props?.shadowBlur, 0));
  const rawShadowOp = toNum(props?.shadowOpacity, NaN);
  const shadowOpacity = Number.isFinite(rawShadowOp)
    ? clamp(rawShadowOp, 0, 1)
    : shadowBlur > 0
      ? 1
      : 0;
  const shadowColor =
    typeof props?.shadowColor === 'string'
      ? props.shadowColor
      : shadowBlur > 0
        ? 'rgba(0,0,0,0.45)'
        : undefined;
  return {
    opacity: clamp(toNum(props?.opacity, 1), 0, 1),
    stroke: strokeWidth > 0 && typeof props?.strokeColor === 'string' ? props.strokeColor : undefined,
    strokeWidth,
    shadowColor,
    shadowBlur,
    shadowOffsetX: toNum(props?.shadowOffsetX, 0),
    shadowOffsetY: toNum(props?.shadowOffsetY, 0),
    shadowOpacity,
  };
}

function parseRichSpans(raw, spans, globalWeight, globalStyle) {
  const text = String(raw || '');
  /** @type {Array<{bold:boolean,italic:boolean,underline:boolean}>} */
  const styleByIndex = Array.from({ length: text.length }).map(() => ({
    bold: String(globalWeight || '') === 'bold',
    italic: String(globalStyle || '') === 'italic',
    underline: false,
  }));

  const safeSpans = Array.isArray(spans) ? spans : [];
  for (const span of safeSpans) {
    const start = Math.max(0, Math.min(text.length, toNum(span?.start, 0)));
    const end = Math.max(start, Math.min(text.length, toNum(span?.end, start)));
    for (let i = start; i < end; i += 1) {
      if (span?.bold) styleByIndex[i].bold = true;
      if (span?.italic) styleByIndex[i].italic = true;
      if (span?.underline) styleByIndex[i].underline = true;
    }
  }

  /** @type {Array<{text:string,bold?:boolean,italic?:boolean,underline?:boolean,newline?:boolean}>} */
  const out = [];
  let buffer = '';
  let prevStyle = null;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') {
      if (buffer) {
        out.push({
          text: buffer,
          bold: prevStyle?.bold || false,
          italic: prevStyle?.italic || false,
          underline: prevStyle?.underline || false,
        });
        buffer = '';
      }
      out.push({ text: '', newline: true });
      prevStyle = null;
      continue;
    }
    const st = styleByIndex[i] || { bold: false, italic: false, underline: false };
    const sameStyle =
      prevStyle &&
      prevStyle.bold === st.bold &&
      prevStyle.italic === st.italic &&
      prevStyle.underline === st.underline;
    if (!sameStyle && buffer) {
      out.push({
        text: buffer,
        bold: prevStyle?.bold || false,
        italic: prevStyle?.italic || false,
        underline: prevStyle?.underline || false,
      });
      buffer = '';
    }
    buffer += ch;
    prevStyle = st;
  }
  if (buffer) {
    out.push({
      text: buffer,
      bold: prevStyle?.bold || false,
      italic: prevStyle?.italic || false,
      underline: prevStyle?.underline || false,
    });
  }
  return out;
}

function measureTextWidth(text, fontSize, fontFamily, bold, italic) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.55;
  const weight = bold ? 'bold' : 'normal';
  const style = italic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

function splitByWords(segmentText) {
  const chunks = String(segmentText || '').split(/(\s+)/).filter((v) => v.length > 0);
  return chunks.length > 0 ? chunks : [''];
}

function buildRichLayout(tokens, maxWidth, opts) {
  const fontSize = Math.max(1, toNum(opts.fontSize, 24));
  const fontFamily = String(opts.fontFamily || 'Roboto');
  /** @type {Array<Array<{text:string,bold?:boolean,italic?:boolean,underline?:boolean,width:number}>>} */
  const lines = [[]];
  let lineWidth = 0;

  const pushLine = () => {
    lines.push([]);
    lineWidth = 0;
  };

  for (const tk of tokens) {
    if (tk.newline) {
      pushLine();
      continue;
    }
    const words = splitByWords(tk.text);
    for (const wd of words) {
      const segW = measureTextWidth(wd, fontSize, fontFamily, tk.bold, tk.italic);
      const overflows = lineWidth > 0 && lineWidth + segW > maxWidth;
      if (overflows) pushLine();
      lines[lines.length - 1].push({
        text: wd,
        bold: tk.bold,
        italic: tk.italic,
        underline: tk.underline,
        width: segW,
      });
      lineWidth += segW;
    }
  }
  return lines;
}

function RichTextNode({
  id,
  node,
  t,
  props,
  visual,
  isPreviewMode,
  onSelectNode,
  commitNode,
  elementAnimationTest,
  timelinePlayback,
  onStartInlineTextEdit,
  isInlineEditing,
}) {
  const tokens = useMemo(
    () =>
      parseRichSpans(props?.content, props?.richSpans, props?.fontWeight, props?.fontStyle),
    [props?.content, props?.richSpans, props?.fontWeight, props?.fontStyle],
  );
  const lines = useMemo(
    () =>
      buildRichLayout(tokens, Math.max(1, t.width), {
        fontSize: toNum(props?.fontSize, 24),
        fontFamily: String(props?.fontFamily || 'Roboto'),
      }),
    [tokens, t.width, props?.fontSize, props?.fontFamily],
  );

  const fontSize = Math.max(1, toNum(props?.fontSize, 24));
  const lineHeight = Math.max(1, toNum(props?.lineHeight, 1.35));
  const baseColor = String(props?.color || '#000000');
  const align = String(props?.textAlign || 'left');
  const letterSpacing = toNum(props?.letterSpacing, 0);
  const locked = isNodeLocked(node);

  const groupRef = useRef(null);

  useEffect(() => {
    let anim = '';
    if (elementAnimationTest?.nonce && String(elementAnimationTest?.elementId || '') === String(id)) {
      anim = String(elementAnimationTest?.animation || '').trim().toLowerCase();
    } else if (
      timelinePlayback != null &&
      timelinePlayback.nonce != null &&
      Number(node?.step ?? 0) === timelinePlayback.step
    ) {
      anim = String(node?.animation || '').trim().toLowerCase();
      if (!anim) anim = 'fadein';
    }
    if (!anim) return;

    const group = groupRef.current;
    if (!group) return;

    const baseX = t.x;
    const baseY = t.y;
    const finalOpacity = clamp(visual.opacity, 0, 1);

    // Sempre volta pro estado final após o teste.
    group.opacity(0);

    const duration = 650;
    const ease = Konva.Easings.EaseInOut;
    const dx = 24;
    const dy = 24;

    const finish = () => {
      group.opacity(finalOpacity);
      group.x(baseX);
      group.y(baseY);
      group.scaleX(1);
      group.scaleY(1);
      group.getLayer()?.batchDraw();
    };

    let tween = null;
    // Ordem importa: 'fadeInUp' contém 'fadein', então precisa vir antes do caso genérico.
    if (anim.includes('fadeinup')) {
      group.y(baseY - dy);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeindown')) {
      group.y(baseY + dy);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinleft')) {
      group.x(baseX - dx);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinright')) {
      group.x(baseX + dx);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinleft')) {
      group.x(baseX - dx);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinright')) {
      group.x(baseX + dx);
      group.opacity(0);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadein') || anim === 'animate__fadein') {
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('zoom')) {
      group.opacity(0);
      group.scaleX(0.92);
      group.scaleY(0.92);
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        opacity: finalOpacity,
        scaleX: 1,
        scaleY: 1,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('bounce') || anim.includes('pulse') || anim.includes('rubberband') || anim.includes('flash')) {
      group.opacity(finalOpacity);
      group.scaleX(0.95);
      group.scaleY(0.95);
      const tween1 = new Konva.Tween({
        node: group,
        duration: 0.25,
        scaleX: 1.12,
        scaleY: 1.12,
        easing: Konva.Easings.EaseOut,
      });
      tween1.play();
      window.setTimeout(() => {
        const tween2 = new Konva.Tween({
          node: group,
          duration: 0.35,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseInOut,
          onFinish: finish,
        });
        tween2.play();
      }, 220);
      tween = null;
    } else {
      // Fallback: fade in.
      tween = new Konva.Tween({
        node: group,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    }

    if (tween) tween.play();
  }, [
    elementAnimationTest?.nonce,
    elementAnimationTest?.elementId,
    elementAnimationTest?.animation,
    timelinePlayback?.nonce,
    timelinePlayback?.step,
    id,
    node?.step,
    node?.animation,
    t.x,
    t.y,
    visual.opacity,
  ]);

  return (
    <Group
      key={id}
      id={`node-${id}`}
        ref={groupRef}
      name="selectable"
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      opacity={visual.opacity}
      draggable={!isPreviewMode && !locked}
      onClick={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onTap={(e) => !isPreviewMode && onSelectNode?.(id, e)}
      onDblClick={() => {
        if (isPreviewMode) return;
        onSelectNode?.(id);
        onStartInlineTextEdit?.(id);
      }}
      onDblTap={() => {
        if (isPreviewMode) return;
        onSelectNode?.(id);
        onStartInlineTextEdit?.(id);
      }}
      onDragEnd={(e) => {
        commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
      }}
    >
      <Rect
        width={t.width}
        height={t.height}
        fill="rgba(0,0,0,0.001)"
        strokeEnabled={false}
      />
      {lines.map((line, lineIdx) => {
        const lineW = line.reduce((acc, s) => acc + s.width, 0);
        let cursorX = 0;
        if (align === 'center') cursorX = Math.max(0, (t.width - lineW) / 2);
        if (align === 'right') cursorX = Math.max(0, t.width - lineW);
        const y = lineIdx * fontSize * lineHeight;
        return line.map((seg, segIdx) => {
          const segX = cursorX;
          cursorX += seg.width;
          return (
            <Text
              key={`${id}-${lineIdx}-${segIdx}`}
              x={segX}
              y={y}
              text={seg.text}
              fontSize={fontSize}
              fontFamily={String(props?.fontFamily || 'Roboto')}
              fontStyle={`${seg.bold ? 'bold' : ''} ${seg.italic ? 'italic' : ''}`.trim()}
              fill={baseColor}
              textDecoration={seg.underline ? 'underline' : props?.textDecoration === 'underline' ? 'underline' : ''}
              letterSpacing={letterSpacing}
              listening={false}
              opacity={isInlineEditing ? 0 : 1}
              stroke={visual.stroke}
              strokeWidth={visual.strokeWidth}
              shadowColor={visual.shadowColor}
              shadowBlur={visual.shadowBlur}
              shadowOffsetX={visual.shadowOffsetX}
              shadowOffsetY={visual.shadowOffsetY}
              shadowOpacity={visual.shadowOpacity}
            />
          );
        });
      })}
    </Group>
  );
}

function ShapeNode({
  id,
  node,
  t,
  visual,
  isPreviewMode,
  onSelectNode,
  commitNode,
  elementAnimationTest,
  timelinePlayback,
  onStartInlineTextEdit,
  isInlineEditing,
}) {
  const rectRef = useRef(null);
  const props = node?.props || {};
  const shape = props?.shapeProperties || {};
  const shapeType = String(shape?.type || 'rectangle').toLowerCase();

  useEffect(() => {
    let anim = '';
    if (elementAnimationTest?.nonce && String(elementAnimationTest?.elementId || '') === String(id)) {
      anim = String(elementAnimationTest?.animation || '').trim().toLowerCase();
    } else if (
      timelinePlayback != null &&
      timelinePlayback.nonce != null &&
      Number(node?.step ?? 0) === timelinePlayback.step
    ) {
      anim = String(node?.animation || '').trim().toLowerCase();
      if (!anim) anim = 'fadein';
    }
    if (!anim) return;

    const target = rectRef.current;
    if (!target) return;

    const baseX = t.x;
    const baseY = t.y;
    const finalOpacity = clamp(visual?.opacity ?? 1, 0, 1);

    target.opacity(0);

    const duration = 650;
    const ease = Konva.Easings.EaseInOut;
    const dx = 24;
    const dy = 24;

    const finish = () => {
      target.opacity(finalOpacity);
      target.x(baseX);
      target.y(baseY);
      target.scaleX(1);
      target.scaleY(1);
      target.getLayer()?.batchDraw();
    };

    let tween = null;
    // Ordem importa: 'fadeInUp' contém 'fadein', então precisa vir antes do caso genérico.
    if (anim.includes('fadeinup')) {
      target.y(baseY - dy);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeindown')) {
      target.y(baseY + dy);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        y: baseY,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinleft')) {
      target.x(baseX - dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadeinright')) {
      target.x(baseX + dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinleft')) {
      target.x(baseX - dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('slideinright')) {
      target.x(baseX + dx);
      target.opacity(0);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        x: baseX,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('fadein') || anim === 'animate__fadein') {
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('zoom')) {
      target.opacity(0);
      target.scaleX(0.92);
      target.scaleY(0.92);
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        scaleX: 1,
        scaleY: 1,
        easing: ease,
        onFinish: finish,
      });
    } else if (anim.includes('bounce') || anim.includes('pulse') || anim.includes('rubberband') || anim.includes('flash')) {
      target.opacity(finalOpacity);
      target.scaleX(0.95);
      target.scaleY(0.95);
      const tween1 = new Konva.Tween({
        node: target,
        duration: 0.25,
        scaleX: 1.12,
        scaleY: 1.12,
        easing: Konva.Easings.EaseOut,
      });
      tween1.play();
      window.setTimeout(() => {
        const tween2 = new Konva.Tween({
          node: target,
          duration: 0.35,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseInOut,
          onFinish: finish,
        });
        tween2.play();
      }, 220);
      tween = null;
    } else {
      tween = new Konva.Tween({
        node: target,
        duration: duration / 1000,
        opacity: finalOpacity,
        easing: ease,
        onFinish: finish,
      });
    }

    if (tween) tween.play();
  }, [
    elementAnimationTest?.nonce,
    elementAnimationTest?.elementId,
    elementAnimationTest?.animation,
    timelinePlayback?.nonce,
    timelinePlayback?.step,
    id,
    node?.step,
    node?.animation,
    t.x,
    t.y,
    visual?.opacity,
  ]);

  const commonShapeProps = {
    ref: rectRef,
    id: `node-${id}`,
    name: 'selectable',
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
    fill: getNodeFill(node),
    stroke: visual.stroke || '#0d0d0d',
    strokeWidth: visual.strokeWidth > 0 ? visual.strokeWidth : 2,
    opacity: visual.opacity,
    shadowColor: visual.shadowColor,
    shadowBlur: visual.shadowBlur,
    shadowOffsetX: visual.shadowOffsetX,
    shadowOffsetY: visual.shadowOffsetY,
    shadowOpacity: visual.shadowOpacity,
    draggable: !isPreviewMode,
    onClick: (e) => !isPreviewMode && onSelectNode?.(id, e),
    onTap: (e) => !isPreviewMode && onSelectNode?.(id, e),
    onDblClick: () => {
      if (isPreviewMode) return;
      onSelectNode?.(id);
      onStartInlineTextEdit?.(id);
    },
    onDblTap: () => {
      if (isPreviewMode) return;
      onSelectNode?.(id);
      onStartInlineTextEdit?.(id);
    },
    onDragEnd: (e) => {
      commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
    },
  };

  const textContent = String(props?.content || '').trim();
  const textNode =
    !isInlineEditing && textContent.length > 0 ? (
      <Text
        x={t.x + 8}
        y={t.y + 6}
        width={Math.max(1, t.width - 16)}
        height={Math.max(1, t.height - 12)}
        text={textContent}
        align={String(props?.textAlign || 'center')}
        verticalAlign="middle"
        fontSize={Math.max(8, toNum(props?.fontSize, 24))}
        fontFamily={String(props?.fontFamily || 'Roboto')}
        fontStyle={`${String(props?.fontWeight || 'normal') === 'bold' ? 'bold' : ''} ${String(props?.fontStyle || 'normal') === 'italic' ? 'italic' : ''}`.trim()}
        fill={String(props?.color || '#111111')}
        textDecoration={String(props?.textDecoration || 'none') === 'none' ? '' : String(props?.textDecoration)}
        lineHeight={Math.max(1, toNum(props?.lineHeight, 1.2))}
        letterSpacing={toNum(props?.letterSpacing, 0)}
        opacity={clamp(toNum(props?.opacity, 1), 0, 1)}
        stroke={typeof props?.strokeColor === 'string' ? props.strokeColor : undefined}
        strokeWidth={Math.max(0, toNum(props?.strokeWidth, 0))}
        shadowColor={typeof props?.shadowColor === 'string' ? props.shadowColor : undefined}
        shadowBlur={Math.max(0, toNum(props?.shadowBlur, 0))}
        shadowOffsetX={toNum(props?.shadowOffsetX, 0)}
        shadowOffsetY={toNum(props?.shadowOffsetY, 0)}
        shadowOpacity={clamp(toNum(props?.shadowOpacity, 0), 0, 1)}
        listening={false}
      />
    ) : null;

  if (shapeType === 'circle' || shapeType === 'ellipse') {
    return (
      <Group>
        <Ellipse
          key={id}
          {...commonShapeProps}
          x={t.x + t.width / 2}
          y={t.y + t.height / 2}
          radiusX={t.width / 2}
          radiusY={t.height / 2}
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'triangle') {
    return (
      <Group>
        <Line
          key={id}
          {...commonShapeProps}
          points={[t.x + t.width / 2, t.y, t.x, t.y + t.height, t.x + t.width, t.y + t.height]}
          closed
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'star') {
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    const outer = Math.min(t.width, t.height) / 2;
    const inner = outer * 0.45;
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = (-Math.PI / 2) + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outer : inner;
      points.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    return (
      <Group>
        <Line
          key={id}
          {...commonShapeProps}
          points={points}
          closed
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'arrow') {
    return (
      <Group>
        <Line
          key={id}
          {...commonShapeProps}
          points={[
            t.x,
            t.y + t.height / 2,
            t.x + t.width - Math.max(20, t.width * 0.28),
            t.y + t.height / 2,
            t.x + t.width - Math.max(20, t.width * 0.28),
            t.y + t.height * 0.25,
            t.x + t.width,
            t.y + t.height / 2,
            t.x + t.width - Math.max(20, t.width * 0.28),
            t.y + t.height * 0.75,
            t.x + t.width - Math.max(20, t.width * 0.28),
            t.y + t.height / 2,
            t.x,
            t.y + t.height / 2,
          ]}
          closed
          lineJoin="round"
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'diamond') {
    return (
      <Group>
        <Line
          key={id}
          {...commonShapeProps}
          points={[
            t.x + t.width / 2, t.y,
            t.x + t.width, t.y + t.height / 2,
            t.x + t.width / 2, t.y + t.height,
            t.x, t.y + t.height / 2,
          ]}
          closed
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'hexagon') {
    const side = Math.min(t.width * 0.25, t.height * 0.28);
    return (
      <Group>
        <Line
          key={id}
          {...commonShapeProps}
          points={[
            t.x + side, t.y,
            t.x + t.width - side, t.y,
            t.x + t.width, t.y + t.height / 2,
            t.x + t.width - side, t.y + t.height,
            t.x + side, t.y + t.height,
            t.x, t.y + t.height / 2,
          ]}
          closed
        />
        {textNode}
      </Group>
    );
  }

  if (shapeType === 'line') {
    return (
      <Line
        key={id}
        {...commonShapeProps}
        points={[t.x, t.y + t.height / 2, t.x + t.width, t.y + t.height / 2]}
        fillEnabled={false}
      />
    );
  }

  return (
    <Group>
      <Rect key={id} {...commonShapeProps} cornerRadius={Math.max(0, toNum(shape?.borderRadius, 0))} />
      {textNode}
    </Group>
  );
}

/**
 * Canvas engine v2 (Konva) — foco em estabilidade: drag/resize/rotate + seleção.
 *
 * Props esperadas:
 * - pagesV2: { version:2, canvas:{width,height}, pages:[{id, background, nodes:[]}] }
 * - pageIndex
 * - onChange(nextPagesV2)
 * - timelineStep: indice da etapa de preview (timeline); so elementos com step <= timelineStep sao desenhados
 * - timelinePlayback: durante o play, { nonce, step } para disparar animacoes de entrada nos nos da etapa atual
 */
export default function CanvasStageKonva({
  pagesV2,
  pageIndex,
  onChange,
  selectedId,
  setSelectedId,
  isPreviewMode = false,
  timelineStep,
  elementAnimationTest,
  timelinePlayback,
  onRequestPropertiesPanel,
  showGrid = false,
  snapToGrid = false,
  gridSize = 20,
}) {
  const canvasW = toNum(pagesV2?.canvas?.width, 1280);
  const canvasH = toNum(pagesV2?.canvas?.height, 720);
  const page = pagesV2?.pages?.[pageIndex] || null;
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];
  const selectedVideoNode = useMemo(() => {
    if (!selectedId) return null;
    const n = nodes.find((x) => String(x?.id) === String(selectedId));
    return n?.type === 'video' ? n : null;
  }, [selectedId, nodes]);

  const stageWrapRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const contentLayerRef = useRef(null);
  const inlineTextareaRef = useRef(null);
  const draggingRef = useRef(false);

  const [guides, setGuides] = useState({ vertical: [], horizontal: [] });
  const [contextMenu, setContextMenu] = useState(null);
  const [canUsePortal, setCanUsePortal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  /** Edição inline: só { mode, nodeId, value }; posição/tipografia vêm do nó + pan/zoom. */
  const [inlineEditor, setInlineEditor] = useState(null);

  useEffect(() => {
    setCanUsePortal(typeof window !== 'undefined' && typeof document !== 'undefined');
  }, []);

  const bgRaw = page?.background;
  const bgUrl = typeof bgRaw === 'string' ? bgRaw : bgRaw?.url || '';
  const bgStorage = typeof bgRaw === 'object' && bgRaw ? bgRaw.storage : null;
  const bgPosition =
    typeof bgRaw === 'object' && bgRaw?.position
      ? { x: clamp(toNum(bgRaw.position.x, 0.5), 0, 1), y: clamp(toNum(bgRaw.position.y, 0.5), 0, 1) }
      : { x: 0.5, y: 0.5 };
  const bgScale = typeof bgRaw === 'object' ? Math.max(0.5, Math.min(3, toNum(bgRaw?.scale, 1))) : 1;
  const bgImage = useStorageBackedImageUrl(bgUrl, bgStorage);

  // Viewport fit + zoom/pan
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1); // 0.25..3
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: canvasW, height: canvasH });

  const scale = useMemo(() => clamp(fitScale * zoom, 0.1, 3), [fitScale, zoom]);

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;

    const calc = () => {
      const rect = el.getBoundingClientRect();
      setViewport({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
      const s = Math.min((rect.width - 16) / canvasW, (rect.height - 16) / canvasH, 1);
      setFitScale(s > 0 ? s : 0.2);
      // centraliza sempre que recalcular
      const cx = (rect.width - canvasW * s) / 2;
      const cy = (rect.height - canvasH * s) / 2;
      setPan(clampPanToViewport({ x: cx, y: cy }, { width: rect.width, height: rect.height }, canvasW, canvasH, s));
    };

    calc();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('resize', calc);
      if (ro) ro.disconnect();
    };
  }, [canvasW, canvasH]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedIds([]);
      return;
    }
    const sid = String(selectedId);
    setSelectedIds((prev) => (prev.includes(sid) ? prev : [sid]));
  }, [selectedId]);

  const handleSelectNode = useCallback((nodeId, konvaEvt) => {
    const sid = String(nodeId || '');
    if (!sid) return;
    const targetNode = nodes.find((n) => String(n?.id) === sid);
    if (!targetNode || isNodeHidden(targetNode)) return;
    const evt = konvaEvt?.evt;
    const hasCtrl = Boolean(evt?.ctrlKey || evt?.metaKey);
    if (!hasCtrl) {
      setSelectedIds([sid]);
      setSelectedId?.(sid);
      return;
    }
    setSelectedIds((prev) => {
      const has = prev.includes(sid);
      const next = has ? prev.filter((id) => id !== sid) : [...prev, sid];
      const primary = next[next.length - 1] || null;
      setSelectedId?.(primary);
      return next;
    });
  }, [setSelectedId, nodes]);

  // Sync Transformer selection
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (isPreviewMode) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    if (!selectedIds.length) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const selectedNodes = selectedIds
      .map((id) => stage.findOne(`#node-${String(id)}`))
      .filter(Boolean);
    const unlockedNodes = selectedNodes.filter((n) => {
      const rawId = typeof n.id === 'function' ? n.id() : '';
      const nodeId = String(rawId || '').replace(/^node-/, '');
      const nodeData = nodes.find((x) => String(x?.id) === nodeId);
      return nodeData && !isNodeLocked(nodeData) && !isNodeHidden(nodeData);
    });
    if (unlockedNodes.length) {
      tr.nodes(unlockedNodes);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedIds, isPreviewMode, timelineStep, inlineEditor?.nodeId, nodes]);

  const commitNode = useCallback(
    (id, patch) => {
      if (!onChange) return;
      if (!pagesV2 || pagesV2.version !== 2) return;
      const next = JSON.parse(JSON.stringify(pagesV2));
      const p = next.pages?.[pageIndex];
      if (!p || !Array.isArray(p.nodes)) return;
      const idx = p.nodes.findIndex((n) => String(n?.id) === String(id));
      if (idx === -1) return;
      p.nodes[idx] = { ...p.nodes[idx], ...patch };
      onChange(next);
    },
    [onChange, pagesV2, pageIndex],
  );

  const handleStageMouseDown = useCallback(
    (e) => {
      if (isPreviewMode) return;
      const target = e.target;
      if (target === target.getStage() || target?.name?.() === 'background') {
        setSelectedIds([]);
        setSelectedId?.(null);
      }
    },
    [isPreviewMode, setSelectedId],
  );

  const handleDragMove = useCallback(
    (e) => {
      if (isPreviewMode) return;
      const stage = stageRef.current;
      const layer = contentLayerRef.current;
      const target = e?.target;
      if (!stage || !layer || !target) return;
      if (target?.name?.() !== 'selectable') return;

      draggingRef.current = true;

      const id = String(target?.id?.() || '');
      const lineGuideStops = getLineGuideStops({
        stage,
        layer,
        skipId: id,
        canvasW,
        canvasH,
      });
      const itemBounds = getObjectSnappingEdges(target);
      const { v, h } = getGuides(lineGuideStops, itemBounds, 6);

      const nextGuides = { vertical: [], horizontal: [] };

      if (v) {
        const absPos = target.absolutePosition();
        const targetRect = getSafeClientRect(target);
        if (targetRect) {
          // Ajuste pelo offset do bounding box.
          absPos.x = absPos.x + (v.guide - (targetRect.x + v.offset));
          target.absolutePosition(absPos);
        }
        nextGuides.vertical.push({ x: v.guide });
      }

      if (h) {
        const absPos = target.absolutePosition();
        const targetRect = getSafeClientRect(target);
        if (targetRect) {
          absPos.y = absPos.y + (h.guide - (targetRect.y + h.offset));
          target.absolutePosition(absPos);
        }
        nextGuides.horizontal.push({ y: h.guide });
      }

      if (!v && !h && snapToGrid && gridSize > 1) {
        const absPos = target.absolutePosition();
        const snapX = Math.round(absPos.x / gridSize) * gridSize;
        const snapY = Math.round(absPos.y / gridSize) * gridSize;
        const snapTolerance = Math.max(4, Math.min(14, Math.round(gridSize * 0.35)));
        if (Math.abs(snapX - absPos.x) <= snapTolerance) {
          absPos.x = snapX;
          nextGuides.vertical.push({ x: snapX, kind: 'grid' });
        }
        if (Math.abs(snapY - absPos.y) <= snapTolerance) {
          absPos.y = snapY;
          nextGuides.horizontal.push({ y: snapY, kind: 'grid' });
        }
        target.absolutePosition(absPos);
      }

      // Evita render loop quando não há guias.
      setGuides(
        nextGuides.vertical.length || nextGuides.horizontal.length ? nextGuides : { vertical: [], horizontal: [] },
      );

      // Reancora menu contextual ao nó durante drag (sem depender de commit no fim do drag).
      const targetId = String(target?.id?.() || '').replace(/^node-/, '');
      if (contextMenu?.nodeId && String(contextMenu.nodeId) === targetId) {
        const targetRect = getSafeClientRect(target);
        const containerRect = stage.container?.()?.getBoundingClientRect?.();
        if (targetRect && containerRect) {
          const anchored = resolveContextMenuPositionFromViewportBox({
            x: containerRect.left + targetRect.x,
            y: containerRect.top + targetRect.y,
            width: targetRect.width,
            height: targetRect.height,
          });
          if (anchored) {
            setContextMenu((prev) => {
              if (!prev || String(prev.nodeId) !== targetId) return prev;
              const sameX = Math.abs(toNum(prev.x, 0) - anchored.x) < 0.5;
              const sameY = Math.abs(toNum(prev.y, 0) - anchored.y) < 0.5;
              if (sameX && sameY) return prev;
              return { ...prev, x: anchored.x, y: anchored.y };
            });
          }
        }
      }
    },
    [canvasW, canvasH, isPreviewMode, contextMenu?.nodeId, snapToGrid, gridSize],
  );

  const handleDragEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setGuides({ vertical: [], horizontal: [] });
  }, []);

  const openInlineEditor = useCallback((nodeId) => {
    const node = nodes.find((n) => String(n?.id) === String(nodeId));
    if (!node) return;
    const nodeType = String(node?.type || '');
    if (nodeType !== 'shape' && nodeType !== 'text') return;
    const props = node?.props || {};
    setInlineEditor({
      mode: nodeType === 'shape' ? 'shape' : 'text',
      nodeId: String(nodeId),
      value: String(props?.content || ''),
    });
  }, [nodes]);

  const inlineEditorLayout = useMemo(() => {
    if (!inlineEditor?.nodeId) return null;
    const node = nodes.find((n) => String(n?.id) === String(inlineEditor.nodeId));
    if (!node) return null;
    const t = getNodeTransform(node);
    const props = node?.props || {};
    const fs = Math.max(1, toNum(props?.fontSize, 24) * scale);
    const fontWeight = String(props?.fontWeight || 'normal') === 'bold' ? 'bold' : '400';
    const fontStyle = String(props?.fontStyle || 'normal') === 'italic' ? 'italic' : 'normal';
    const letterSpacing = toNum(props?.letterSpacing, 0) * scale;
    const color = String(
      props?.color || (inlineEditor.mode === 'text' ? '#000000' : '#111111'),
    );
    const textAlign = String(
      props?.textAlign || (inlineEditor.mode === 'text' ? 'left' : 'center'),
    );
    const lineHeight = Math.max(1, toNum(props?.lineHeight, inlineEditor.mode === 'text' ? 1.35 : 1.2));
    const textDecoration =
      String(props?.textDecoration || 'none') === 'underline' ? 'underline' : 'none';
    const fontFamily = String(props?.fontFamily || 'Roboto');

    const isShapeInline = inlineEditor.mode === 'shape';
    const shapePadX = isShapeInline ? 8 * scale : 0;
    const shapePadY = isShapeInline ? 6 * scale : 0;
    const left = pan.x + t.x * scale + shapePadX;
    const top = pan.y + t.y * scale + shapePadY;
    const width = Math.max(24, t.width * scale - shapePadX * 2);
    const height = Math.max(20, t.height * scale - shapePadY * 2);
    const rotation = toNum(t.rotation, 0);

    return {
      left,
      top,
      width,
      height,
      rotation,
      fontSize: Math.max(10, fs),
      fontFamily,
      fontWeight,
      fontStyle,
      letterSpacing,
      color,
      textAlign,
      lineHeight,
      textDecoration,
    };
  }, [inlineEditor, nodes, pan.x, pan.y, scale]);

  useEffect(() => {
    if (!inlineEditor?.nodeId) return;
    if (!nodes.some((n) => String(n?.id) === String(inlineEditor.nodeId))) {
      setInlineEditor(null);
    }
  }, [inlineEditor?.nodeId, nodes]);

  const applyInlineEditor = useCallback(() => {
    if (!inlineEditor?.nodeId) return;
    const node = nodes.find((n) => String(n?.id) === String(inlineEditor.nodeId));
    if (!node) {
      setInlineEditor(null);
      return;
    }
    const nextContent = String(inlineEditor.value || '');
    if (inlineEditor.mode === 'text') {
      const base = { ...(node.props || {}), content: nextContent };
      delete base.richSpans;
      commitNode(inlineEditor.nodeId, { props: base });
    } else {
      commitNode(inlineEditor.nodeId, {
        props: {
          ...(node.props || {}),
          content: nextContent,
        },
      });
    }
    setInlineEditor(null);
  }, [inlineEditor, nodes, commitNode]);

  const syncInlineTextareaMetrics = useCallback(() => {
    const el = inlineTextareaRef.current;
    if (!el || !inlineEditor) return;
    if (inlineEditor.mode === 'text') {
      el.style.paddingTop = '0px';
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
      return;
    }
    // Em shape, simulamos o verticalAlign "middle" do Konva.
    el.style.height = `${Math.max(el.clientHeight, 20)}px`;
    el.style.paddingTop = '0px';
    const freeSpace = Math.max(0, el.clientHeight - el.scrollHeight);
    el.style.paddingTop = `${Math.floor(freeSpace / 2)}px`;
  }, [inlineEditor]);

  useEffect(() => {
    if (!inlineEditor) return;
    syncInlineTextareaMetrics();
  }, [inlineEditor?.value, inlineEditor?.nodeId, inlineEditor?.mode, inlineEditorLayout?.height, syncInlineTextareaMetrics]);

  // O Transformer fica por cima do Group e intercepta o duplo clique. Tratamos no Stage (alvo = nó ou Transformer).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || isPreviewMode) return undefined;

    const tryOpen = (e) => {
      if (!selectedId) return;
      const node = nodes.find((n) => String(n?.id) === String(selectedId));
      const type = String(node?.type || '');
      if (type !== 'text' && type !== 'shape') return;

      const tr = transformerRef.current;
      const wantId = `node-${selectedId}`;
      let t = e.target;
      while (t && t !== stage) {
        if (tr && t === tr) {
          e.cancelBubble = true;
          openInlineEditor(selectedId);
          return;
        }
        if (typeof t.id === 'function' && t.id() === wantId) {
          e.cancelBubble = true;
          openInlineEditor(selectedId);
          return;
        }
        t = t.getParent();
      }
    };

    stage.on('dblclick', tryOpen);
    stage.on('dbltap', tryOpen);
    return () => {
      stage.off('dblclick', tryOpen);
      stage.off('dbltap', tryOpen);
    };
  }, [isPreviewMode, selectedId, nodes, openInlineEditor]);

  const handleWheel = useCallback(
    (e) => {
      e.evt.preventDefault();
      if (isPreviewMode) return;
      const dir = e.evt.deltaY > 0 ? -1 : 1;
      const nextZoom = clamp(zoom + dir * 0.1, 0.25, 3);
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        setZoom(Math.round(nextZoom * 100) / 100);
        return;
      }
      const oldScale = scale;
      const newScale = clamp(fitScale * nextZoom, 0.1, 3);
      const pointTo = {
        x: (pointer.x - pan.x) / oldScale,
        y: (pointer.y - pan.y) / oldScale,
      };
      const nextPan = {
        x: pointer.x - pointTo.x * newScale,
        y: pointer.y - pointTo.y * newScale,
      };
      setZoom(Math.round(nextZoom * 100) / 100);
      setPan(clampPanToViewport(nextPan, viewport, canvasW, canvasH, newScale));
    },
    [zoom, isPreviewMode, scale, fitScale, pan, viewport, canvasW, canvasH],
  );

  /**
   * Pan da câmara só com o rato: botão do meio em qualquer sítio, ou botão esquerdo no fundo da página.
   * Eventos no window para o arrasto continuar se o cursor sair do canvas.
   */
  const handleCameraPanStart = useCallback(
    (e) => {
      if (isPreviewMode) return;
      const native = e?.evt;
      if (!native) return;

      const stage = e.target?.getStage?.();
      const tgt = e.target;
      const isMiddle = native.button === 1 || native.buttons === 4;
      const isLeftOnPageBg =
        (native.button === 0 || native.buttons === 1) &&
        Boolean(stage) &&
        (tgt === stage || tgt?.name?.() === 'background');

      if (!isMiddle && !isLeftOnPageBg) return;

      if (typeof native.preventDefault === 'function') {
        native.preventDefault();
      }

      const startX = native.clientX;
      const startY = native.clientY;
      const initialPanX = pan.x;
      const initialPanY = pan.y;

      const onMove = (ev) => {
        const cx = Number(ev?.clientX);
        const cy = Number(ev?.clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        document.body.style.cursor = 'grabbing';
        setPan(
          clampPanToViewport(
            { x: initialPanX + (cx - startX), y: initialPanY + (cy - startY) },
            viewport,
            canvasW,
            canvasH,
            scale,
          ),
        );
      };

      const onUp = () => {
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('blur', onUp);
      };

      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('blur', onUp);
    },
    [isPreviewMode, pan.x, pan.y, viewport, canvasW, canvasH, scale],
  );

  const getAnchoredContextMenuPosition = useCallback((nodeId) => {
    if (!nodeId) return null;
    const stage = stageRef.current;
    if (!stage) return null;
    const container = stage.container?.();
    if (!container) return null;
    const containerRect = container.getBoundingClientRect?.();
    if (!containerRect) return null;
    const konvaNode = stage.findOne(`#node-${String(nodeId)}`);
    const box = getSafeClientRect(konvaNode);
    if (!box) return null;

    return resolveContextMenuPositionFromViewportBox({
      x: containerRect.left + box.x,
      y: containerRect.top + box.y,
      width: box.width,
      height: box.height,
    });
  }, []);

  const handleNodeContextMenu = useCallback(
    (e, nodeId) => {
      const wrap = stageWrapRef.current;
      if (!wrap) return;
      const clientX = Number(e?.evt?.clientX || 0);
      const clientY = Number(e?.evt?.clientY || 0);
      const anchored = getAnchoredContextMenuPosition(nodeId);
      setSelectedId?.(nodeId);
      setContextMenu({
        nodeId: String(nodeId),
        x: anchored?.x ?? Math.max(8, Math.min(window.innerWidth - CONTEXT_MENU_WIDTH, clientX + 8)),
        y: anchored?.y ?? Math.max(8, Math.min(window.innerHeight - CONTEXT_MENU_HEIGHT, clientY + 8)),
      });
    },
    [setSelectedId, getAnchoredContextMenuPosition],
  );

  const handleStageContextMenu = useCallback(
    (e) => {
      e.evt.preventDefault();
      if (isPreviewMode) return;

      const stage = stageRef.current;
      if (!stage) return;
      const tr = transformerRef.current;

      let target = e.target;
      while (target && target !== stage) {
        if (tr && target === tr) {
          if (selectedId) {
            const node = nodes.find((n) => String(n?.id) === String(selectedId));
            const t = String(node?.type || '');
            if (t === 'text' || t === 'shape' || t === 'image' || t === 'video') {
              handleNodeContextMenu(e, selectedId);
            }
          }
          return;
        }
        if (typeof target.id === 'function') {
          const sid = target.id();
          if (typeof sid === 'string' && sid.startsWith('node-')) {
            const nodeId = sid.replace(/^node-/, '');
            handleNodeContextMenu(e, nodeId);
            return;
          }
        }
        target = target.getParent();
      }
    },
    [isPreviewMode, selectedId, nodes, handleNodeContextMenu],
  );

  const sorted = useMemo(() => {
    return nodes.slice().sort((a, b) => toNum(a?.zIndex, 0) - toNum(b?.zIndex, 0));
  }, [nodes]);

  const sortedForTimeline = useMemo(() => {
    if (timelineStep === undefined || timelineStep === null) {
      return sorted.filter((n) => !isNodeHidden(n));
    }
    const cap = Math.max(0, Math.trunc(Number(timelineStep)));
    return sorted.filter(
      (n) =>
        !isNodeHidden(n) &&
        (Number.isFinite(Number(n?.step)) ? Number(n.step) : 0) <= cap,
    );
  }, [sorted, timelineStep]);

  const baseGifNode = useMemo(() => {
    return sortedForTimeline.find((n) => {
      if (n?.type !== 'image') return false;
      if (!nodeIsAnimatedGif(n)) return false;
      const t = getNodeTransform(n);
      const coversCanvas =
        t.x <= 1 && t.y <= 1 && t.width >= canvasW - 1 && t.height >= canvasH - 1;
      return coversCanvas && toNum(n?.zIndex, 0) <= 0;
    }) || null;
  }, [sortedForTimeline, canvasW, canvasH]);

  const baseGifProps = baseGifNode?.props || {};
  const baseGifUrl = useResolvedStorageUrl(
    String(baseGifProps?.content || ''),
    baseGifProps?.storage,
  );
  const baseGifTransform = baseGifNode ? getNodeTransform(baseGifNode) : null;
  const htmlBaseGifActive = Boolean(baseGifNode && baseGifUrl && baseGifTransform);

  const nodesForStage = useMemo(() => {
    if (!htmlBaseGifActive || !baseGifNode) return sortedForTimeline;
    const skipId = String(baseGifNode.id || '');
    return sortedForTimeline.filter((n) => String(n?.id || '') !== skipId);
  }, [sortedForTimeline, htmlBaseGifActive, baseGifNode]);

  const gridGuides = useMemo(() => {
    if (!showGrid || gridSize < 8) return { vertical: [], horizontal: [] };
    const vertical = [];
    const horizontal = [];
    for (let x = gridSize; x < canvasW; x += gridSize) vertical.push(x);
    for (let y = gridSize; y < canvasH; y += gridSize) horizontal.push(y);
    return { vertical, horizontal };
  }, [showGrid, gridSize, canvasW, canvasH]);

  const selectedNode = useMemo(() => {
    if (!contextMenu?.nodeId) return null;
    return nodes.find((n) => String(n?.id) === String(contextMenu.nodeId)) || null;
  }, [contextMenu?.nodeId, nodes]);
  const selectedType = String(selectedNode?.type || '');
  const selectedZIndex = Math.max(0, Math.trunc(toNum(selectedNode?.zIndex, 0)));
  const selectedStep = Math.max(0, Math.trunc(toNum(selectedNode?.step, 0)));
  const selectedOpacity = clamp(toNum(selectedNode?.props?.opacity, 1), 0, 1);

  const quickPatchNode = useCallback(
    (patch) => {
      const nodeId = contextMenu?.nodeId;
      if (!nodeId) return;
      const original = nodes.find((n) => String(n?.id) === String(nodeId));
      if (!original) return;
      if (patch?.props && typeof patch.props === 'object') {
        commitNode(nodeId, { ...patch, props: { ...(original.props || {}), ...patch.props } });
        return;
      }
      commitNode(nodeId, patch);
    },
    [contextMenu?.nodeId, nodes, commitNode],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu?.nodeId) return;
    const anchored = getAnchoredContextMenuPosition(contextMenu.nodeId);
    if (!anchored) return;
    setContextMenu((prev) => {
      if (!prev || String(prev.nodeId) !== String(contextMenu.nodeId)) return prev;
      const sameX = Math.abs(toNum(prev.x, 0) - anchored.x) < 0.5;
      const sameY = Math.abs(toNum(prev.y, 0) - anchored.y) < 0.5;
      if (sameX && sameY) return prev;
      return { ...prev, x: anchored.x, y: anchored.y };
    });
  }, [contextMenu?.nodeId, getAnchoredContextMenuPosition, pan.x, pan.y, scale, viewport.width, viewport.height, nodes]);

  const konvaGifNodes = useMemo(() => {
    return nodesForStage.filter((n) => n?.type === 'image' && nodeIsAnimatedGif(n));
  }, [nodesForStage]);

  const bgDraw = useMemo(() => {
    if (!bgImage) return null;
    const iw = toNum(bgImage.width, 0);
    const ih = toNum(bgImage.height, 0);
    if (iw <= 0 || ih <= 0) {
      return { x: 0, y: 0, width: canvasW, height: canvasH };
    }
    const coverScale = Math.max(canvasW / iw, canvasH / ih);
    const finalScale = coverScale * bgScale;
    const drawW = iw * finalScale;
    const drawH = ih * finalScale;
    const rangeX = Math.max(0, drawW - canvasW);
    const rangeY = Math.max(0, drawH - canvasH);
    const x = -rangeX * bgPosition.x;
    const y = -rangeY * bgPosition.y;
    return { x, y, width: drawW, height: drawH };
  }, [bgImage, canvasW, canvasH, bgScale, bgPosition.x, bgPosition.y]);

  /** GIF no fundo: Konva/canvas costuma mostrar 1 frame; <img> HTML anima nativamente (camada sob o Stage). */
  const htmlGifBackgroundActive = useMemo(
    () => backgroundIsAnimatedGif(bgUrl, bgRaw) && Boolean(bgUrl && bgDraw && bgImage),
    [bgUrl, bgRaw, bgDraw, bgImage],
  );

  const hasGifOnPage = useMemo(() => {
    // Limitador de performance: com muitos GIFs, o redraw por frame trava UI.
    // Mantemos animação “ativa” no canvas apenas se existir no máximo 1 GIF Konva.
    const shouldAnimateKonvaGifs = konvaGifNodes.length > 0 && konvaGifNodes.length <= 1;
    if (shouldAnimateKonvaGifs) return true;
    // background GIF só precisa de redraw quando NÃO estamos usando HTML layer.
    if (backgroundIsAnimatedGif(bgUrl, bgRaw) && !htmlGifBackgroundActive) return true;
    return false;
  }, [bgUrl, bgRaw, konvaGifNodes.length, htmlGifBackgroundActive]);

  /** GIF no canvas: o browser so avanca frames se drawImage for chamado de novo; Konva.Animation vazio nao garante batchDraw. */
  useEffect(() => {
    if (!hasGifOnPage) return undefined;
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const layer = contentLayerRef.current;
      if (layer) layer.batchDraw();
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
    };
  }, [hasGifOnPage]);

  return (
    <div
      ref={stageWrapRef}
      className="relative h-full w-full overflow-hidden bg-gray-900"
      style={{ touchAction: 'none' }}
    >
      {!isPreviewMode && (
        <div className="absolute left-3 top-3 z-50 flex max-w-[min(100%,24rem)] flex-col gap-1 rounded border border-gray-700 bg-gray-950/70 px-3 py-2 text-xs text-gray-200 backdrop-blur sm:max-w-none sm:flex-row sm:items-center sm:gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
              onClick={() => setZoom((z) => clamp(Math.round((z - 0.1) * 100) / 100, 0.25, 3))}
            >
              -
            </button>
            <div className="w-20 text-center">{Math.round(scale * 100)}%</div>
            <button
              type="button"
              className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
              onClick={() => setZoom((z) => clamp(Math.round((z + 0.1) * 100) / 100, 0.25, 3))}
            >
              +
            </button>
            <button type="button" className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700" onClick={() => setZoom(1)}>
              100%
            </button>
          </div>
          <p className="text-[10px] leading-snug text-gray-500 sm:max-w-[18rem] sm:border-l sm:border-gray-700 sm:pl-2">
            Mover vista: botao do meio e arrastar, ou botao esquerdo no fundo branco da pagina. Rolagem: zoom.
          </p>
        </div>
      )}

      {!isPreviewMode && selectedVideoNode ? (
        <SelectedVideoFloatingPreview key={String(selectedVideoNode.id)} node={selectedVideoNode} />
      ) : null}

      {htmlGifBackgroundActive && bgUrl && bgDraw ? (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          <div className="absolute left-0 top-0" style={{ width: viewport.width, height: viewport.height }}>
            <div
              className="absolute"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                width: canvasW,
                height: canvasH,
              }}
            >
              <div className="absolute left-0 top-0 bg-white" style={{ width: canvasW, height: canvasH }} />
              <img
                src={bgUrl}
                alt=""
                draggable={false}
                className="absolute select-none"
                style={{
                  left: bgDraw.x,
                  top: bgDraw.y,
                  width: bgDraw.width,
                  height: bgDraw.height,
                  objectFit: 'fill',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {htmlBaseGifActive && baseGifTransform ? (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          <div className="absolute left-0 top-0" style={{ width: viewport.width, height: viewport.height }}>
            <div
              className="absolute"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                width: canvasW,
                height: canvasH,
              }}
            >
              <img
                src={baseGifUrl}
                alt=""
                draggable={false}
                className="absolute select-none"
                style={{
                  left: baseGifTransform.x,
                  top: baseGifTransform.y,
                  width: baseGifTransform.width,
                  height: baseGifTransform.height,
                  objectFit: 'fill',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {inlineEditor && inlineEditorLayout ? (
        <textarea
          ref={inlineTextareaRef}
          aria-label="Editar texto no canvas"
          autoFocus
          spellCheck={false}
          value={inlineEditor.value}
          onChange={(e) => {
            const nextValue = e.target.value;
            setInlineEditor((prev) => (prev ? { ...prev, value: nextValue } : prev));
            window.requestAnimationFrame(() => syncInlineTextareaMetrics());
          }}
          onBlur={applyInlineEditor}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!inlineEditor?.nodeId) return;
            const anchored = getAnchoredContextMenuPosition(inlineEditor.nodeId);
            const clientX = e.clientX;
            const clientY = e.clientY;
            setSelectedId?.(inlineEditor.nodeId);
            setContextMenu({
              nodeId: String(inlineEditor.nodeId),
              x: anchored?.x ?? Math.max(8, Math.min(window.innerWidth - CONTEXT_MENU_WIDTH, clientX + 8)),
              y: anchored?.y ?? Math.max(8, Math.min(window.innerHeight - CONTEXT_MENU_HEIGHT, clientY + 8)),
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setInlineEditor(null);
              return;
            }
            if (inlineEditor.mode === 'shape' && e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              applyInlineEditor();
              return;
            }
            if (inlineEditor.mode === 'text' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              applyInlineEditor();
            }
          }}
          className="pointer-events-auto absolute z-[4] m-0 box-border rounded-none border-0 bg-transparent p-0 shadow-none outline-none"
          style={{
            left: inlineEditorLayout.left,
            top: inlineEditorLayout.top,
            width: inlineEditorLayout.width,
            height: inlineEditorLayout.height,
            fontSize: inlineEditorLayout.fontSize,
            fontFamily: inlineEditorLayout.fontFamily,
            fontWeight: inlineEditorLayout.fontWeight,
            fontStyle: inlineEditorLayout.fontStyle,
            letterSpacing: `${inlineEditorLayout.letterSpacing}px`,
            color: inlineEditorLayout.color,
            textAlign: inlineEditorLayout.textAlign,
            lineHeight: inlineEditorLayout.lineHeight,
            textDecoration: inlineEditorLayout.textDecoration,
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'normal',
            wordBreak: 'normal',
            caretColor: inlineEditorLayout.color,
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            transform: `rotate(${inlineEditorLayout.rotation}deg)`,
            transformOrigin: 'left top',
          }}
        />
      ) : null}

      <Stage
        ref={stageRef}
        className="relative z-[2]"
        style={{ background: 'transparent' }}
        width={viewport.width}
        height={viewport.height}
        onMouseDown={handleStageMouseDown}
        onMouseDownCapture={handleCameraPanStart}
        onWheel={handleWheel}
        onContextMenu={handleStageContextMenu}
      >
        <Layer
          ref={contentLayerRef}
          x={pan.x}
          y={pan.y}
          scaleX={scale}
          scaleY={scale}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          {htmlGifBackgroundActive || htmlBaseGifActive ? (
            <Rect
              x={0}
              y={0}
              width={canvasW}
              height={canvasH}
              fill="rgba(0,0,0,0.001)"
              name="background"
            />
          ) : (
            <>
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="#ffffff" name="background" />
              {bgImage && bgDraw ? (
                <KonvaImage
                  image={bgImage}
                  x={bgDraw.x}
                  y={bgDraw.y}
                  width={bgDraw.width}
                  height={bgDraw.height}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              ) : null}
            </>
          )}

          {htmlBaseGifActive && baseGifNode && baseGifTransform ? (
            <Rect
              id={`node-${String(baseGifNode.id || '')}`}
              name="selectable"
              x={baseGifTransform.x}
              y={baseGifTransform.y}
              width={baseGifTransform.width}
              height={baseGifTransform.height}
              rotation={baseGifTransform.rotation}
              fill="rgba(0,0,0,0.001)"
              draggable={!isPreviewMode && !isNodeLocked(baseGifNode)}
              onClick={(e) => !isPreviewMode && handleSelectNode(String(baseGifNode.id || ''), e)}
              onTap={(e) => !isPreviewMode && handleSelectNode(String(baseGifNode.id || ''), e)}
              onDragEnd={(e) => {
                commitNode(String(baseGifNode.id || ''), {
                  transform: {
                    ...baseGifNode.transform,
                    x: e.target.x(),
                    y: e.target.y(),
                  },
                });
              }}
            />
          ) : null}

          {showGrid
            ? gridGuides.vertical.map((x, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[x, 0, x, canvasH]}
                stroke="rgba(148,163,184,0.2)"
                strokeWidth={1}
                listening={false}
                perfectDrawEnabled={false}
              />
            ))
            : null}
          {showGrid
            ? gridGuides.horizontal.map((y, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, y, canvasW, y]}
                stroke="rgba(148,163,184,0.2)"
                strokeWidth={1}
                listening={false}
                perfectDrawEnabled={false}
              />
            ))
            : null}

          {nodesForStage.map((node) => {
            const id = String(node?.id || '');
            const type = String(node?.type || '');
            const t = getNodeTransform(node);
            const props = node?.props || {};
            const visual = getNodeVisualProps(node);

            if (!id) return null;

            if (type === 'text') {
              return (
                <RichTextNode
                  key={id}
                  id={id}
                  node={node}
                  t={t}
                  props={props}
                  visual={visual}
                  isPreviewMode={isPreviewMode}
                  onSelectNode={handleSelectNode}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
                  timelinePlayback={timelinePlayback}
                  onStartInlineTextEdit={openInlineEditor}
                  isInlineEditing={
                    inlineEditor?.nodeId === id && inlineEditor?.mode === 'text'
                  }
                />
              );
            }

            if (type === 'image') {
              return (
                <ImageNode
                  key={id}
                  id={id}
                  node={node}
                  t={t}
                  visual={visual}
                  isPreviewMode={isPreviewMode}
                  onSelectNode={handleSelectNode}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
                  timelinePlayback={timelinePlayback}
                />
              );
            }

            if (type === 'video') {
              return (
                <VideoNode
                  key={id}
                  id={id}
                  node={node}
                  t={t}
                  visual={visual}
                  isPreviewMode={isPreviewMode}
                  onSelectNode={handleSelectNode}
                  commitNode={commitNode}
                />
              );
            }

            if (type === 'shape') {
              return (
                <ShapeNode
                  key={id}
                  id={id}
                  node={node}
                  t={t}
                  visual={visual}
                  isPreviewMode={isPreviewMode}
                  onSelectNode={handleSelectNode}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
                  timelinePlayback={timelinePlayback}
                  onStartInlineTextEdit={openInlineEditor}
                  isInlineEditing={
                    inlineEditor?.nodeId === id && inlineEditor?.mode === 'shape'
                  }
                />
              );
            }

            // fallback: bounding box
            return (
              <Rect
                key={id}
                id={`node-${id}`}
                x={t.x}
                y={t.y}
                width={t.width}
                height={t.height}
                rotation={t.rotation}
                stroke="#64748b"
                dash={[6, 4]}
                draggable={!isPreviewMode && !isNodeLocked(node)}
                onClick={(e) => !isPreviewMode && handleSelectNode(id, e)}
                onDragEnd={(e) => {
                  commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
                }}
              />
            );
          })}

          {/* Moldura fixa: limites exatos da página no livro (pages_v2.canvas) */}
          <Rect
            x={0}
            y={0}
            width={canvasW}
            height={canvasH}
            fillEnabled={false}
            stroke="rgba(99, 102, 241, 0.9)"
            strokeWidth={2}
            dash={[14, 8]}
            listening={false}
            perfectDrawEnabled={false}
            name="book-page-frame"
          />

          {!isPreviewMode ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              padding={inlineEditor ? 14 : 0}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                if (newBox.x < 0 || newBox.y < 0) return oldBox;
                if (newBox.x + newBox.width > canvasW) return oldBox;
                if (newBox.y + newBox.height > canvasH) return oldBox;
                return newBox;
              }}
              onTransform={() => {
                if (!contextMenu?.nodeId || !selectedId) return;
                if (String(contextMenu.nodeId) !== String(selectedId)) return;
                const anchored = getAnchoredContextMenuPosition(selectedId);
                if (!anchored) return;
                setContextMenu((prev) => {
                  if (!prev || String(prev.nodeId) !== String(selectedId)) return prev;
                  const sameX = Math.abs(toNum(prev.x, 0) - anchored.x) < 0.5;
                  const sameY = Math.abs(toNum(prev.y, 0) - anchored.y) < 0.5;
                  if (sameX && sameY) return prev;
                  return { ...prev, x: anchored.x, y: anchored.y };
                });
              }}
              onTransformEnd={() => {
                const stage = stageRef.current;
                const tr = transformerRef.current;
                if (!stage || !tr) return;
                const targets = tr.nodes() || [];
                if (!targets.length) return;
                targets.forEach((n) => {
                  const rawId = typeof n.id === 'function' ? n.id() : '';
                  const nodeId = String(rawId || '').replace(/^node-/, '');
                  if (!nodeId) return;
                  const nodeObj = nodes.find((x) => String(x?.id) === nodeId);
                  if (!nodeObj) return;
                  const scaleX = n.scaleX();
                  const scaleY = n.scaleY();
                  n.scaleX(1);
                  n.scaleY(1);
                  commitNode(nodeId, {
                    transform: {
                      ...nodeObj.transform,
                      x: n.x(),
                      y: n.y(),
                      rotation: n.rotation(),
                      width: Math.max(1, n.width() * scaleX),
                      height: Math.max(1, n.height() * scaleY),
                    },
                  });
                });
              }}
            />
          ) : null}

          {/* Guias de alinhamento (snap) */}
          {guides.vertical.map((g, i) => (
            <Line
              key={`guide-v-${i}`}
              points={[round2(g.x), 0, round2(g.x), canvasH]}
              stroke={g.kind === 'grid' ? 'rgba(56,189,248,0.9)' : 'rgba(244,63,94,0.9)'}
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
          {guides.horizontal.map((g, i) => (
            <Line
              key={`guide-h-${i}`}
              points={[0, round2(g.y), canvasW, round2(g.y)]}
              stroke={g.kind === 'grid' ? 'rgba(56,189,248,0.9)' : 'rgba(244,63,94,0.9)'}
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
        </Layer>
      </Stage>
      {canUsePortal && contextMenu
        ? createPortal(
        <div
          className="z-[9999] min-w-[240px] rounded-xl border border-indigo-200/10 bg-slate-900/95 p-2 text-slate-100 shadow-2xl backdrop-blur"
          style={{ left: contextMenu.x, top: contextMenu.y, position: 'fixed' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-slate-800"
            onClick={() => {
              onRequestPropertiesPanel?.();
              setContextMenu(null);
            }}
          >
            Abrir propriedades
          </button>
          {selectedType === 'text' || selectedType === 'shape' ? (
            <>
              <div className="my-1.5 border-t border-slate-700/80" />
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {selectedType === 'text' ? 'Texto' : 'Texto da forma'}
              </div>
              <div className="space-y-2 px-2.5 py-1">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={String(selectedNode?.props?.fontFamily || 'Roboto')}
                    onChange={(e) => quickPatchNode({ props: { fontFamily: e.target.value } })}
                    className="col-span-2 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  >
                    {QUICK_FONT_OPTIONS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={8}
                    max={180}
                    step={1}
                    value={Math.max(8, Math.trunc(toNum(selectedNode?.props?.fontSize, 24)))}
                    onChange={(e) =>
                      quickPatchNode({ props: { fontSize: Math.max(8, Math.trunc(toNum(e.target.value, 24))) } })
                    }
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  />
                  <input
                    type="color"
                    value={String(selectedNode?.props?.color || '#111111')}
                    onChange={(e) => quickPatchNode({ props: { color: e.target.value } })}
                    className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-1"
                  />
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {['#111111', '#ffffff', '#6366f1', '#4338ca', '#ef4444', '#22c55e'].map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      title={sw}
                      onClick={() => quickPatchNode({ props: { color: sw } })}
                      className="h-6 w-full rounded border border-slate-700"
                      style={{ backgroundColor: sw }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {['left', 'center', 'right'].map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => quickPatchNode({ props: { textAlign: al } })}
                      className={`rounded px-2 py-1 text-xs ${
                        String(selectedNode?.props?.textAlign || 'left') === al
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {al === 'left' ? 'Esq' : al === 'center' ? 'Centro' : 'Dir'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      quickPatchNode({
                        props: {
                          fontWeight: String(selectedNode?.props?.fontWeight || 'normal') === 'bold' ? 'normal' : 'bold',
                        },
                      })
                    }
                    className={`rounded px-2 py-1 text-xs ${
                      String(selectedNode?.props?.fontWeight || 'normal') === 'bold'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickPatchNode({
                        props: {
                          fontStyle: String(selectedNode?.props?.fontStyle || 'normal') === 'italic' ? 'normal' : 'italic',
                        },
                      })
                    }
                    className={`rounded px-2 py-1 text-xs italic ${
                      String(selectedNode?.props?.fontStyle || 'normal') === 'italic'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickPatchNode({
                        props: {
                          textDecoration:
                            String(selectedNode?.props?.textDecoration || 'none') === 'underline'
                              ? 'none'
                              : 'underline',
                        },
                      })
                    }
                    className={`rounded px-2 py-1 text-xs ${
                      String(selectedNode?.props?.textDecoration || 'none') === 'underline'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    U
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {selectedType === 'shape' ? (
            <>
              <div className="my-1.5 border-t border-slate-700/80" />
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Forma
              </div>
              <div className="grid grid-cols-2 gap-2 px-2.5 py-1">
                <label className="text-xs text-slate-300">
                  <span className="mb-1 block">Preenchimento</span>
                  <input
                    type="color"
                    value={String(selectedNode?.props?.shapeProperties?.fill || '#fcfdff')}
                    onChange={(e) =>
                      quickPatchNode({
                        props: {
                          shapeProperties: {
                            ...(selectedNode?.props?.shapeProperties || {}),
                            fill: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-1"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  <span className="mb-1 block">Contorno</span>
                  <input
                    type="color"
                    value={String(selectedNode?.props?.strokeColor || '#0d0d0d')}
                    onChange={(e) => quickPatchNode({ props: { strokeColor: e.target.value } })}
                    className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-1"
                  />
                </label>
                <label className="col-span-2 text-xs text-slate-300">
                  <span className="mb-1 block">Espessura do contorno</span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={Math.max(0, Math.trunc(toNum(selectedNode?.props?.strokeWidth, 2)))}
                    onChange={(e) => quickPatchNode({ props: { strokeWidth: Math.max(0, Math.trunc(toNum(e.target.value, 2))) } })}
                    className="w-full accent-indigo-500"
                  />
                </label>
              </div>
            </>
          ) : null}
          {selectedType === 'image' ? (
            <>
              <div className="my-1.5 border-t border-slate-700/80" />
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Imagem
              </div>
              <div className="space-y-2 px-2.5 py-1">
                <button
                  type="button"
                  className="w-full rounded-lg bg-slate-800 px-2.5 py-2 text-left text-xs text-slate-100 transition-colors hover:bg-slate-700"
                  onClick={() => quickPatchNode({ transform: { ...(selectedNode?.transform || {}), x: 0, y: 0 } })}
                >
                  Posicionar no canto (0,0)
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg bg-slate-800 px-2.5 py-2 text-left text-xs text-slate-100 transition-colors hover:bg-slate-700"
                  onClick={() =>
                    quickPatchNode({
                      transform: {
                        ...(selectedNode?.transform || {}),
                        x: 0,
                        y: 0,
                        width: canvasW,
                        height: canvasH,
                        rotation: 0,
                      },
                    })
                  }
                >
                  Ajustar para o canvas
                </button>
              </div>
            </>
          ) : null}
          <div className="my-1.5 border-t border-slate-700/80" />
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Camada
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-slate-800"
            onClick={() => {
              quickPatchNode({ zIndex: selectedZIndex + 1 });
            }}
          >
            Subir camada
            <span className="text-xs text-slate-400">{selectedZIndex + 1}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-slate-800"
            onClick={() => {
              quickPatchNode({ zIndex: Math.max(0, selectedZIndex - 1) });
            }}
          >
            Descer camada
            <span className="text-xs text-slate-400">{Math.max(0, selectedZIndex - 1)}</span>
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-slate-800"
            onClick={() => {
              quickPatchNode({ zIndex: 9999 });
            }}
          >
            Trazer para frente
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-slate-800"
            onClick={() => {
              quickPatchNode({ zIndex: 0 });
            }}
          >
            Enviar para trás
          </button>
          <div className="my-1.5 border-t border-slate-700/80" />
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Etapa e opacidade
          </div>
          <div className="space-y-2 px-2.5 py-1">
            <label className="flex items-center justify-between gap-2 text-xs text-slate-200">
              <span>Etapa</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                value={selectedStep}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(20, Math.trunc(toNum(e.target.value, 0))));
                  quickPatchNode({ step: v });
                }}
                className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100"
              />
            </label>
            <label className="block text-xs text-slate-200">
              <div className="mb-1 flex items-center justify-between">
                <span>Opacidade</span>
                <span className="text-slate-300">{Math.round(selectedOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedOpacity}
                onChange={(e) => {
                  quickPatchNode({ props: { opacity: clamp(toNum(e.target.value, 1), 0, 1) } });
                }}
                className="w-full accent-indigo-500"
              />
            </label>
          </div>
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}


