import { useCallback, useEffect, useState } from 'react';
import {
  endEditorMetric,
  reportEditorMetric,
  startEditorMetric,
} from '../lib/editorMetrics';

export default function useMediaLibraryData({ activeTab, bookId, loadItems }) {
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const reloadMedia = useCallback(async () => {
    if (!bookId || typeof loadItems !== 'function') return;
    const started = startEditorMetric();
    setMediaLoading(true);
    try {
      const nextItems = await loadItems();
      setMediaItems(Array.isArray(nextItems) ? nextItems : []);
    } finally {
      setMediaLoading(false);
      reportEditorMetric('media.reload', endEditorMetric(started), {
        tab: String(activeTab || ''),
        hasBook: Boolean(bookId),
      });
    }
  }, [activeTab, bookId, loadItems]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!bookId || activeTab !== 'media' || typeof loadItems !== 'function') {
        if (!cancelled) setMediaItems([]);
        return;
      }
      const started = startEditorMetric();
      setMediaLoading(true);
      try {
        const nextItems = await loadItems();
        if (!cancelled) setMediaItems(Array.isArray(nextItems) ? nextItems : []);
      } finally {
        if (!cancelled) setMediaLoading(false);
        reportEditorMetric('media.initial-load', endEditorMetric(started), {
          tab: String(activeTab || ''),
          hasBook: Boolean(bookId),
        });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, bookId, loadItems]);

  return {
    mediaItems,
    setMediaItems,
    mediaLoading,
    setMediaLoading,
    reloadMedia,
  };
}
