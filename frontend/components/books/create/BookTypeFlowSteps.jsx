import { Badge } from 'reactstrap';
import { BOOK_TYPE_FLOW_STEPS } from '../../../lib/bookTypes';

export default function BookTypeFlowSteps({ currentStep }) {
  return (
    <div className="d-flex flex-wrap justify-content-center mb-4">
      {BOOK_TYPE_FLOW_STEPS.map((step, i) => (
        <Badge
          key={step.id}
          color={currentStep === i ? 'primary' : currentStep > i ? 'info' : 'secondary'}
          pill
          className="mr-2 mb-2 px-3 py-2 font-weight-bold"
        >
          <span className="mr-1">{i + 1}</span>
          {step.label}
        </Badge>
      ))}
    </div>
  );
}
