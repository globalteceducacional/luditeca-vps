import { useMemo, useState } from 'react';
import { Badge, Button } from 'reactstrap';
import { getChoiceTargetPageId, getPageId } from '../../../lib/interactiveAdventure';
import { getSceneDisplayLabel, normalizeInteractiveScenes } from '../../../lib/interactiveScenes';

/**
 * Mapa textual das cenas e ligações (validação visual rápida no CMS).
 */
export default function InteractiveSceneMap({ pages = [] }) {
  const [open, setOpen] = useState(false);
  const scenes = useMemo(() => normalizeInteractiveScenes(pages), [pages]);

  const labelByPageId = useMemo(() => {
    const map = new Map();
    scenes.forEach((s, idx) => {
      const pid = getPageId(s);
      if (pid != null) map.set(String(pid), getSceneDisplayLabel(s, idx));
    });
    return map;
  }, [scenes]);

  const issues = useMemo(() => {
    const list = [];
    const ids = new Set([...labelByPageId.keys()]);
    if (scenes.length > 1 && !scenes.some((s) => s.is_start)) {
      list.push('Nenhuma cena está marcada como início da história.');
    }
    scenes.forEach((scene, idx) => {
      const label = getSceneDisplayLabel(scene, idx);
      (scene.choices || []).forEach((ch) => {
        const targetId = getChoiceTargetPageId(ch);
        const target = targetId != null ? String(targetId) : '';
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
  }, [scenes, labelByPageId]);

  if (!scenes.length) return null;

  return (
    <div className="mb-4">
      <Button color="secondary" outline size="sm" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar mapa da história' : 'Ver mapa da história'}
      </Button>
      {open ? (
        <div className="mt-2 p-3 border rounded bg-white">
          <p className="small text-muted font-weight-bold text-uppercase mb-2">Mapa da história</p>
          <ul className="list-unstyled mb-0">
            {scenes.map((scene, idx) => {
              const label = getSceneDisplayLabel(scene, idx);
              const choices = Array.isArray(scene.choices) ? scene.choices : [];
              return (
                <li key={String(getPageId(scene) ?? scene.scene_id ?? idx)} className="mb-2 pb-2 border-bottom">
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
                        const targetId = getChoiceTargetPageId(ch);
                        const targetKey = targetId != null ? String(targetId) : '';
                        const targetLabel = targetKey ? labelByPageId.get(targetKey) : null;
                        const broken = Boolean(ch?.label && targetKey && !targetLabel);
                        const empty = Boolean(ch?.label && !targetKey);
                        return (
                          <li key={ci} className={broken || empty ? 'text-danger' : ''}>
                            {ch.label || '(sem texto)'} → {targetLabel || targetKey || '—'}
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
            <div className="mt-3 p-2 bg-warning-light border border-warning rounded">
              <p className="small font-weight-bold text-warning mb-1">Avisos</p>
              <ul className="small mb-0 pl-3">
                {issues.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="small text-success mb-0 mt-2">Ligações consistentes.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
