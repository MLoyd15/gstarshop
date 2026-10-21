import { useEffect, useMemo, useState } from 'react';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0);
const blank = () => ({ name: '', sku: '', category: 'Sticker', unit: 'pc', sellPrice: '', recipe: [] });
async function call(path, method = 'GET', body) {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Product request failed.');
  return data;
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]); const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [search, setSearch] = useState('');
  async function load() { const [rows, materialRows] = await Promise.all([call('/api/products'), call('/api/products/material-costs')]); setProducts(rows); setMaterials(materialRows); }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  const materialCostById = useMemo(() => new Map(materials.map((material) => [material.id, Number(material.unitCost || 0)])), [materials]);
  const visible = products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase()));
  const recipeCost = (recipe = []) => recipe.reduce((sum, line) => sum + Number(line.qtyPerUnit || 0) * Number(materialCostById.get(line.materialId) ?? line.unitCost ?? 0), 0);
  const computedUnitCost = form ? recipeCost(form.recipe) : 0;
  const computedMargin = Number(form?.sellPrice) > 0 ? (Number(form.sellPrice) - computedUnitCost) / Number(form.sellPrice) * 100 : 0;
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await call(form.id ? `/api/products/${form.id}` : '/api/products', form.id ? 'PATCH' : 'POST', form); setForm(null); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try { await call(`/api/products/${product.id}`, 'DELETE'); await load(); } catch (e) { setError(e.message); }
  }
  function openEdit(product) { setForm({ ...product, category: product.category || 'Sticker', sellPrice: product.sellPrice ?? product.price ?? '', unit: product.unit || 'pc', recipe: (product.recipe || []).map(({ materialId, qtyPerUnit }) => ({ materialId, qtyPerUnit })) }); }
  function updateLine(index, patch) { setForm((old) => ({ ...old, recipe: old.recipe.map((line, i) => i === index ? { ...line, ...patch } : line) })); }
  const materialById = new Map(materials.map((material) => [material.id, material]));
  return <section className="materials-page products-linked-page">
    <header className="materials-header"><div><div className="materials-eyebrow">SELLABLE ITEMS</div><h1>Products</h1><p>Build material recipes and see live unit costs and margins.</p></div><button className="primary-button" onClick={() => setForm(blank())}>Add product</button></header>
    {error && <div className="materials-alert" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    <div className="materials-panel"><div className="materials-toolbar"><div><h2>Products and services</h2><p>Recipe costs use the latest supplier price when available, then material average cost.</p></div><div className="materials-filters"><input aria-label="Search products" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      {!visible.length ? <div className="materials-empty">{products.length ? 'No products match your search.' : 'No products yet. Add a product to define its recipe and price.'}</div> : <div className="materials-table-wrap"><table className="materials-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Sell price</th><th>Recipe cost / unit</th><th>Margin</th><th /></tr></thead><tbody>{visible.map((product) => { const cost = recipeCost(product.recipe); const margin = Number(product.sellPrice) ? (Number(product.sellPrice) - cost) / Number(product.sellPrice) * 100 : Number(product.marginPercent || 0); return <tr key={product.id}><td><strong>{product.name}</strong><small>{(product.recipe || []).length ? `${product.recipe.length} recipe materials` : 'No material recipe'}</small></td><td>{product.sku || '—'}</td><td>{product.category || '—'}</td><td>{money(product.sellPrice ?? product.price)}</td><td>{money(cost)}</td><td>{margin.toFixed(1)}%</td><td><button className="secondary-button" onClick={() => openEdit(product)}>Edit</button> <button className="secondary-button" onClick={() => remove(product)}>Delete</button></td></tr>; })}</tbody></table></div>}
    </div>
    {form && <div className="materials-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}><form className="materials-dialog" onSubmit={save}><div className="materials-dialog-heading"><div><h2>{form.id ? 'Edit product' : 'Add product'}</h2><p>Material recipe and cost are recalculated on the server when saved.</p></div><button type="button" onClick={() => setForm(null)}>×</button></div><div className="materials-form-grid"><label>Product name<input required maxLength="120" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>SKU<input required maxLength="80" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{form.category && !['Sticker', 'Cap', 'Mug', 'Tarpaulin'].includes(form.category) && <option value={form.category}>{form.category} · choose a supported category</option>}{['Sticker', 'Cap', 'Mug', 'Tarpaulin'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Sales unit<input required maxLength="24" placeholder="pc, set, service…" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label><label>Sell price<input required type="number" min="0.0001" step="0.0001" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} /></label>
      <div className="materials-form-wide"><h3>Material recipe per sales unit</h3>{form.recipe.map((line, index) => <div className="materials-form-grid product-recipe-line" key={index}><label>Material<select required value={line.materialId} onChange={(e) => updateLine(index, { materialId: e.target.value })}><option value="">Choose material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {money(material.unitCost)}/{material.unit}</option>)}</select></label><label>Quantity per unit<input required type="number" min="0.001" step="0.001" value={line.qtyPerUnit} onChange={(e) => updateLine(index, { qtyPerUnit: e.target.value })} /></label><button type="button" className="secondary-button" onClick={() => setForm({ ...form, recipe: form.recipe.filter((_, i) => i !== index) })}>Remove</button></div>)}<button type="button" className="secondary-button" onClick={() => setForm({ ...form, recipe: [...form.recipe, { materialId: '', qtyPerUnit: 1 }] })}>＋ Add recipe material</button></div>
      <div className="product-cost-preview"><span>Live unit cost <strong>{money(computedUnitCost)}</strong></span><span>Margin <strong>{computedMargin.toFixed(1)}%</strong></span></div>
    </div><div className="materials-dialog-actions"><button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></div></form></div>}
  </section>;
}
