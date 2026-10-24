import '../../../styles/MaterialsPage.css';
import '../../../styles/ProductsPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { products, php } from '../mockData.js';

function ProductRecipePreview() {
  const product = products[0];
  return (
    <MockFrame variant="guide-mock-product">
      <section className="materials-page products-linked-page products-page">
        <div className="materials-dialog">
          <div className="materials-dialog-heading"><div><h2>Add product</h2><p>Material recipe and cost are recalculated when saved.</p></div><button className="btn btn-icon btn-ghost" type="button" aria-label="Close">×</button></div>
          <div className="materials-form-grid">
            <label>Product name<input className="input" value={product.name} readOnly /></label>
            <label>SKU<input className="input" value={product.sku} readOnly /></label>
            <label>Category<select className="select" defaultValue={product.category}><option>{product.category}</option></select></label>
            <label>Sales unit<input className="input" value={product.unit} readOnly /></label>
            <label>Sell price (PHP)<input className="input" type="number" value={product.sellPrice} readOnly /></label>
            <div className="materials-form-wide">
              <h3>Material recipe per sales unit</h3>
              {product.recipe.map((line, index) => {
                const fields = <div className="materials-form-grid product-recipe-line" key={line.materialId}>
                  <label>Material<select className="select" defaultValue={line.materialId}><option value={line.materialId}>{line.materialName} · {php(line.unitCost)}/{line.unit}</option></select></label>
                  <label>Quantity per unit<input className="input" type="number" value={line.qtyPerUnit} readOnly /></label>
                  <span className="guide-mock-line-total">Line cost: {php(line.lineCost)}</span>
                </div>;
                return index === 0 ? <Callout n={1} key={line.materialId}>{fields}</Callout> : fields;
              })}
              <button type="button" className="btn btn-secondary">＋ Add recipe material</button>
            </div>
            <Callout n={2}><div className="product-cost-preview">
              <span>Live unit cost <strong>{php(product.unitCost)}</strong></span>
              <span>Sell price <strong>{php(product.sellPrice)}</strong></span>
              <span>Margin <strong>{product.marginPercent}%</strong></span>
            </div></Callout>
          </div>
          <div className="materials-dialog-actions"><button type="button" className="btn btn-secondary">Cancel</button><Callout n={3}><button type="button" className="btn btn-secondary">Save product</button></Callout></div>
        </div>
      </section>
    </MockFrame>
  );
}

export default ProductRecipePreview;
