import { AppIcon } from '../icons.jsx';
import { CircleDot } from 'lucide-react';
import '../../styles/GuidePreviews.css';

function MockFrame({ children, variant = '' }) {
  return (
    <div className={`guide-mock-frame ${variant}`}>
      <div className="guide-mock-label"><AppIcon icon={CircleDot} size="sm" /> Sample data · preview only</div>
      <div className="guide-mock-window">
        <div className="guide-mock-stage" inert="" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export default MockFrame;
