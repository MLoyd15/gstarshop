import '../../../styles/MaterialsPage.css';
import { AppIcon } from '../../icons.jsx';
import { X } from '../../icons.jsx';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { purchaseOrder, php } from '../mockData.js';

function PurchaseReceivePreview() {
  return (
    <MockFrame variant="guide-mock-purchase">
      <section className="materials-page">
        <div className="materials-dialog">
          <div className="materials-dialog-heading"><div><h2>Receive {purchaseOrder.number}</h2><p>Stock changes only after this receipt is submitted.</p></div><button className="btn btn-icon btn-ghost" type="button" aria-label="Close"><AppIcon icon={X} size="sm" /></button></div>
          <label className="guide-mock-field">Received date<input className="input" type="date" value={purchaseOrder.orderDate} readOnly /></label>
          <div className="materials-panel guide-mock-receive-lines">
            <div className="materials-toolbar"><div><h2>Items to receive</h2><p>Ordered by {purchaseOrder.supplierName}</p></div></div>
            {purchaseOrder.lines.map((line, index) => {
              return <label className="guide-mock-receive-line" key={line.materialId}>
                <span><strong>{line.materialName}</strong><small>Remaining {line.qty} {line.unit} · {php(line.unitCost)} per unit</small></span>
                {index === 0 ? <Callout n={1}><input className="input" type="number" value={line.qty} readOnly aria-label={`Quantity received for ${line.materialName}`} /></Callout> : <input className="input" type="number" value={line.qty} readOnly aria-label={`Quantity received for ${line.materialName}`} />}
              </label>;
            })}
          </div>
          <div className="materials-dialog-actions"><button type="button" className="btn btn-secondary">Cancel</button><Callout n={2}><button type="button" className="btn btn-secondary">Submit receipt</button></Callout></div>
        </div>
      </section>
    </MockFrame>
  );
}

export default PurchaseReceivePreview;
