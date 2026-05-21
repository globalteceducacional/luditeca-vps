import WorkflowStatusSelect from '../../argon/WorkflowStatusSelect';
import { LuditecaInput } from '../../argon/luditeca';
import BookCatalogPickers from './BookCatalogPickers';
import BookCoverUploadField from './BookCoverUploadField';

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
      <LuditecaInput
        label="Título"
        required
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
      />
      <LuditecaInput
        label="Descrição"
        type="textarea"
        rows={3}
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
      />
      {showAgeRange ? (
        <LuditecaInput
          label="Faixa etária"
          placeholder="Ex.: 4–7 anos"
          value={form.age_range}
          onChange={(e) => set('age_range', e.target.value)}
        />
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
        <div className="form-group">
          <label className="form-control-label">Estado editorial</label>
          <WorkflowStatusSelect
            value={form.workflow_status}
            onChange={(v) => set('workflow_status', v)}
            disabled={uploadingCover}
          />
          <p className="small text-muted mb-0 mt-1">
            «Publicado» torna o livro visível na app infantil (quando o resto do conteúdo estiver pronto).
          </p>
        </div>
      ) : null}
      <BookCoverUploadField
        coverUrl={form.cover_image}
        onUpload={onCoverUpload}
        uploading={uploadingCover}
        disabled={uploadingCover}
      />
    </>
  );
}
