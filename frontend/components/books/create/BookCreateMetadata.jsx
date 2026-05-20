import { FormGroup, Input, Label } from 'reactstrap';
import WorkflowStatusSelect from '../../argon/WorkflowStatusSelect';
import BookCatalogPickers from './BookCatalogPickers';

const fc = 'luditeca-form-control';

export default function BookCreateMetadata({
  form,
  onChange,
  authors = [],
  categories = [],
  onAuthorCreated,
  onCategoryCreated,
  onCoverUpload,
  uploadingCover,
  loadingAuthors = false,
  loadingCategories = false,
  showAgeRange = true,
  showWorkflow = true,
  allowQuickCreate = true,
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
      {showAgeRange ? (
        <FormGroup>
          <Label className="form-control-label">Faixa etária</Label>
          <Input
            className={fc}
            placeholder="Ex.: 4–7 anos"
            value={form.age_range}
            onChange={(e) => set('age_range', e.target.value)}
          />
        </FormGroup>
      ) : null}

      <BookCatalogPickers
        authorId={form.author_id}
        categoryId={form.category_id}
        onAuthorIdChange={(v) => set('author_id', v)}
        onCategoryIdChange={(v) => set('category_id', v)}
        authors={authors}
        categories={categories}
        onAuthorCreated={onAuthorCreated}
        onCategoryCreated={onCategoryCreated}
        loadingAuthors={loadingAuthors}
        loadingCategories={loadingCategories}
        disabled={uploadingCover}
        allowQuickCreate={allowQuickCreate}
      />

      {showWorkflow ? (
        <FormGroup>
          <Label className="form-control-label">Estado editorial</Label>
          <WorkflowStatusSelect
            value={form.workflow_status}
            onChange={(v) => set('workflow_status', v)}
            disabled={uploadingCover}
          />
          <p className="small text-muted mb-0 mt-1">
            «Publicado» torna o livro visível na app infantil (quando o resto do conteúdo estiver pronto).
          </p>
        </FormGroup>
      ) : null}
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
