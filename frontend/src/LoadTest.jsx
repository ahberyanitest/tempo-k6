import { useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_K6_API_URL || 'http://localhost:8090';

function metric(run, name, key) {
  const value = run?.summary?.metrics?.[name]?.values?.[key];
  return Number.isFinite(value) ? value : null;
}

function display(value, suffix = '') {
  return value === null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export default function LoadTestPage() {
  const [run, setRun] = useState(null);
  const [vus, setVus] = useState(15);
  const [duration, setDuration] = useState(80);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function refreshRun() {
      try {
        const response = await fetch(`${apiUrl}/api/runs/current`);
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = await response.json();
        if (active) {
          setRun(data.run);
          setError('');
          setLoading(false);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || 'Could not reach the k6 runner.');
          setLoading(false);
        }
      }
    }

    refreshRun();
    const interval = window.setInterval(refreshRun, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function startRun(event) {
    event.preventDefault();
    setStarting(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vus: Number(vus), durationSeconds: Number(duration) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setRun(data.run);
    } catch (requestError) {
      setError(requestError.message || 'Could not start the k6 test.');
    } finally {
      setStarting(false);
    }
  }

  const running = run?.status === 'running';
  const finished = run?.status === 'completed';
  const hasSummary = Boolean(run?.summary);

  return (
    <>
      <section className="intro loadtest-intro">
        <p className="eyebrow">PERFORMANCE / K6 RUNNER</p>
        <h1>Put the stack<br /><em>to the test.</em></h1>
        <p className="intro-copy">Run the catalog browse scenario and watch request performance as telemetry arrives.</p>
      </section>

      <section className="loadtest" aria-labelledby="loadtest-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BROWSE SCENARIO</p>
            <h2 id="loadtest-heading">Load test</h2>
          </div>
          <span className={`run-badge ${running ? 'is-running' : finished ? 'is-complete' : ''}`}>
            <span className="status-dot" />
            {loading ? 'CONNECTING' : running ? 'RUNNING' : finished ? 'COMPLETE' : run?.status === 'failed' ? 'FAILED' : 'READY'}
          </span>
        </div>

        <form className="run-form" onSubmit={startRun}>
          <label>
            <span>Peak virtual users</span>
            <input type="number" min="1" max="50" required value={vus} onChange={(event) => setVus(event.target.value)} />
            <small>1–50 virtual users</small>
          </label>
          <label>
            <span>Test duration</span>
            <div className="input-with-unit">
              <input type="number" min="10" max="300" required value={duration} onChange={(event) => setDuration(event.target.value)} />
              <span>seconds</span>
            </div>
            <small>10–300 seconds, including ramp-up and ramp-down</small>
          </label>
          <button className="add-button" type="submit" disabled={starting || running || loading}>
            {starting ? 'Starting…' : running ? 'Test running…' : 'Start test'}
          </button>
        </form>

        {error && <p className="notice error" role="alert">{error}</p>}
        {!error && loading && <p className="notice">Connecting to the k6 runner…</p>}
        {!error && !loading && !run && <p className="notice">Ready when you are. Start a test to generate traffic through the catalog and inventory services.</p>}

        {run && (
          <div className="run-results" aria-live="polite">
            <div className="run-details">
              <span>{run.startedAt ? `STARTED ${new Date(run.startedAt).toLocaleString()}` : 'PREPARING TEST'}</span>
              <span>{run.config.vus} VUS / {run.config.durationSeconds}s</span>
            </div>
            {running && <p className="notice">Traffic is running. Metrics and traces may take a short time to appear in Grafana.</p>}
            {run.status === 'failed' && <p className="notice error" role="alert">{run.error || 'The k6 test failed.'}</p>}
            {hasSummary && (
              <>
                <div className="metric-grid">
                  <article className="metric-card"><span>REQUESTS</span><strong>{display(metric(run, 'http_reqs', 'count'))}</strong><small>total requests</small></article>
                  <article className="metric-card"><span>REQUEST RATE</span><strong>{display(metric(run, 'http_reqs', 'rate'), '/s')}</strong><small>average per second</small></article>
                  <article className="metric-card"><span>P95 LATENCY</span><strong>{display(metric(run, 'http_req_duration', 'p(95)'), ' ms')}</strong><small>request duration</small></article>
                  <article className="metric-card"><span>CHECKS PASSED</span><strong>{display(metric(run, 'checks', 'rate') === null ? null : metric(run, 'checks', 'rate') * 100, '%')}</strong><small>{display(metric(run, 'checks', 'passes'))} passed / {display(metric(run, 'checks', 'fails'))} failed</small></article>
                  <article className="metric-card"><span>FAILED REQUESTS</span><strong>{display(metric(run, 'http_req_failed', 'rate') === null ? null : metric(run, 'http_req_failed', 'rate') * 100, '%')}</strong><small>share of requests</small></article>
                </div>
                <p className="results-note">
                  {finished ? 'Explore' : 'The run did not meet its thresholds. Explore'} detailed traces, logs, and service latency in <a href="http://localhost:3000" target="_blank" rel="noreferrer">Grafana ↗</a>.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
