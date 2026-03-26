import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { storageSignedGetUrl } from '../../lib/storageApi';

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampPanToViewport(pan, viewport, canvasW, canvasH, scale) {
  const contentW = canvasW * scale;
  const contentH = canvasH * scale;
  const minX = Math.min(0, viewport.width - contentW);
  const minY = Math.min(0, viewport.height - contentH);
  const maxX = Math.max(0, viewport.width - contentW);
  const maxY = Math.max(0, viewport.height - contentH);
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

function useResolvedStorageUrl(url, storage) {
  const filePath = typeof storage?.filePath === 'string' ? storage.filePath.trim() : '';
  const bucket =
    typeof storage?.bucket === 'string' && storage.bucket.trim() ? storage.bucket.trim() : 'pages';
  const [resolved, setResolved] = useState(() => String(url || ''));
  useEffect(() => {
    const staticUrl = String(url || '');
    if (!filePath) {
      setResolved(staticUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const signed = await storageSignedGetUrl(bucket, filePath);
        if (!cancelled) setResolved(signed || staticUrl);
      } catch {
        if (!cancelled) setResolved(staticUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, filePath, bucket]);
  return resolved;
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
  setSelectedId,
  commitNode,
  elementAnimationTest,
}) {
  const props = node?.props || {};
  const img = useStorageBackedImageUrl(String(props?.content || ''), props?.storage);

  const imgRef = useRef(null);

  useEffect(() => {
    const test = elementAnimationTest;
    if (!test?.nonce) return;
    if (String(test?.elementId || '') !== String(id)) return;

    const target = imgRef.current;
    if (!target) return;

    const anim = String(test?.animation || '').trim().toLowerCase();
    if (!anim) return;

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
  }, [elementAnimationTest?.nonce, id, t.x, t.y, visual?.opacity]);

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
      draggable={!isPreviewMode}
      onClick={() => !isPreviewMode && setSelectedId?.(id)}
      onTap={() => !isPreviewMode && setSelectedId?.(id)}
      onDragEnd={(e) => {
        commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
      }}
    />
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
  const shadowOpacity = clamp(toNum(props?.shadowOpacity, 0), 0, 1);
  return {
    opacity: clamp(toNum(props?.opacity, 1), 0, 1),
    stroke: strokeWidth > 0 && typeof props?.strokeColor === 'string' ? props.strokeColor : undefined,
    strokeWidth,
    shadowColor: typeof props?.shadowColor === 'string' ? props.shadowColor : undefined,
    shadowBlur,
    shadowOffsetX: toNum(props?.shadowOffsetX, 0),
    shadowOffsetY: toNum(props?.shadowOffsetY, 0),
    shadowOpacity,
  };
}

function parseRichSpans(raw, spans) {
  const text = String(raw || '');
  /** @type {Array<{bold:boolean,italic:boolean,underline:boolean}>} */
  const styleByIndex = Array.from({ length: text.length }).map(() => ({
    bold: false,
    italic: false,
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
  setSelectedId,
  commitNode,
  elementAnimationTest,
}) {
  const tokens = useMemo(
    () => parseRichSpans(props?.content, props?.richSpans),
    [props?.content, props?.richSpans],
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

  const groupRef = useRef(null);

  useEffect(() => {
    const test = elementAnimationTest;
    if (!test?.nonce) return;
    if (String(test?.elementId || '') !== String(id)) return;

    const group = groupRef.current;
    if (!group) return;

    const anim = String(test?.animation || '').trim().toLowerCase();
    if (!anim) return;

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
  }, [elementAnimationTest?.nonce, id, t.x, t.y, visual.opacity]);

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
      draggable={!isPreviewMode}
      onClick={() => !isPreviewMode && setSelectedId?.(id)}
      onTap={() => !isPreviewMode && setSelectedId?.(id)}
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

function ShapeNode({ id, node, t, visual, isPreviewMode, setSelectedId, commitNode, elementAnimationTest }) {
  const rectRef = useRef(null);

  useEffect(() => {
    const test = elementAnimationTest;
    if (!test?.nonce) return;
    if (String(test?.elementId || '') !== String(id)) return;

    const target = rectRef.current;
    if (!target) return;

    const anim = String(test?.animation || '').trim().toLowerCase();
    if (!anim) return;

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
  }, [elementAnimationTest?.nonce, id, t.x, t.y, visual?.opacity]);

  return (
    <Rect
      ref={rectRef}
      key={id}
      id={`node-${id}`}
      name="selectable"
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      fill={getNodeFill(node)}
      stroke={visual.stroke || '#0d0d0d'}
      strokeWidth={visual.strokeWidth > 0 ? visual.strokeWidth : 2}
      opacity={visual.opacity}
      shadowColor={visual.shadowColor}
      shadowBlur={visual.shadowBlur}
      shadowOffsetX={visual.shadowOffsetX}
      shadowOffsetY={visual.shadowOffsetY}
      shadowOpacity={visual.shadowOpacity}
      draggable={!isPreviewMode}
      onClick={() => !isPreviewMode && setSelectedId?.(id)}
      onTap={() => !isPreviewMode && setSelectedId?.(id)}
      onDragEnd={(e) => {
        commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
      }}
    />
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
}) {
  const canvasW = toNum(pagesV2?.canvas?.width, 1280);
  const canvasH = toNum(pagesV2?.canvas?.height, 720);
  const page = pagesV2?.pages?.[pageIndex] || null;
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];

  const stageWrapRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const contentLayerRef = useRef(null);

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
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);
  const suppressContextMenuRef = useRef(false);

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
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const selectedNode = stage.findOne(`#node-${selectedId}`);
    if (selectedNode) {
      tr.nodes([selectedNode]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, isPreviewMode, timelineStep]);

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
        setSelectedId?.(null);
      }
    },
    [isPreviewMode, setSelectedId],
  );

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

  const handlePanStart = useCallback(
    (e) => {
      if (isPreviewMode) return;
      // Pan: segurar Space (recomendado) OU Shift (fallback)
      const isMiddleMouse = e?.evt?.button === 1 || e?.evt?.buttons === 4;
      const isRightMouse = e?.evt?.button === 2 || e?.evt?.buttons === 2;
      const hasSpace = Boolean(window.__LUDITECA_SPACE_PAN);
      if (!isMiddleMouse && !isRightMouse && !hasSpace && !e.evt?.shiftKey) return;
      if (isRightMouse) {
        suppressContextMenuRef.current = true;
      }
      setIsPanning(true);
      panStartRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [isPreviewMode, pan],
  );

  const handlePanMove = useCallback(
    (e) => {
      if (!isPanning) return;
      const st = panStartRef.current;
      if (!st) return;
      const nextPan = { x: st.panX + (e.evt.clientX - st.x), y: st.panY + (e.evt.clientY - st.y) };
      setPan(clampPanToViewport(nextPan, viewport, canvasW, canvasH, scale));
    },
    [isPanning, viewport, canvasW, canvasH, scale],
  );

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e) => {
    if (isPanning || suppressContextMenuRef.current) {
      e.evt.preventDefault();
      suppressContextMenuRef.current = false;
    }
  }, [isPanning]);

  const sorted = useMemo(() => {
    return nodes.slice().sort((a, b) => toNum(a?.zIndex, 0) - toNum(b?.zIndex, 0));
  }, [nodes]);

  const sortedForTimeline = useMemo(() => {
    if (timelineStep === undefined || timelineStep === null) return sorted;
    const cap = Math.max(0, Math.trunc(Number(timelineStep)));
    return sorted.filter((n) => (Number.isFinite(Number(n?.step)) ? Number(n.step) : 0) <= cap);
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
    <div ref={stageWrapRef} className="relative h-full w-full overflow-hidden bg-gray-900">
      {!isPreviewMode && (
        <div className="absolute left-3 top-3 z-50 flex items-center gap-2 rounded border border-gray-700 bg-gray-950/70 px-3 py-2 text-xs text-gray-200 backdrop-blur">
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
          <div className="ml-2 text-[10px] text-gray-400">Pan: segure Espaço e arraste (ou Shift)</div>
          <div className="text-[10px] text-gray-500">Tambem funciona com botao direito</div>
        </div>
      )}

      {/* Captura Space para pan (global, somente enquanto este componente estiver montado) */}
      {!isPreviewMode ? (
        <SpacePanCapture />
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

      <Stage
        ref={stageRef}
        className="relative z-[2]"
        style={{ background: 'transparent' }}
        width={viewport.width}
        height={viewport.height}
        onMouseDown={handleStageMouseDown}
        onWheel={handleWheel}
        onMouseDownCapture={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onContextMenu={handleContextMenu}
      >
        <Layer ref={contentLayerRef} x={pan.x} y={pan.y} scaleX={scale} scaleY={scale}>
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
              draggable={!isPreviewMode}
              onClick={() => !isPreviewMode && setSelectedId?.(String(baseGifNode.id || ''))}
              onTap={() => !isPreviewMode && setSelectedId?.(String(baseGifNode.id || ''))}
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
                  setSelectedId={setSelectedId}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
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
                  setSelectedId={setSelectedId}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
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
                  setSelectedId={setSelectedId}
                  commitNode={commitNode}
                  elementAnimationTest={elementAnimationTest}
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
                draggable={!isPreviewMode}
                onClick={() => !isPreviewMode && setSelectedId?.(id)}
                onDragEnd={(e) => {
                  commitNode(id, { transform: { ...node.transform, x: e.target.x(), y: e.target.y() } });
                }}
              />
            );
          })}

          {!isPreviewMode ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                if (newBox.x < 0 || newBox.y < 0) return oldBox;
                if (newBox.x + newBox.width > canvasW) return oldBox;
                if (newBox.y + newBox.height > canvasH) return oldBox;
                return newBox;
              }}
              onTransformEnd={() => {
                const stage = stageRef.current;
                if (!stage || !selectedId) return;
                const n = stage.findOne(`#node-${selectedId}`);
                if (!n) return;
                const nodeObj = nodes.find((x) => String(x?.id) === String(selectedId));
                if (!nodeObj) return;
                const scaleX = n.scaleX();
                const scaleY = n.scaleY();
                n.scaleX(1);
                n.scaleY(1);
                commitNode(selectedId, {
                  transform: {
                    ...nodeObj.transform,
                    x: n.x(),
                    y: n.y(),
                    rotation: n.rotation(),
                    width: Math.max(1, n.width() * scaleX),
                    height: Math.max(1, n.height() * scaleY),
                  },
                });
              }}
            />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}

function SpacePanCapture() {
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space') {
        window.__LUDITECA_SPACE_PAN = true;
      }
    };
    const onUp = (e) => {
      if (e.code === 'Space') {
        window.__LUDITECA_SPACE_PAN = false;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.__LUDITECA_SPACE_PAN = false;
    };
  }, []);
  return null;
}

