import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { Button, CustomInput, FormGroup, Input, Label } from 'reactstrap';
import AdminQuizQuestionsEditor from '../../admin/AdminQuizQuestionsEditor';
import { emptyInteractiveScene } from '../../../hooks/useBookTypeFlow';

const fc = 'luditeca-form-control';

export default function InteractiveBookEditor({ form, onChange, onUpload, uploading }) {
  const scenes = Array.isArray(form.pages) ? form.pages : [];

  const setScenes = (next) => onChange({ pages: next });

  const updateScene = (idx, patch) => {
    setScenes(scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addScene = () => {
    const id = `scene_${Date.now()}`;
    setScenes([...scenes, emptyInteractiveScene(id)]);
  };

  const removeScene = (idx) => {
    if (scenes.length <= 1) return;
    setScenes(scenes.filter((_, i) => i !== idx));
  };

  const sceneIds = scenes.map((s) => s.scene_id).filter(Boolean);

  return (
    <>
      {scenes.map((scene, idx) => (
        <div key={scene.scene_id || idx} className="mb-3 p-3 border rounded bg-light">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small font-weight-bold text-uppercase text-muted">
              Cena {idx + 1}
            </span>
            {scenes.length > 1 ? (
              <Button type="button" color="link" className="p-0 text-danger" onClick={() => removeScene(idx)}>
                <FiTrash2 />
              </Button>
            ) : null}
          </div>
          <FormGroup>
            <Label className="form-control-label">ID da cena</Label>
            <Input
              className={fc}
              value={scene.scene_id || ''}
              onChange={(e) => updateScene(idx, { scene_id: e.target.value.trim() })}
            />
          </FormGroup>
          <FormGroup>
            <Label className="form-control-label">Texto</Label>
            <Input
              className={fc}
              type="textarea"
              rows={2}
              value={scene.text || ''}
              onChange={(e) => updateScene(idx, { text: e.target.value })}
            />
          </FormGroup>
          <FormGroup>
            <Label className="form-control-label">Imagem</Label>
            <Input
              className={fc}
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await onUpload(file, 'pages', 'book-interactive');
                updateScene(idx, { image_url: url });
                e.target.value = '';
              }}
            />
            {scene.image_url ? (
              <img src={scene.image_url} alt="" className="mt-2 rounded" style={{ maxHeight: 80 }} />
            ) : null}
          </FormGroup>
          <div className="d-flex flex-wrap mb-2">
            <CustomInput
              type="checkbox"
              id={`start-${idx}`}
              label="Cena inicial"
              checked={Boolean(scene.is_start)}
              onChange={(e) =>
                setScenes(
                  scenes.map((s, i) => ({
                    ...s,
                    is_start: i === idx ? e.target.checked : false,
                  })),
                )
              }
            />
            <CustomInput
              type="checkbox"
              id={`end-${idx}`}
              className="ml-3"
              label="Final"
              checked={Boolean(scene.is_ending)}
              onChange={(e) => updateScene(idx, { is_ending: e.target.checked })}
            />
          </div>
          <p className="small text-muted font-weight-bold text-uppercase mb-1">Escolhas</p>
          {(scene.choices || []).map((ch, ci) => (
            <div key={ci} className="d-flex flex-wrap align-items-center mb-2">
              <Input
                className={`${fc} mr-2 mb-2`}
                style={{ flex: '1 1 140px' }}
                placeholder="Rótulo"
                value={ch.label || ''}
                onChange={(e) => {
                  const choices = [...(scene.choices || [])];
                  choices[ci] = { ...choices[ci], label: e.target.value };
                  updateScene(idx, { choices });
                }}
              />
              <Input
                className={`${fc} mb-2`}
                type="select"
                style={{ flex: '1 1 140px' }}
                value={ch.target_scene_id || ''}
                onChange={(e) => {
                  const choices = [...(scene.choices || [])];
                  choices[ci] = { ...choices[ci], target_scene_id: e.target.value };
                  updateScene(idx, { choices });
                }}
              >
                <option value="">Destino…</option>
                {sceneIds
                  .filter((id) => id !== scene.scene_id)
                  .map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
              </Input>
              <Button
                type="button"
                color="link"
                className="p-0 text-danger mb-2"
                onClick={() => {
                  const choices = (scene.choices || []).filter((_, i) => i !== ci);
                  updateScene(idx, { choices });
                }}
              >
                <FiTrash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            color="link"
            size="sm"
            className="p-0"
            onClick={() =>
              updateScene(idx, {
                choices: [...(scene.choices || []), { label: '', target_scene_id: '' }],
              })
            }
          >
            + escolha
          </Button>
        </div>
      ))}
      <Button type="button" color="link" size="sm" className="p-0 d-inline-flex align-items-center mb-3" onClick={addScene}>
        <FiPlus size={14} className="mr-1" /> Nova cena
      </Button>
      <hr />
      <p className="small text-muted font-weight-bold text-uppercase">Quiz do livro</p>
      <AdminQuizQuestionsEditor
        type="quiz"
        value={form.quiz}
        onChange={(quiz) => onChange({ quiz })}
      />
    </>
  );
}
