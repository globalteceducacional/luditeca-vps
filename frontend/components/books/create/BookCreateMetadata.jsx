import { FormGroup, Input, Label } from 'reactstrap';

const fc = 'luditeca-form-control';

export default function BookCreateMetadata({
  form,
  onChange,
  authors = [],
  categories = [],
  onCoverUpload,
  uploadingCover,
}) {
  const set = (key, value) => onChange({ [key]: value });

  return (
    <>
      <FormGroup>
        <Label className="form-control-label">Título *</Label>
        <Input
          className={fc}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">Descrição</Label>
        <Input
          className={fc}
          type="textarea"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">Faixa etária</Label>
        <Input
          className={fc}
          placeholder="Ex.: 4–7 anos"
          value={form.age_range}
          onChange={(e) => set('age_range', e.target.value)}
        />
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">Autor (catálogo)</Label>
        <Input
          className={fc}
          type="select"
          value={form.author_id}
          onChange={(e) => set('author_id', e.target.value)}
        >
          <option value="">— opcional —</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Input>
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">Categoria</Label>
        <Input
          className={fc}
          type="select"
          value={form.category_id}
          onChange={(e) => set('category_id', e.target.value)}
        >
          <option value="">— opcional —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Input>
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">Capa</Label>
        <Input
          className={fc}
          type="file"
          accept="image/*"
          onChange={onCoverUpload}
          disabled={uploadingCover}
        />
        {form.cover_image ? (
          <img
            src={form.cover_image}
            alt=""
            className="mt-2 rounded border"
            style={{ maxHeight: 120 }}
          />
        ) : null}
      </FormGroup>
    </>
  );
}
