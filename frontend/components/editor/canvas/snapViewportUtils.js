export const CONTEXT_MENU_WIDTH = 260;
export const CONTEXT_MENU_HEIGHT = 420;
export const CONTEXT_MENU_GAP = 16;
export const CONTEXT_MENU_SCREEN_PADDING = 8;

export function getSafeClientRect(node) {
  try {
    return node?.getClientRect ? node.getClientRect() : null;
  } catch {
    return null;
  }
}

export function resolveContextMenuPositionFromViewportBox(box) {
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

export function getLineGuideStops({ stage, layer, skipId, canvasW, canvasH }) {
  const vertical = [0, canvasW / 2, canvasW];
  const horizontal = [0, canvasH / 2, canvasH];

  const all = stage?.find?.('.selectable') || [];
  all.forEach((n) => {
    if (!n || !layer) return;
    const id = String(n?.id?.() || '');
    if (skipId && id === skipId) return;
    const rect = getSafeClientRect(n);
    if (!rect) return;
    vertical.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width);
    horizontal.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height);
  });

  return { vertical, horizontal };
}

export function getObjectSnappingEdges(node) {
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

export function getGuides(lineGuideStops, itemBounds, tolerance = 6) {
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

export function clampPanToViewport(pan, viewport, canvasW, canvasH, scale, slackPx = 120) {
  const contentW = canvasW * scale;
  const contentH = canvasH * scale;
  const minX = Math.min(0, viewport.width - contentW) - slackPx;
  const minY = Math.min(0, viewport.height - contentH) - slackPx;
  const maxX = Math.max(0, viewport.width - contentW) + slackPx;
  const maxY = Math.max(0, viewport.height - contentH) + slackPx;
  return {
    x: Math.max(minX, Math.min(maxX, pan.x)),
    y: Math.max(minY, Math.min(maxY, pan.y)),
  };
}
