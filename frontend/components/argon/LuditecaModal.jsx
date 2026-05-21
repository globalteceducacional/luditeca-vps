import { Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

/**
 * Modal CMS — `fade={false}` por defeito (evita avisos reactstrap/React 18).
 */
export default function LuditecaModal({
  isOpen,
  toggle,
  title,
  children,
  footer,
  size,
  centered = true,
  className,
  bodyClassName,
  fade = false,
  ...rest
}) {
  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      size={size}
      centered={centered}
      fade={fade}
      className={className}
      {...rest}
    >
      {title != null ? <ModalHeader toggle={toggle}>{title}</ModalHeader> : null}
      <ModalBody className={bodyClassName}>{children}</ModalBody>
      {footer != null ? <ModalFooter>{footer}</ModalFooter> : null}
    </Modal>
  );
}
