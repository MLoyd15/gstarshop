import '../../../styles/MaterialsPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { materials, php } from '../mockData.js';

function MaterialsListPreview() {
  return (
    <MockFrame variant="guide-mock-materials">
      <section className="materials-page">
        <header className="materials-heading">
          <div><div className="materials-eyebrow">RAW MATERIALS</div><h1>Materials</h1><p>Track stock levels, suppliers, and supplies used on jobs.</p></div>
          <button className="materials-primary" type="button">＋ Add material</button>
        </header>
        <div className="materials-panel">
          <div className="materials-toolbar"><div><h2>Stock on hand</h2><p>Balances change through recorded stock movements.</p></div></div>
          <div className="materials-table-wrap">
            <table className="materials-table">
              <thead><tr>
                <th>Material</th>
                <th><Callout n={1}>Base unit</Callout></th>
                <th><Callout n={2}>Roll width</Callout></th>
                <th><Callout n={3}>Stock</Callout></th>
              </tr></thead>
              <tbody>{materials.map((material) => (
                <tr key={material.id}>
                  <td><strong>{material.name}</strong><small>{material.category}</small></td>
                  <td>{material.unit}</td>
                  <td>{material.rollWidth === '—' ? '—' : `${material.rollWidth} ${material.rollWidthUnit}`}</td>
                  <td><strong>{material.quantity} {material.unit}</strong><small>Reorder at {material.reorderLevel} {material.unit}</small><span className={`materials-status ${material.status.toLowerCase().replaceAll(' ', '-')}`}>{material.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="guide-mock-material-cost-note">Sample average cost: {php(materials[0].avgCost)} / {materials[0].unit}</div>
      </section>
    </MockFrame>
  );
}

export default MaterialsListPreview;
