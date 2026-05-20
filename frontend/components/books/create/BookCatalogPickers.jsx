import { useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { toast } from 'react-hot-toast';
import QuickCreateAuthorModal from './QuickCreateAuthorModal';
import QuickCreateCategoryModal from './QuickCreateCategoryModal';

const fc = 'luditeca-form-control';

function sortByName(list) {
  return [...list].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'pt', { sensitivity: 'base' }),
  );
}

/**
 * Autor e categoria com opção de criar em modal (sem abandonar o fluxo do livro).
 */
export default function BookCatalogPickers({
  authorId = '',
  categoryId = '',
  onAuthorIdChange,
  onCategoryIdChange,
  authors = [],
  categories = [],
  onAuthorCreated,
  onCategoryCreated,
  loadingAuthors = false,
  loadingCategories = false,
  disabled = false,
  allowQuickCreate = true,
}) {
  const [authorModal, setAuthorModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);

  const handleAuthorCreated = (author) => {
    onAuthorCreated?.(author);
    onAuthorIdChange?.(String(author.id));
    toast.success(`Autor «${author.name}» criado e selecionado.`);
  };

  const handleCategoryCreated = (category) => {
    onCategoryCreated?.(category);
    onCategoryIdChange?.(String(category.id));
    toast.success(`Categoria «${category.name}» criada e selecionada.`);
  };

  const sortedAuthors = sortByName(authors);
  const sortedCategories = sortByName(categories);

  return (
    <>
      <FormGroup>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Label className="form-control-label mb-0">Autor (catálogo)</Label>
          {allowQuickCreate ? (
            <Button
              type="button"
              color="link"
              size="sm"
              className="p-0"
              disabled={disabled}
              onClick={() => setAuthorModal(true)}
            >
              + Novo autor
            </Button>
          ) : null}
        </div>
        <Input
          className={fc}
          type="select"
          value={authorId}
          disabled={disabled || loadingAuthors}
          onChange={(e) => onAuthorIdChange?.(e.target.value)}
        >
          <option value="">— opcional —</option>
          {loadingAuthors ? (
            <option disabled>A carregar autores…</option>
          ) : sortedAuthors.length === 0 ? (
            <option disabled>Nenhum autor — use «Novo autor»</option>
          ) : (
            sortedAuthors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))
          )}
        </Input>
      </FormGroup>

      <FormGroup>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Label className="form-control-label mb-0">Categoria</Label>
          {allowQuickCreate ? (
            <Button
              type="button"
              color="link"
              size="sm"
              className="p-0"
              disabled={disabled}
              onClick={() => setCategoryModal(true)}
            >
              + Nova categoria
            </Button>
          ) : null}
        </div>
        <Input
          className={fc}
          type="select"
          value={categoryId}
          disabled={disabled || loadingCategories}
          onChange={(e) => onCategoryIdChange?.(e.target.value)}
        >
          <option value="">— opcional —</option>
          {loadingCategories ? (
            <option disabled>A carregar categorias…</option>
          ) : sortedCategories.length === 0 ? (
            <option disabled>Nenhuma categoria — use «Nova categoria»</option>
          ) : (
            sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </Input>
      </FormGroup>

      <QuickCreateAuthorModal
        isOpen={authorModal}
        toggle={() => setAuthorModal(false)}
        onCreated={handleAuthorCreated}
      />
      <QuickCreateCategoryModal
        isOpen={categoryModal}
        toggle={() => setCategoryModal(false)}
        onCreated={handleCategoryCreated}
      />
    </>
  );
}
