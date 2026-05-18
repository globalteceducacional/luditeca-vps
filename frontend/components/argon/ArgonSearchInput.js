import classNames from 'classnames';
import { FormGroup, Input, InputGroup, InputGroupAddon, InputGroupText } from 'reactstrap';

/** Campo de pesquisa com ícone em destaque (padrão Argon / input-group-alternative). */
export default function ArgonSearchInput({ value, onChange, placeholder, disabled, className }) {
  return (
    <FormGroup className={classNames('mb-0 luditeca-search-field', className)}>
      <InputGroup className="input-group-alternative">
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            <i className="fas fa-search" />
          </InputGroupText>
        </InputGroupAddon>
        <Input
          className="luditeca-form-control"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </InputGroup>
    </FormGroup>
  );
}
