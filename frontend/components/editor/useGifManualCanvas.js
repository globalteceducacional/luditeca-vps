import { useEffect, useRef, useState } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { clamp, toNum } from '../../lib/editorUtils';

const MIN_FRAME_DELAY_MS = 20;

/**
 * Decodifica o GIF, desenha num canvas e anima com controlo de velocidade e repetições.
 * @param {string} resolvedUrl URL resolvida (presign)
 * @param {{ speed: number, infiniteLoop: boolean, repeatCount: number, onFrame?: () => void }} opts
 * @param {boolean} enabled
 * @returns {{ canvas: HTMLCanvasElement | null, error: string | null }}
 */
export function useGifManualCanvas(resolvedUrl, opts, enabled) {
  const { speed: speedIn, infiniteLoop, repeatCount: repeatIn, onFrame } = opts;
  const speed = clamp(toNum(speedIn, 1), 0.25, 4);
  const repeatCount = Math.max(1, Math.trunc(toNum(repeatIn, 1)));
  const infinite = infiniteLoop !== false;

  const [canvas, setCanvas] = useState(null);
  const [error, setError] = useState(null);
  const onFrameRef = useRef(onFrame);
  const timeoutRef = useRef(null);
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!enabled || !resolvedUrl) {
      setCanvas(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const ac = new AbortController();
    setError(null);

    const clearScheduled = () => {
      const id = timeoutRef.current;
      if (id != null) {
        window.clearTimeout(id);
        timeoutRef.current = null;
      }
    };

    const run = async () => {
      try {
        const res = await fetch(resolvedUrl, {
          signal: ac.signal,
          mode: 'cors',
          credentials: 'omit',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const gif = parseGIF(buf);
        const frames = decompressFrames(gif, true);
        if (!frames.length) throw new Error('GIF sem frames');

        const w = gif.lsd.width;
        const h = gif.lsd.height;
        const canvasEl = document.createElement('canvas');
        canvasEl.width = w;
        canvasEl.height = h;
        const gifCtx = canvasEl.getContext('2d');
        if (!gifCtx) throw new Error('Canvas 2D indisponível');

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        let frameImageData = null;

        const drawPatch = (frame) => {
          const dims = frame.dims;
          if (
            !frameImageData ||
            dims.width !== frameImageData.width ||
            dims.height !== frameImageData.height
          ) {
            tempCanvas.width = dims.width;
            tempCanvas.height = dims.height;
            frameImageData = tempCtx.createImageData(dims.width, dims.height);
          }
          frameImageData.data.set(frame.patch);
          tempCtx.putImageData(frameImageData, 0, 0);
          gifCtx.drawImage(tempCanvas, dims.left, dims.top);
        };

        const drawOne = (i) => {
          if (i === 0) {
            gifCtx.clearRect(0, 0, w, h);
          } else {
            const prev = frames[i - 1];
            if (prev.disposalType === 2) {
              gifCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
            }
          }
          drawPatch(frames[i]);
        };

        if (cancelled) return;
        setCanvas(canvasEl);
        if (cancelled) return;

        let frameIdx = 0;
        let loopsCompleted = 0;

        const notify = () => {
          requestAnimationFrame(() => {
            try {
              onFrameRef.current?.();
            } catch {
              /* ignore */
            }
          });
        };

        const tick = () => {
          if (cancelled) return;
          drawOne(frameIdx);
          notify();

          const rawDelay = Number(frames[frameIdx].delay);
          const delay = Math.max(MIN_FRAME_DELAY_MS, Number.isFinite(rawDelay) ? rawDelay : 100) / speed;

          clearScheduled();
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            if (cancelled) return;
            const next = frameIdx + 1;
            if (next >= frames.length) {
              const newLoops = loopsCompleted + 1;
              if (!infinite && newLoops >= repeatCount) {
                return;
              }
              loopsCompleted = newLoops;
              frameIdx = 0;
            } else {
              frameIdx = next;
            }
            tick();
          }, delay);
        };

        if (cancelled) return;
        tick();
      } catch (e) {
        if (cancelled || ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setCanvas(null);
      }
    };

    run();

    return () => {
      cancelled = true;
      const id = timeoutRef.current;
      if (id != null) window.clearTimeout(id);
      timeoutRef.current = null;
      ac.abort();
      setCanvas(null);
    };
  }, [resolvedUrl, enabled, speed, infinite, repeatCount]);

  return { canvas, error };
}
