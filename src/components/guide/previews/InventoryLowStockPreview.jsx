import '../../../styles/MaterialsPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { materials, php } from '../mockData.js';

function InventoryLowStockPreview() {
  const attention = materials.filter((material) => material.status === 'Low stock' || material.status === 'Out of stock');
  return (
    <MockFrame variant="guide-mock-inventory">
      <section className="materials-page">
        <header className="materials-heading"><div><div className="t-eyebrow">RAW MATERIALS</div><h1 className="t-page-title">Materials</h1><p>Low stock filter · active materials</p></div><button className="materials-primary" type="button">＋ Add material</button></header>
        <div className="materials-panel">
          <div className="materials-toolbar"><div><h2>Stock on hand</h2><p>Low stock is at or below the reorder level.</p></div><div className="materials-filters"><input value="Low stock" readOnly aria-label="Filter materials" /></div></div>
          <div className="material-cards guide-mock-material-cards">
            {attention.map((material) => (
              <article className="material-card" key={material.id}>
                <header className="material-card-heading"><span className="material-avatar">{material.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="material-card-name"><strong>{material.name}</strong><span>{material.category} · {material.rollWidth} {material.rollWidthUnit} wide</span></div>
                  {material.status === 'Low stock'
                    ? <Callout n={1}><span className="materials-status low">Low stock</span></Callout>
                    : <Callout n={2}><span className="materials-status out-of-stock">Out of stock</span></Callout>}
                </header>
                <div className="material-stock-highlight"><span>On hand</span><strong>{material.quantity} <small>{material.unit}</small></strong><span className="material-reorder-copy">Reorder at {material.reorderLevel} {material.unit}</span></div>
                <div className="material-card-extras"><div><span>Average cost</span><strong>{php(material.avgCost)} / {material.unit}</strong></div><div><span>Stock value</span><strong>{php(Number(material.quantity) * material.avgCost)}</strong></div></div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MockFrame>
  );
}

export default InventoryLowStockPreview;
