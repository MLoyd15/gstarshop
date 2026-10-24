import '../../../styles/BookingsPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { booking, php } from '../mockData.js';

function CompleteJobPreview() {
  const first = booking.materials[0];
  return (
    <MockFrame variant="guide-mock-booking">
      <section className="booking-modal">
        <header><div><span className="eyebrow t-eyebrow">{booking.name}</span><h2>Complete job</h2></div><button type="button" aria-label="Close">×</button></header>
        <p>Enter actual quantities. Stock is deducted now using each material’s current average cost.</p>
        <div className="guide-mock-actual-heading"><span>Material</span><span>Planned</span><span>Used</span><span>Waste</span></div>
        <div className="booking-actual-line guide-mock-actual-line">
          <strong>{first.materialName} <small>({first.unit})</small></strong>
          <span className="guide-mock-planned">{first.plannedQuantity} {first.unit}</span>
          <label>Used<Callout n={1}><input type="number" value={first.usedQuantity} readOnly /></Callout></label>
          <label>Waste<Callout n={2}><input type="number" value={first.wasteQuantity} readOnly /></Callout></label>
        </div>
        <div className="guide-mock-actual-line guide-mock-actual-line-secondary">
          <strong>{booking.materials[1].materialName} <small>({booking.materials[1].unit})</small></strong>
          <span className="guide-mock-planned">{booking.materials[1].plannedQuantity} {booking.materials[1].unit}</span>
          <span>{booking.materials[1].usedQuantity}</span><span>{booking.materials[1].wasteQuantity}</span>
        </div>
        <label className="booking-full-field">Completion date<input type="date" value={booking.date} readOnly /></label>
        <div className="booking-cost-preview">Estimated material cost <strong>{php(booking.materialCost)}</strong></div>
        <footer><button type="button" className="secondary-button">Cancel</button><Callout n={3}><button type="button" className="primary-button">Complete job</button></Callout></footer>
      </section>
    </MockFrame>
  );
}

export default CompleteJobPreview;
