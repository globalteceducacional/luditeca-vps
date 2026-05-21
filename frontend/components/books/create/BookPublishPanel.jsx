import { FormGroup } from 'reactstrap';
import { LuditecaAlert, LuditecaButton, LuditecaModal } from '../../argon/luditeca';
import WorkflowStatusSelect from '../../argon/WorkflowStatusSelect';
import BookPublishChecklist, { getBookPublishChecklist } from './BookPublishChecklist';

export default function BookPublishPanel({
  form,
  onChange,
  bookType,
  showQuiz = true,
  onPublishClick,
  onPreviewClick,
  onGoToStep,
  publishing,
  isPublished,
}) {
  const set = (key, value) => onChange({ [key]: value });
  const { ready: publishReady } = getBookPublishChecklist(bookType, form);

  return (
    <>
      <BookPublishChecklist bookType={bookType} form={form} onGoToStep={onGoToStep} />

      <LuditecaAlert color="info" className="mb-4">
        <strong>Rascunho:</strong> pode guardar a qualquer momento e completar o conteúdo depois.
        <br />
        <strong>Publicar:</strong> torna o livro visível na app infantil quando o conteúdo estiver
        completo.
      </LuditecaAlert>

      {showQuiz && bookType !== 'digital' ? (
        <LuditecaAlert color="light" className="border mb-4">
          As <strong>perguntas de quiz</strong> são definidas no passo «Conteúdo», na ordem desejada
          (botão «Nova pergunta» entre as páginas/cenas). Use as setas para reordenar.
        </LuditecaAlert>
      ) : null}

      <FormGroup>
        <label className="form-control-label">Estado editorial</label>
        <WorkflowStatusSelect
          value={form.workflow_status}
          onChange={(v) => set('workflow_status', v)}
        />
        <p className="small text-muted mb-0 mt-1">
          «Publicado» = visível na biblioteca da app (com login de aluno).
        </p>
      </FormGroup>

      <div className="d-flex flex-wrap mt-4">
        {onPreviewClick ? (
          <LuditecaButton
            variant="outline"
            outlineColor="info"
            type="button"
            className="mr-2 mb-2"
            onClick={onPreviewClick}
          >
            Pré-visualizar como na app
          </LuditecaButton>
        ) : null}
        <LuditecaButton
          variant="success"
          type="button"
          className="mb-2"
          disabled={publishing || isPublished || !publishReady}
          loading={publishing}
          loadingLabel="A publicar…"
          onClick={onPublishClick}
          title={!publishReady && !isPublished ? 'Complete o checklist antes de publicar' : undefined}
        >
          {isPublished ? 'Já publicado' : 'Publicar na app'}
        </LuditecaButton>
      </div>
    </>
  );
}

export function PublishConfirmModal({
  open,
  toggle,
  onConfirm,
  saving,
  bookTitle,
  bookType,
  form,
}) {
  const { ready, pendingLabels } = getBookPublishChecklist(bookType, form);

  return (
    <LuditecaModal
      isOpen={open}
      toggle={toggle}
      title="Publicar na app infantil?"
      footer={
        <>
          <LuditecaButton variant="outline" type="button" onClick={toggle} disabled={saving}>
            Cancelar
          </LuditecaButton>
          <LuditecaButton
            variant="success"
            type="button"
            onClick={onConfirm}
            disabled={saving || !ready}
            loading={saving}
            loadingLabel="A publicar…"
          >
            Sim, publicar
          </LuditecaButton>
        </>
      }
    >
      <p className="mb-2">
        O livro <strong>{bookTitle || 'sem título'}</strong> ficará visível para alunos com acesso à
        biblioteca.
      </p>
      {!ready && pendingLabels.length ? (
        <LuditecaAlert color="warning" className="mb-3">
          <strong>Ainda falta:</strong>
          <ul className="mb-0 pl-3 mt-2">
            {pendingLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </LuditecaAlert>
      ) : (
        <p className="small text-muted mb-0">
          O checklist de publicação está completo. Podes voltar a rascunho mais tarde.
        </p>
      )}
    </LuditecaModal>
  );
}
