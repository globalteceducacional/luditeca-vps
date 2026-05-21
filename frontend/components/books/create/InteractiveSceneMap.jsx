import { useMemo } from 'react';
import { Badge } from 'reactstrap';
import { getSceneDisplayLabel, normalizeInteractiveScenes } from '../../../lib/interactiveScenes';

/**
 * Mapa textual das cenas e ligações (validação visual rápida no CMS).
 */
export default function InteractiveSceneMap({ pages = [] }) {
  const scenes = useMemo(() => normalizeInteractiveScenes(pages), [pages]);

  const issues = useMemo(() => {
    const list = [];
    const ids = new Set(scenes.map((s) => s.scene_id));
    if (scenes.length > 1 && !scenes.some((s) => s.is_start)) {
      list.push('Nenhuma cena está marcada como início da história.');
    }
    scenes.forEach((scene, idx) => {
      const label = getSceneDisplayLabel(scene, idx);
      (scene.choices || []).forEach((ch) => {
        const target = String(ch?.target_scene_id || '').trim();
        if (!target) {
          if (ch?.label) list.push(`«${label}»: escolha «${ch.label}» sem destino.`);
        } else if (!ids.has(target)) {
          list.push(`«${label}»: destino inválido.`);
        }
      });
      if (!scene.is_ending && !(scene.choices || []).length && scenes.length > 1) {
        list.push(`«${label}»: sem escolhas e não é final (beco?).`);
      }
    });
    return list;
  }, [scenes]);

  if (!scenes.length) return null;

  return (
    <div className="mb-4 p-3 border rounded bg-white">
      <p className="small text-muted font-weight-bold text-uppercase mb-2">Mapa da história</p>
      <ul className="list-unstyled mb-0">
        {scenes.map((scene, idx) => {
          const label = getSceneDisplayLabel(scene, idx);
          const choices = Array.isArray(scene.choices) ? scene.choices : [];
          return (
            <li key={scene.scene_id} className="mb-2 pb-2 border-bottom">
              <div className="d-flex flex-wrap align-items-center">
                <span className="font-weight-bold mr-2">{label}</span>
                {scene.is_start ? (
                  <Badge color="success" pill className="mr-1">
                    Início
                  </Badge>
                ) : null}
                {scene.is_ending ? (
                  <Badge color="secondary" pill>
                    Final
                  </Badge>
                ) : null}
              </div>
              {choices.length ? (
                <ul className="small text-muted mb-0 mt-1 pl-3">
                  {choices.map((ch, ci) => {
                    const targetId = ch?.target_scene_id;
                    const targetIdx = scenes.findIndex((s) => s.scene_id === targetId);
                    const targetLabel =
                      targetIdx >= 0 ? getSceneDisplayLabel(scenes[targetIdx], targetIdx) : null;
                    const broken = ch?.label && targetId && targetIdx < 0;
                    const empty = ch?.label && !targetId;
                    return (
                      <li key={ci} className={broken || empty ? 'text-danger' : ''}>
                        {ch.label || '(sem texto)'} →{' '}
                        {targetLabel || (targetId ? targetId : '—')}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="small text-muted mb-0 mt-1">Sem escolhas</p>
              )}
            </li>
          );
        })}
      </ul>
      {issues.length ? (
        <div className="mt-3 pt-2 border-top">
          <p className="small text-warning font-weight-bold mb-1">Atenção</p>
          <ul className="small text-warning mb-0 pl-3">
            {issues.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="small text-success mb-0 mt-2">Ligações OK para publicação.</p>
      )}
    </div>
  );
}
