import { useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function App() {
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);

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

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Fieldwork Supply home">
          <span className="mark" aria-hidden="true">F</span>
          FIELDWORK <span>SUPPLY CO.</span>
        </a>
        <div className="topbar-status"><span className={`status-dot ${state === 'ready' ? 'is-live' : ''}`} />CATALOG API</div>
      </header>

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

      <footer className="page-footer">
        <span>FIELDWORK SUPPLY CO. / 2026</span>
        <span>BUILT FOR THE OUTSIDE</span>
      </footer>
    </main>
  );
}
