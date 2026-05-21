import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';
import QuickCreateAuthorModal from './QuickCreateAuthorModal';
import QuickCreateCategoryModal from './QuickCreateCategoryModal';

function sortByName(list) {
  return [...list].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'pt', { sensitivity: 'base' }),
  );
}

/**
 * Autor e categoria com opção de criar em modal (sem abandonar o fluxo do livro).
 * @param {'argon'|'dark'} [variant] — `dark` usa theme `editor-dark` (editor v2)
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
  variant = 'argon',
}) {
  const [authorModal, setAuthorModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const isDark = variant === 'dark';
  const inputTheme = isDark ? 'editor-dark' : 'cms';

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

  const authorQuickBtn =
    allowQuickCreate ? (
      <LuditecaButton
        type="button"
        theme={isDark ? 'editor-dark' : 'cms'}
        variant={isDark ? undefined : 'link'}
        editorVariant={isDark ? 'link' : undefined}
        size="sm"
        className={isDark ? undefined : 'p-0'}
        disabled={disabled}
        onClick={() => setAuthorModal(true)}
      >
        + Novo autor
      </LuditecaButton>
    ) : null;

  const categoryQuickBtn =
    allowQuickCreate ? (
      <LuditecaButton
        type="button"
        theme={isDark ? 'editor-dark' : 'cms'}
        variant={isDark ? undefined : 'link'}
        editorVariant={isDark ? 'link' : undefined}
        size="sm"
        className={isDark ? undefined : 'p-0'}
        disabled={disabled}
        onClick={() => setCategoryModal(true)}
      >
        + Nova categoria
      </LuditecaButton>
    ) : null;

  return (
    <>
      <LuditecaInput
        theme={inputTheme}
        label={isDark ? 'Autor' : 'Autor (catálogo)'}
        labelAction={authorQuickBtn}
        type="select"
        value={authorId}
        disabled={disabled || loadingAuthors}
        onChange={(e) => onAuthorIdChange?.(e.target.value)}
      >
        <option value="">{isDark ? '— opcional —' : '— opcional —'}</option>
        {loadingAuthors ? (
          <option disabled>A carregar…</option>
        ) : sortedAuthors.length === 0 ? (
          <option disabled>Nenhum autor</option>
        ) : (
          sortedAuthors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))
        )}
      </LuditecaInput>
      <LuditecaInput
        theme={inputTheme}
        label="Categoria"
        labelAction={categoryQuickBtn}
        type="select"
        value={categoryId}
        disabled={disabled || loadingCategories}
        onChange={(e) => onCategoryIdChange?.(e.target.value)}
      >
        <option value="">{isDark ? '— opcional —' : '— opcional —'}</option>
        {loadingCategories ? (
          <option disabled>A carregar…</option>
        ) : sortedCategories.length === 0 ? (
          <option disabled>Nenhuma categoria</option>
        ) : (
          sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))
        )}
      </LuditecaInput>
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
