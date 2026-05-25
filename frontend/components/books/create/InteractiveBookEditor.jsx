import { useCallback, useDeferredValue, useMemo, useRef } from 'react';
import { FiArrowDown, FiArrowUp, FiHelpCircle, FiPlus, FiTrash2 } from 'react-icons/fi';

import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';

import {

  emptyQuizTimelineItem,

  filterScenesOnly,

  insertQuizAfterTimeline,

  isQuizTimelineItem,

  normalizeInteractiveTimeline,

  renumberTimeline,

} from '../../../lib/bookContentTimeline';

import { getPageId, isInteractiveMetaRow } from '../../../lib/interactiveAdventure';
import { getSceneDisplayLabel, nextPageId, remapChoicesAfterSceneRemoval } from '../../../lib/interactiveScenes';
import { emptyInteractiveScene } from '../../../hooks/useBookTypeFlow';
import InteractiveSceneEditorCard from './InteractiveSceneEditorCard';

import InteractiveSceneMap from './InteractiveSceneMap';

import InteractiveSceneGraph from './InteractiveSceneGraph';

import BookQuizSlotEditor from './BookQuizSlotEditor';



function mergeScenesIntoTimeline(timeline, scenes) {

  let si = 0;

  const sceneList = Array.isArray(scenes) ? scenes : [];

  return (Array.isArray(timeline) ? timeline : []).map((item) => {

    if (isQuizTimelineItem(item)) return item;

    const row = sceneList[si];

    si += 1;

    return row ?? item;

  });

}



