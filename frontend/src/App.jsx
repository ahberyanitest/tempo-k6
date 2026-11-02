import { useEffect, useState } from 'react';
import LoadTestPage from './LoadTest.jsx';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function App() {
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [newProduct, setNewProduct] = useState({ sku: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState(false);
  const isLoadTestPage = window.location.pathname === '/load-test';

  async function loadProducts() {
    setState('loading');
    try {
      const response = await fetch(`${apiUrl}/api/products`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setProducts(await response.json());
      setUpdatedAt(new Date());
      setState('ready');
    } catch (error) {
      setState(error.message || 'Could not reach the catalog service');
    }
  }

  async function addProduct(event) {
    event.preventDefault();
    setSaving(true);
    setFormMessage('');
    setFormError(false);

    try {
      const response = await fetch(`${apiUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });

      if (!response.ok) {
        let message = response.status === 409
          ? 'A product with this SKU already exists.'
          : 'Unable to add product. Check the details and try again.';
        try {
          const error = await response.json();
          if (error.detail) message = error.detail;
        } catch {
          // Keep the readable fallback when the response has no JSON body.
        }
        throw new Error(message);
      }

      const product = await response.json();
      setProducts((current) => [...current, product].sort((a, b) => a.sku.localeCompare(b.sku)));
      setUpdatedAt(new Date());
      setState('ready');
      setNewProduct({ sku: '', name: '' });
      setFormMessage(`${product.name} added to the catalog.`);
    } catch (error) {
      setFormError(true);
      setFormMessage(error.message || 'Could not add product.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isLoadTestPage) loadProducts();
  }, [isLoadTestPage]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Fieldwork Supply home">
          <span className="mark" aria-hidden="true">F</span>
          FIELDWORK <span>SUPPLY CO.</span>
        </a>
        <nav className="topbar-links" aria-label="Main navigation">
          <a className={!isLoadTestPage ? 'is-active' : ''} href="/">Catalog</a>
          <a className={isLoadTestPage ? 'is-active' : ''} href="/load-test">Load test</a>
        </nav>
      </header>

      {isLoadTestPage ? <LoadTestPage /> : (
        <>
      <section className="intro">
        <p className="eyebrow">EVERYDAY EQUIPMENT / ISSUE 01</p>
        <h1>Made for the<br /><em>long way around.</em></h1>
        <p className="intro-copy">Thoughtful tools for the miles between here and there.</p>
      </section>

      <section className="catalog" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE FIELD KIT</p>
            <h2 id="catalog-heading">Current essentials <span>{products.length.toString().padStart(2, '0')}</span></h2>
          </div>
          <button className="refresh-button" type="button" onClick={loadProducts} disabled={state === 'loading'} aria-label="Refresh catalog" title="Refresh catalog">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></svg>
          </button>
        </div>

        <form className="product-form" onSubmit={addProduct}>
          <label>
            <span>SKU</span>
            <input
              required
              maxLength={64}
              pattern="[A-Za-z0-9._-]+"
              value={newProduct.sku}
              onChange={(event) => setNewProduct({ ...newProduct, sku: event.target.value })}
              placeholder="sku-404"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Product name</span>
            <input
              required
              maxLength={160}
              value={newProduct.name}
              onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
              placeholder="Trail Mug"
              autoComplete="off"
            />
          </label>
          <button className="add-button" type="submit" disabled={saving}>
            <span aria-hidden="true">+</span>{saving ? 'Saving…' : 'Add product'}
          </button>
          <p className={`form-feedback ${formError ? 'is-error' : ''}`} role={formError ? 'alert' : 'status'}>
            {formMessage}
          </p>
        </form>

        {state === 'loading' && <p className="notice">Connecting to the catalog…</p>}
        {state !== 'loading' && state !== 'ready' && <p className="notice error">{state}. Check that the services are running, then retry.</p>}
        {state === 'ready' && (
          <div className="product-list">
            {products.map((product, index) => (
              <article className="product-row" key={product.sku}>
                <div className={`product-art art-${index + 1}`} aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></div>
                <div className="product-info">
                  <p className="product-kind">FIELD OBJECT / {product.sku}</p>
                  <h3>{product.name}</h3>
                </div>
                <div className="stock"><span className="stock-count">{product.available}</span><span>IN STOCK</span></div>
                <span className="row-arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        )}
        <div className="catalog-footer">
          <span>{updatedAt ? `SYNCED ${updatedAt.toLocaleTimeString()}` : 'AWAITING SERVICE'}</span>
          <span>LIVE INVENTORY</span>
        </div>
      </section>
        </>
      )}

      <footer className="page-footer">
        <span>FIELDWORK SUPPLY CO. / 2026</span>
        <span>BUILT FOR THE OUTSIDE</span>
      </footer>
    </main>
  );
}
