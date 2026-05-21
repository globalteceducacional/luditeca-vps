import {
  AppAnimatedBookReader,
  AppDigitalBookReader,
  AppInteractiveBookReader,
} from '../../app/AppBookTypeReaders';
import { buildAnimatedReaderSlots } from '../../../lib/bookContentTimeline';
import { LuditecaAlert, LuditecaButton, LuditecaModal } from '../../argon/luditeca';

/**
 * Pré-visualização do livro com os mesmos leitores da app infantil (dentro do CMS).
 */
export default function BookAppPreviewModal({ open, toggle, bookType, form }) {
  const pages = Array.isArray(form?.pages) ? form.pages : [];

  const hasContent =
    bookType === 'digital'
      ? Boolean(form?.pdf_url || form?.epub_url)
      : bookType === 'animated'
        ? buildAnimatedReaderSlots(pages, form?.quiz).length > 0
        : bookType === 'interactive'
          ? pages.some((p) => String(p?.page_type || '').toLowerCase() !== 'quiz') || pages.length > 0
          : false;

  return (
    <LuditecaModal
      isOpen={open}
      toggle={toggle}
      size="xl"
      className="modal-dialog-scrollable"
      title="Pré-visualizar como na app"
      bodyClassName="bg-light"
      footer={
        <LuditecaButton variant="outline" type="button" onClick={toggle}>
          Fechar
        </LuditecaButton>
      }
    >
      {!hasContent ? (
        <LuditecaAlert color="warning">
          Ainda não há conteúdo suficiente para pré-visualizar. Complete o passo «Conteúdo» primeiro.
        </LuditecaAlert>
      ) : null}

      <div className="p-3 rounded bg-white border" style={{ minHeight: 200 }}>
        {bookType === 'animated' ? (
          <AppAnimatedBookReader pages={pages} soundtrackUrl={form?.soundtrack_url} quiz={form?.quiz} />
        ) : null}
        {bookType === 'interactive' ? (
          <AppInteractiveBookReader scenes={pages} quiz={quiz} />
        ) : null}
        {bookType === 'digital' ? (
          <AppDigitalBookReader pdfUrl={form?.pdf_url} epubUrl={form?.epub_url} />
        ) : null}
      </div>

      <p className="small text-muted mb-0 mt-3">
        Isto replica o leitor da biblioteca infantil. Rascunhos não publicados podem não aparecer na app
        real até definir «Publicado».
      </p>
    </LuditecaModal>
  );
}