export default function InteractiveBookEditor({ form, onChange, onUpload, uploading }) {
  const timeline = Array.isArray(form.pages) ? form.pages : [];
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const scenesOnly = useMemo(() => filterScenesOnly(timeline), [timeline]);
  const scenesForMap = useDeferredValue(scenesOnly);

  const destinationOptions = useMemo(
    () =>
      scenesOnly
        .map((s, oi) => {
          const pid = getPageId(s);
          if (pid == null) return null;
          return { pid, label: getSceneDisplayLabel(s, oi) };
        })
        .filter(Boolean),
    [scenesOnly],
  );

  const setTimeline = useCallback(
    (next, { normalize = true, renumber = true } = {}) => {
      let pages = next;
      if (normalize) pages = normalizeInteractiveTimeline(next);
      else if (renumber) pages = renumberTimeline(next);
      onChange({ pages });
    },
    [onChange],
  );

  const updateSceneAt = useCallback(
    (idx, patch) => {
      const current = timelineRef.current;
      const updated = current.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      const light =
        Object.keys(patch).length === 1 &&
        (Array.isArray(patch.choices) || patch.text !== undefined || patch.scene_title !== undefined);
      setTimeline(updated, { normalize: false, renumber: !light });
    },
    [setTimeline],
  );

  const handleSetStart = useCallback(
    (idx, checked) => {
      const current = timelineRef.current;
      const updated = current.map((s, i) => {
        if (isQuizTimelineItem(s) || isInteractiveMetaRow(s)) return s;
        return { ...s, is_start: i === idx ? checked : false };
      });
      setTimeline(updated);
    },
    [setTimeline],
  );

  const handleInsertQuizAfter = useCallback(
    (idx) => {
      setTimeline(insertQuizAfterTimeline(timelineRef.current, idx));
    },
    [setTimeline],
  );



  const addScene = useCallback(() => {
    const current = timelineRef.current;
    const id = nextPageId(filterScenesOnly(current));
    setTimeline([...current, emptyInteractiveScene(id)]);
  }, [setTimeline]);

  const addQuizSlot = useCallback(() => {
    const current = timelineRef.current;
    setTimeline([...current, emptyQuizTimelineItem(current.length + 1)]);
  }, [setTimeline]);

  const move = useCallback(
    (idx, dir) => {
      const current = timelineRef.current;
      const j = idx + dir;
      if (j < 0 || j >= current.length) return;
      const next = [...current];
      [next[idx], next[j]] = [next[j], next[idx]];
      setTimeline(next);
    },
    [setTimeline],
  );

  const removeAt = useCallback(
    (idx) => {
      const current = timelineRef.current;
      const removed = current[idx];
      let next = current.filter((_, i) => i !== idx);
      if (!isQuizTimelineItem(removed)) {
        const removedId = getPageId(removed) || removed.scene_id;
        const remapped = remapChoicesAfterSceneRemoval(filterScenesOnly(next), removedId);
        next = mergeScenesIntoTimeline(next, remapped);
      }
      setTimeline(next);
    },
    [setTimeline],
  );



  const sceneCount = scenesOnly.length;

  const quizCount = timeline.filter(isQuizTimelineItem).length;



  return (

    <>

      <InteractiveSceneGraph pages={scenesForMap} />

      <InteractiveSceneMap pages={scenesForMap} />

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">

        <p className="text-muted small mb-2 mb-md-0">

          {timeline.length

            ? `${sceneCount} cena${sceneCount === 1 ? '' : 's'}, ${quizCount} quiz${quizCount === 1 ? '' : 'zes'} na ordem editorial`

            : 'Comece por criar a primeira cena'}

        </p>

        <div className="d-flex flex-wrap">

          <LuditecaButton

            type="button"

            variant="outline"

            outlineColor="primary"

            size="sm"

            className="d-inline-flex align-items-center mr-2 mb-2"

            onClick={addScene}

            disabled={uploading}

          >

            <FiPlus size={14} className="mr-1" />

            Nova cena

          </LuditecaButton>

          <LuditecaButton

            type="button"

            variant="outline"

            outlineColor="info"

            size="sm"

            className="d-inline-flex align-items-center mb-2"

            onClick={addQuizSlot}

            disabled={uploading}

          >

            <FiPlus size={14} className="mr-1" />

            Nova pergunta

          </LuditecaButton>

        </div>

      </div>

      <p className="text-muted small mb-3">
        O <strong>mapa e as escolhas</strong> usam só as cenas. A ordem da lista (setas) aparece na app
        em <strong>Ordem do livro</strong> (cenas + quiz) ou em <strong>História</strong> (ramificações).
      </p>



      {timeline.map((item, idx) => {

        if (isInteractiveMetaRow(item)) {
          return (
            <div
              key="interactive-meta"
              className="mb-3 p-3 border rounded bg-white border-secondary"
            >
              <p className="small font-weight-bold text-muted text-uppercase mb-1">
                Metadados da história
              </p>
              <p className="small text-muted mb-0">
                {String(item.story_title || '').trim() || 'Título editorial'} — personagens e itens
                (bloco técnico; não aparece como página no leitor).
              </p>
            </div>
          );
        }

        if (isQuizTimelineItem(item)) {

          return (

            <div key={`quiz-${idx}`} className="mb-3 p-3 border rounded bg-white border-info">

              <div className="d-flex justify-content-between align-items-center mb-2">

                <span className="small font-weight-bold text-info">Pergunta {idx + 1}</span>

                <div>

                  <LuditecaButton

                    type="button"

                    variant="link"

                    className="p-0 mr-2"

                    onClick={() => move(idx, -1)}

                    disabled={idx === 0 || uploading}

                  >

                    <FiArrowUp />

                  </LuditecaButton>

                  <LuditecaButton

                    type="button"

                    variant="link"

                    className="p-0 mr-2"

                    onClick={() => move(idx, 1)}

                    disabled={idx === timeline.length - 1 || uploading}

                  >

                    <FiArrowDown />

                  </LuditecaButton>

                  <LuditecaButton

                    type="button"

                    variant="link"

                    className="p-0 text-danger"

                    onClick={() => removeAt(idx)}

                    disabled={uploading}

                  >

                    <FiTrash2 />

                  </LuditecaButton>

                </div>

              </div>

              <BookQuizSlotEditor

                item={item}

                canRemove

                onRemove={() => removeAt(idx)}

                onChange={(next) => {

                  const updated = timeline.map((p, i) => (i === idx ? next : p));

                  setTimeline(updated);

                }}

              />

            </div>

          );

        }



        const scene = item;

        const sceneIdx = scenesOnly.findIndex((s) => getPageId(s) === getPageId(scene));

        const displayLabel = getSceneDisplayLabel(scene, sceneIdx >= 0 ? sceneIdx : idx);

        return (
          <InteractiveSceneEditorCard
            key={scene.scene_id || `scene-${getPageId(scene) ?? idx}`}
            scene={scene}
            idx={idx}
            displayLabel={displayLabel}
            destinationOptions={destinationOptions}
            sceneCount={sceneCount}
            timelineLength={timeline.length}
            uploading={uploading}
            onUpload={onUpload}
            onUpdateScene={updateSceneAt}
            onMove={move}
            onRemove={removeAt}
            onSetStart={handleSetStart}
            onInsertQuizAfter={handleInsertQuizAfter}
          />
        );

      })}

    </>

  );

}


