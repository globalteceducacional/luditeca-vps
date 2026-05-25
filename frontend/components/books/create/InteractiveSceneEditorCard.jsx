import { memo, useMemo } from 'react';
import { FiArrowDown, FiArrowUp, FiHelpCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
import { CustomInput } from 'reactstrap';
import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';
import { resolveBookAssetUrl } from '../../../lib/bookMediaSrc';
import { emptyChoice, getChoiceTargetPageId, getPageId } from '../../../lib/interactiveAdventure';
import { getSceneDisplayLabel } from '../../../lib/interactiveScenes';

function InteractiveSceneEditorCard({
  scene,
  idx,
  displayLabel,
  destinationOptions,
  sceneCount,
  timelineLength,
  uploading,
  onUpload,
  onUpdateScene,
  onMove,
  onRemove,
  onSetStart,
  onInsertQuizAfter,
}) {
  const destOptions = useMemo(
    () => destinationOptions.filter((o) => o.pid !== getPageId(scene)),
    [destinationOptions, scene],
  );

  const choices = Array.isArray(scene.choices) ? scene.choices : [];

  return (
    <div className="mb-3 p-3 border rounded bg-light">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small font-weight-bold text-uppercase text-muted">{displayLabel}</span>
        <div>
          <LuditecaButton
            type="button"
            variant="link"
            className="p-0 mr-2"
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0 || uploading}
          >
            <FiArrowUp />
          </LuditecaButton>
          <LuditecaButton
            type="button"
            variant="link"
            className="p-0 mr-2"
            onClick={() => onMove(idx, 1)}
            disabled={idx === timelineLength - 1 || uploading}
          >
            <FiArrowDown />
          </LuditecaButton>
          {sceneCount > 1 ? (
            <LuditecaButton
              type="button"
              variant="link"
              className="p-0 text-danger"
              onClick={() => onRemove(idx)}
              disabled={uploading}
            >
              <FiTrash2 />
            </LuditecaButton>
          ) : null}
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <LuditecaInput
            label="ID da página"
            type="number"
            min={1}
            value={getPageId(scene) ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 1) return;
              onUpdateScene(idx, { page_id: n, scene_id: String(n) });
            }}
          />
        </div>
        <div className="col-md-9">
          <LuditecaInput
            label="Nome da página"
            placeholder="Ex.: Entrada da floresta"
            value={scene.scene_title || ''}
            onChange={(e) => onUpdateScene(idx, { scene_title: e.target.value })}
          />
        </div>
      </div>

      <LuditecaInput
        label="Texto"
        type="textarea"
        rows={2}
        value={scene.text || ''}
        onChange={(e) => onUpdateScene(idx, { text: e.target.value })}
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
          onUpdateScene(idx, { image_url: url });
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
          id={`start-${getPageId(scene) ?? idx}`}
          label="Começa a história aqui"
          checked={Boolean(scene.is_start)}
          onChange={(e) => onSetStart(idx, e.target.checked)}
        />
        <CustomInput
          type="checkbox"
          id={`end-${getPageId(scene) ?? idx}`}
          className="ml-3"
          label="Final da história"
          checked={Boolean(scene.is_ending)}
          onChange={(e) => {
            const checked = e.target.checked;
            const patch = {
              is_ending: checked,
              ending_type: checked ? scene.ending_type || 'neutral' : null,
            };
            if (!checked && !choices.length) {
              patch.choices = [emptyChoice()];
            }
            onUpdateScene(idx, patch);
          }}
        />
      </div>

      {scene.is_ending ? (
        <LuditecaInput
          label="Tipo de final"
          type="select"
          value={scene.ending_type || 'neutral'}
          onChange={(e) => onUpdateScene(idx, { ending_type: e.target.value })}
          className="mb-2"
        >
          <option value="good">Bom</option>
          <option value="bad">Mau</option>
          <option value="secret">Secreto</option>
          <option value="neutral">Neutro</option>
        </LuditecaInput>
      ) : null}

      <p className="small text-muted font-weight-bold text-uppercase mb-1">Escolhas do leitor</p>

      {!scene.is_ending && !choices.length ? (
        <p className="small text-warning mb-2">
          Esta página não é final: adicione pelo menos uma escolha com destino ou marque «Final da história».
        </p>
      ) : null}

      {choices.map((ch, ci) => {
        const selectedTarget = getChoiceTargetPageId(ch);
        const selectValue = selectedTarget != null ? String(selectedTarget) : '';

        return (
          <div key={`choice-${idx}-${ci}`} className="d-flex flex-wrap align-items-center mb-2">
            <LuditecaInput
              className="mr-2 mb-2"
              style={{ flex: '1 1 140px' }}
              placeholder="Texto do botão"
              value={ch.label || ''}
              formGroupClassName="mb-2 flex-grow-1"
              onChange={(e) => {
                const next = [...choices];
                next[ci] = { ...next[ci], label: e.target.value };
                onUpdateScene(idx, { choices: next });
              }}
            />
            <LuditecaInput
              id={`choice-dest-${idx}-${ci}`}
              type="select"
              className="mb-2"
              style={{ flex: '1 1 160px' }}
              value={selectValue}
              formGroupClassName="mb-2"
              onChange={(e) => {
                const raw = e.target.value;
                const next = [...choices];
                if (!raw) {
                  next[ci] = { ...next[ci], target_page_id: null, target_scene_id: '' };
                } else {
                  const n = Number(raw);
                  next[ci] = { ...next[ci], target_page_id: n, target_scene_id: String(n) };
                }
                onUpdateScene(idx, { choices: next });
              }}
            >
              <option value="">Destino (página)…</option>
              {destOptions.map((o) => (
                <option key={o.pid} value={String(o.pid)}>
                  Página {o.pid} — {o.label}
                </option>
              ))}
            </LuditecaInput>
            <LuditecaButton
              type="button"
              variant="link"
              className="p-0 text-danger mb-2"
              onClick={() => onUpdateScene(idx, { choices: choices.filter((_, i) => i !== ci) })}
            >
              <FiTrash2 size={14} />
            </LuditecaButton>
          </div>
        );
      })}

      {!scene.is_ending && destOptions.length === 0 ? (
        <p className="small text-muted mb-2">
          Adiciona outra página (+ página) para definir destinos nas escolhas.
        </p>
      ) : null}

      <LuditecaButton
        type="button"
        variant="link"
        size="sm"
        className="p-0"
        onClick={() => onUpdateScene(idx, { choices: [...choices, emptyChoice()] })}
      >
        + escolha
      </LuditecaButton>

      <LuditecaButton
        type="button"
        variant="outline"
        outlineColor="info"
        size="sm"
        className="d-inline-flex align-items-center mt-3"
        onClick={() => onInsertQuizAfter(idx)}
        disabled={uploading}
      >
        <FiHelpCircle size={14} className="mr-1" />
        Quiz após esta cena
      </LuditecaButton>
    </div>
  );
}

export default memo(InteractiveSceneEditorCard, (prev, next) => {
  if (prev.scene !== next.scene) return false;
  if (prev.idx !== next.idx) return false;
  if (prev.uploading !== next.uploading) return false;
  if (prev.sceneCount !== next.sceneCount) return false;
  if (prev.timelineLength !== next.timelineLength) return false;
  if (prev.displayLabel !== next.displayLabel) return false;
  if (prev.destinationOptions !== next.destinationOptions) return false;
  return true;
});
