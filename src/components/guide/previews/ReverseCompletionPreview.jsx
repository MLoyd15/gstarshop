import '../../../styles/BookingsPage.css';
import { AppIcon } from '../../icons.jsx';
import { X } from 'lucide-react';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { booking } from '../mockData.js';

function ReverseCompletionPreview() {
  return (
    <MockFrame variant="guide-mock-booking">
      <section className="booking-modal">
        <header><div><span className="eyebrow t-eyebrow">{booking.name}</span><h2>Correct completed job</h2></div><button className="btn btn-icon btn-ghost" type="button" aria-label="Close"><AppIcon icon={X} size="sm" /></button></header>
        <p>This restores all quantities deducted by this completion and adds linked reversing movements to stock history.</p>
        <Callout n={1}><label className="booking-check"><input type="checkbox" readOnly />I confirm all recorded material is physically returned and reusable.</label></Callout>
        <Callout n={2}><label className="booking-full-field">Correction reason<textarea className="textarea" readOnly value={booking.correctionReason} /></label></Callout>
        <label className="booking-full-field">Correction date<input className="input" type="date" value={booking.date} readOnly /></label>
        <footer><button type="button" className="btn btn-secondary">Cancel</button><Callout n={3}><button type="button" className="btn btn-secondary">Reverse completion</button></Callout></footer>
      </section>
    </MockFrame>
  );
}

export default ReverseCompletionPreview;
