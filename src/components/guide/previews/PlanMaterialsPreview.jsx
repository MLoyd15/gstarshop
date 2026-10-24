import '../../../styles/BookingsPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { booking, products, php } from '../mockData.js';

function PlanMaterialsPreview() {
  const product = products[0];
  return (
    <MockFrame variant="guide-mock-booking">
      <section className="booking-modal">
        <header><div><span className="eyebrow t-eyebrow">{booking.name}</span><h2>Planned materials</h2></div><button className="btn btn-icon btn-ghost" type="button" aria-label="Close">×</button></header>
        <p>Planned quantities are saved with the booking and do not change stock.</p>
        <Callout n={1}><div className="booking-recipe-picker">
          <label>Product recipe<select className="select" defaultValue={product.id}><option value={product.id}>{product.name} · {php(product.unitCost)} material cost / {product.unit}</option></select></label>
          <label>Quantity<input className="input" type="number" value={booking.productQuantity} readOnly aria-label="Product quantity" /></label>
          <Callout n={2}><button type="button" className="btn btn-secondary">Add recipe to plan</button></Callout>
          <small>Recipe estimate: {php(product.unitCost * booking.productQuantity)} for this quantity</small>
        </div></Callout>
        {booking.materials.map((line) => (
          <div className="booking-material-line" key={line.materialId}>
            <select className="select" defaultValue={line.materialId}><option value={line.materialId}>{line.materialName} ({line.unit})</option></select>
            <input className="input" type="number" value={line.plannedQuantity} readOnly aria-label="Planned quantity" />
            <button className="btn btn-secondary" type="button">Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary">＋ Add material</button>
        <footer><button type="button" className="btn btn-secondary">Cancel</button><Callout n={3}><button type="button" className="btn btn-secondary">Save plan</button></Callout></footer>
      </section>
    </MockFrame>
  );
}

export default PlanMaterialsPreview;
