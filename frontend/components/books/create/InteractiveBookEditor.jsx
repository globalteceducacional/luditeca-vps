import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from 'react-icons/fi';

import { CustomInput } from 'reactstrap';

import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';

import { resolveBookAssetUrl } from '../../../lib/bookMediaSrc';

import {

  emptyQuizTimelineItem,

  filterScenesOnly,

  isQuizTimelineItem,

  normalizeInteractiveTimeline,

  renumberTimeline,

} from '../../../lib/bookContentTimeline';

import {

  getSceneDisplayLabel,

  nextSceneId,

  remapChoicesAfterSceneRemoval,

} from '../../../lib/interactiveScenes';

import { emptyInteractiveScene } from '../../../hooks/useBookTypeFlow';

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

  const scenesOnly = filterScenesOnly(timeline);



  const setTimeline = (next) => onChange({ pages: normalizeInteractiveTimeline(next) });



  const updateSceneAt = (idx, patch) => {

    const updated = timeline.map((s, i) => (i === idx ? { ...s, ...patch } : s));

    setTimeline(updated);

  };



  const addScene = () => {

    const id = nextSceneId(scenesOnly);

    setTimeline([...timeline, emptyInteractiveScene(id)]);

  };



  const addQuizSlot = () => {

    setTimeline([...timeline, emptyQuizTimelineItem(timeline.length + 1)]);

  };



  const move = (idx, dir) => {

    const j = idx + dir;

    if (j < 0 || j >= timeline.length) return;

    const next = [...timeline];

    [next[idx], next[j]] = [next[j], next[idx]];

    setTimeline(next);

  };



  const removeAt = (idx) => {

    const removed = timeline[idx];

    let next = timeline.filter((_, i) => i !== idx);

    if (!isQuizTimelineItem(removed)) {

      const remapped = remapChoicesAfterSceneRemoval(filterScenesOnly(next), removed.scene_id);

      next = mergeScenesIntoTimeline(next, remapped);

    }

    setTimeline(next);

  };



  const sceneCount = scenesOnly.length;

  const quizCount = timeline.filter(isQuizTimelineItem).length;



  return (

    <>

      <InteractiveSceneGraph pages={scenesOnly} />

      <InteractiveSceneMap pages={scenesOnly} />

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

        const sceneIdx = scenesOnly.findIndex((s) => s.scene_id === scene.scene_id);

        const displayLabel = getSceneDisplayLabel(scene, sceneIdx >= 0 ? sceneIdx : idx);

        const otherScenes = scenesOnly.filter((s) => s.scene_id !== scene.scene_id);



        return (

          <div key={scene.scene_id || `scene-${idx}`} className="mb-3 p-3 border rounded bg-light">

            <div className="d-flex justify-content-between align-items-center mb-2">

              <span className="small font-weight-bold text-uppercase text-muted">{displayLabel}</span>

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

                {sceneCount > 1 ? (

                  <LuditecaButton

                    type="button"

                    variant="link"

                    className="p-0 text-danger"

                    onClick={() => removeAt(idx)}

                    disabled={uploading}

                  >

                    <FiTrash2 />

                  </LuditecaButton>

                ) : null}

              </div>

            </div>

            <LuditecaInput

              label="Nome da cena"

              placeholder="Ex.: Entrada da floresta"

              value={scene.scene_title || ''}

              onChange={(e) => updateSceneAt(idx, { scene_title: e.target.value })}

            />

            <LuditecaInput

              label="Texto"

              type="textarea"

              rows={2}

              value={scene.text || ''}

              onChange={(e) => updateSceneAt(idx, { text: e.target.value })}

            />

            <LuditecaInput

              label="Imagem"

              type="file"

              accept="image/*"

              disabled={uploading}

              onChange={async (e) => {

                const file = e.target.files?.[0];

                if (!file) return;

                const url = await onUpload(file, 'pages', 'book-interactive');

                updateSceneAt(idx, { image_url: url });

                e.target.value = '';

              }}

            />

            {scene.image_url ? (

              <img

                src={resolveBookAssetUrl(scene.image_url) || scene.image_url}

                alt=""

                className="mt-2 rounded"

                style={{ maxHeight: 80 }}

              />

            ) : null}

            <div className="d-flex flex-wrap mb-2">

              <CustomInput

                type="checkbox"

                id={`start-${scene.scene_id}`}

                label="Começa a história aqui"

                checked={Boolean(scene.is_start)}

                onChange={(e) => {

                  const updated = timeline.map((s, i) => {

                    if (isQuizTimelineItem(s)) return s;

                    return {

                      ...s,

                      is_start: i === idx ? e.target.checked : false,

                    };

                  });

                  setTimeline(updated);

                }}

              />

              <CustomInput

                type="checkbox"

                id={`end-${scene.scene_id}`}

                className="ml-3"

                label="Final da história"

                checked={Boolean(scene.is_ending)}

                onChange={(e) => updateSceneAt(idx, { is_ending: e.target.checked })}

              />

            </div>

            <p className="small text-muted font-weight-bold text-uppercase mb-1">Escolhas do leitor</p>

            {(scene.choices || []).map((ch, ci) => (

              <div key={ci} className="d-flex flex-wrap align-items-center mb-2">

                <LuditecaInput

                  className="mr-2 mb-2"

                  style={{ flex: '1 1 140px' }}

                  placeholder="Texto do botão"

                  value={ch.label || ''}

                  formGroupClassName="mb-2 flex-grow-1"

                  onChange={(e) => {

                    const choices = [...(scene.choices || [])];

                    choices[ci] = { ...choices[ci], label: e.target.value };

                    updateSceneAt(idx, { choices });

                  }}

                />

                <LuditecaInput

                  type="select"

                  className="mb-2"

                  style={{ flex: '1 1 160px' }}

                  value={ch.target_scene_id || ''}

                  formGroupClassName="mb-2"

                  onChange={(e) => {

                    const choices = [...(scene.choices || [])];

                    choices[ci] = { ...choices[ci], target_scene_id: e.target.value };

                    updateSceneAt(idx, { choices });

                  }}

                >

                  <option value="">Para onde vai…</option>

                  {otherScenes.map((s, oi) => {

                    const oIdx = scenesOnly.findIndex((x) => x.scene_id === s.scene_id);

                    return (

                      <option key={s.scene_id} value={s.scene_id}>

                        {getSceneDisplayLabel(s, oIdx >= 0 ? oIdx : oi)}

                      </option>

                    );

                  })}

                </LuditecaInput>

                <LuditecaButton

                  type="button"

                  variant="link"

                  className="p-0 text-danger mb-2"

                  onClick={() => {

                    const choices = (scene.choices || []).filter((_, i) => i !== ci);

                    updateSceneAt(idx, { choices });

                  }}

                >

                  <FiTrash2 size={14} />

                </LuditecaButton>

              </div>

            ))}

            <LuditecaButton

              type="button"

              variant="link"

              size="sm"

              className="p-0"

              onClick={() =>

                updateSceneAt(idx, {

                  choices: [...(scene.choices || []), { label: '', target_scene_id: '' }],

                })

              }

            >

              + escolha

            </LuditecaButton>

          </div>

        );

      })}

    </>

  );

}


