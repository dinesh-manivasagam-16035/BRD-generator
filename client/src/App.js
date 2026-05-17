import React, { useRef, useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const ZOHO_LOGO = (process.env.PUBLIC_URL || '') + '/zoho-logo.svg';

const ZOHO_RED = '#E42527';
const ZOHO_RED_DARK = '#C8202C';
const ZOHO_BLUE = '#226DB4';

const ZOHO_PRODUCTS = [
  'Zoho CRM', 'Zoho Desk', 'Zoho Books', 'Zoho Inventory', 'Zoho People',
  'Zoho Recruit', 'Zoho Projects', 'Zoho Creator', 'Zoho Analytics',
  'Zoho Campaigns', 'Zoho SalesIQ', 'Zoho Mail', 'Zoho Cliq',
  'Zoho WorkDrive', 'Zoho Sign', 'Zoho Flow', 'Zoho Forms', 'Zoho Survey',
];

function App() {
  const [step, setStep] = useState(1);

  // Step 1 inputs
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [analystName, setAnalystName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [managerInputs, setManagerInputs] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Step 2 review
  const [brd, setBrd] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [projectDetails, setProjectDetails] = useState(null);

  // Step 3 push
  const [pushResult, setPushResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previewRef = useRef(null);

  // Re-render mermaid when preview HTML updates
  useEffect(() => {
    if (step === 2 && previewHtml && window.mermaid) {
      try {
        window.mermaid.run({ querySelector: '.mermaid' });
      } catch (e) {
        console.warn('Mermaid render failed', e);
      }
    }
  }, [previewHtml, step]);

  const toggleProduct = (p) => {
    setSelectedProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');

    if (!file && !transcript.trim()) {
      setError('Please upload a meeting recording or paste a transcript.');
      return;
    }
    if (!projectName.trim()) {
      setError('Please enter the project name.');
      return;
    }

    const formData = new FormData();
    if (file) formData.append('audio', file);
    if (transcript.trim()) formData.append('transcript', transcript.trim());
    formData.append('projectName', projectName.trim());
    formData.append('clientName', clientName.trim());
    formData.append('analystName', analystName.trim());
    formData.append('projectDescription', projectDescription.trim());
    formData.append('managerInputs', managerInputs.trim());
    formData.append('selectedProducts', JSON.stringify(selectedProducts));

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate-brd`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setBrd(data.brd);
      setPreviewHtml(data.html || '');
      setProjectDetails(data.projectDetails || null);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setError('');
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000); // 110s, under Catalyst 120s
    try {
      // Prefer the source HTML over the rendered DOM to avoid inlined mermaid SVG bloat.
      const renderedHtml = previewRef.current ? previewRef.current.innerHTML : '';
      const sourceHtml = previewHtml || '';
      let editedHtml = sourceHtml || renderedHtml;
      // If user actually edited the preview, the rendered DOM may differ; only fall back to it
      // when source is empty. Strip any inlined <svg> blocks to keep payload small.
      if (!editedHtml && renderedHtml) editedHtml = renderedHtml;
      editedHtml = editedHtml.replace(/<svg[\s\S]*?<\/svg>/gi, '');

      const payload = JSON.stringify({ brd, editedHtml, projectDetails });
      const sizeKb = (new Blob([payload]).size / 1024).toFixed(1);
      // eslint-disable-next-line no-console
      console.log(`[push-to-zoho] payload size: ${sizeKb} KB`);

      let res;
      try {
        res = await fetch(`${API_BASE}/push-to-zoho`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: controller.signal,
        });
      } catch (netErr) {
        if (netErr.name === 'AbortError') {
          throw new Error('Request timed out after 110s. Try again or reduce content size.');
        }
        // eslint-disable-next-line no-console
        console.error('[push-to-zoho] network error:', netErr);
        throw new Error(`Network error: ${netErr.message}. Check console / DevTools Network tab.`);
      }

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        const text = await res.text().catch(() => '');
        throw new Error(`Invalid response (${res.status}): ${text.slice(0, 200) || parseErr.message}`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Push failed (${res.status})`);
      }
      setPushResult(data);
      setStep(3);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[push-to-zoho] error:', err);
      setError(err.message || 'Push to Zoho Writer failed.');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setFile(null);
    setTranscript('');
    setProjectName('');
    setClientName('');
    setAnalystName('');
    setProjectDescription('');
    setManagerInputs('');
    setSelectedProducts([]);
    setBrd(null);
    setPreviewHtml('');
    setProjectDetails(null);
    setPushResult(null);
    setError('');
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src={ZOHO_LOGO} alt="Zoho" style={styles.logo} />
          <div style={styles.divider} />
          <h1 style={styles.title}>BRDPilot</h1>
        </div>
        <p style={styles.subtitle}>
          AI-powered Business Requirements Documents for Zoho implementations —
          analyse meeting transcripts & manager notes, review, then push to Zoho Writer.
        </p>
      </header>

      <div style={styles.stepper}>
        {['Inputs', 'Review & Edit', 'Push to Writer'].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} style={styles.stepItem}>
              <div
                style={{
                  ...styles.stepCircle,
                  ...(active ? styles.stepActive : {}),
                  ...(done ? styles.stepDone : {}),
                }}
              >
                {done ? '✓' : n}
              </div>
              <span style={{ ...styles.stepLabel, ...(active ? { color: ZOHO_RED, fontWeight: 600 } : {}) }}>
                {label}
              </span>
              {n < 3 && <div style={styles.stepConnector} />}
            </div>
          );
        })}
      </div>

      <main style={styles.main}>
        {step === 1 && (
          <form onSubmit={handleGenerate} style={styles.card}>
            <label style={styles.sectionLabel}>Project details</label>
            <div style={styles.grid2}>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project Name *"
                style={styles.input}
              />
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client / Company"
                style={styles.input}
              />
              <input
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                placeholder="Business Analyst"
                style={styles.input}
              />
              <input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Short Description"
                style={styles.input}
              />
            </div>

            <label style={styles.sectionLabel}>Meeting recording / document</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current && inputRef.current.click()}
              style={{ ...styles.dropzone, ...(isDragging ? styles.dropzoneActive : {}) }}
            >
              <div style={styles.dropIcon}>⬆</div>
              <div style={styles.dropTitle}>
                {file ? file.name : 'Drag & drop or click to browse'}
              </div>
              <div style={styles.dropHint}>
                Supported: .mp4, .mp3, .wav, .m4a, .txt, .pdf, .docx
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".mp4,.mp3,.wav,.m4a,.txt,.pdf,.docx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <label style={styles.sectionLabel}>Meeting transcript (optional)</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste meeting transcript here, or leave blank if uploading a recording..."
              rows={6}
              style={styles.textarea}
            />

            <label style={styles.sectionLabel}>Manager / Meeting Manager inputs</label>
            <textarea
              value={managerInputs}
              onChange={(e) => setManagerInputs(e.target.value)}
              placeholder="Add manager's notes, additional context, decisions, or clarifications to merge with the transcript..."
              rows={5}
              style={styles.textarea}
            />

            <label style={styles.sectionLabel}>Zoho products in scope</label>
            <div style={styles.chipRow}>
              {ZOHO_PRODUCTS.map((p) => {
                const selected = selectedProducts.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => toggleProduct(p)}
                    style={{ ...styles.chip, ...(selected ? styles.chipSelected : {}) }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            >
              {loading ? 'Analysing & generating BRD…' : 'Generate BRD →'}
            </button>
          </form>
        )}

        {step === 2 && (
          <div style={styles.card}>
            <label style={styles.sectionLabel}>Review & edit the BRD</label>
            <p style={styles.helpText}>
              The document below is editable. Make any changes inline, then push the
              final version to Zoho Writer.
            </p>

            <div
              ref={previewRef}
              contentEditable
              suppressContentEditableWarning
              style={styles.previewDoc}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.actionRow}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={styles.buttonSecondary}
                disabled={loading}
              >
                ← Back to inputs
              </button>
              <button
                type="button"
                onClick={handlePush}
                disabled={loading}
                style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}), flex: 1 }}
              >
                {loading ? 'Pushing to Zoho Writer…' : 'Push to Zoho Writer →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && pushResult && (
          <div style={styles.successCard}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.resultTitle}>BRD pushed to Zoho Writer</h2>
            {pushResult.documentName && (
              <div style={styles.resultRow}>
                <strong>{pushResult.documentName}</strong>
              </div>
            )}
            {pushResult.documentId && (
              <div style={styles.resultRow}>
                Document ID: <code>{pushResult.documentId}</code>
              </div>
            )}
            <div style={styles.resultLinks}>
              {pushResult.documentUrl && (
                <a
                  href={pushResult.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.linkPrimary}
                >
                  Open in Zoho Writer →
                </a>
              )}
              <button type="button" onClick={resetAll} style={styles.linkSecondary}>
                Create another BRD
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        Powered by Zoho Catalyst · Zoho Writer · GitHub Models
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '48px 20px 80px',
    fontFamily:
      "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    maxWidth: 880,
    margin: '0 auto 32px',
    textAlign: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  logo: { height: 36, width: 'auto' },
  divider: {
    width: 1,
    height: 28,
    background: 'rgba(0,0,0,0.15)',
  },
  title: {
    fontFamily: "'Poppins', 'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    background: `linear-gradient(135deg, ${ZOHO_RED} 0%, ${ZOHO_RED_DARK} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 640,
    margin: '0 auto',
  },
  main: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  card: {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 18,
    padding: 28,
    boxShadow:
      '0 10px 30px rgba(228, 37, 39, 0.08), 0 2px 6px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  dropzone: {
    border: '2px dashed #f0c4c5',
    borderRadius: 14,
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.6)',
    transition: 'all 0.2s ease',
  },
  dropzoneActive: {
    borderColor: ZOHO_RED,
    background: '#fef2f2',
    transform: 'scale(1.01)',
  },
  dropIcon: {
    fontSize: 28,
    color: ZOHO_RED,
    marginBottom: 8,
  },
  dropTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 4,
  },
  dropHint: { fontSize: 12.5, color: '#6b7280' },
  orRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '6px 0',
  },
  orLine: { flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' },
  orText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 600,
    letterSpacing: '1px',
  },
  textarea: {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    background: 'rgba(255,255,255,0.8)',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  error: {
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 500,
  },
  button: {
    marginTop: 6,
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    background: `linear-gradient(135deg, ${ZOHO_RED} 0%, ${ZOHO_RED_DARK} 100%)`,
    boxShadow: '0 8px 20px rgba(228, 37, 39, 0.35)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s',
    letterSpacing: '0.2px',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  resultCard: {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(228, 37, 39, 0.15)',
    borderLeft: `4px solid ${ZOHO_RED}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  },
  resultTitle: {
    fontFamily: "'Poppins', 'Inter', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 10,
  },
  resultRow: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 14,
    wordBreak: 'break-all',
  },
  resultLinks: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  linkPrimary: {
    display: 'inline-block',
    padding: '10px 16px',
    background: `linear-gradient(135deg, ${ZOHO_RED} 0%, ${ZOHO_RED_DARK} 100%)`,
    color: '#fff',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
    boxShadow: '0 6px 14px rgba(228, 37, 39, 0.3)',
  },
  linkSecondary: {
    display: 'inline-block',
    padding: '10px 16px',
    background: '#fff',
    color: ZOHO_RED_DARK,
    border: `1px solid ${ZOHO_RED}`,
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12.5,
    marginTop: 40,
    letterSpacing: '0.3px',
  },
  stepper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
    padding: '8px 24px 24px',
    flexWrap: 'wrap',
    maxWidth: 720,
    margin: '0 auto',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#e5e7eb',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 14,
    transition: 'all 0.2s ease',
  },
  stepActive: {
    background: `linear-gradient(135deg, ${ZOHO_RED} 0%, ${ZOHO_RED_DARK} 100%)`,
    color: '#fff',
    boxShadow: '0 4px 10px rgba(228, 37, 39, 0.35)',
  },
  stepDone: { background: '#10b981', color: '#fff' },
  stepLabel: { fontSize: 13.5, color: '#374151', marginRight: 8, fontWeight: 500 },
  stepConnector: {
    width: 40,
    height: 2,
    background: '#e5e7eb',
    marginRight: 8,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 4,
  },
  input: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    background: 'rgba(255,255,255,0.85)',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#374151',
    transition: 'all 0.15s ease',
  },
  chipSelected: {
    background: `linear-gradient(135deg, ${ZOHO_RED} 0%, ${ZOHO_RED_DARK} 100%)`,
    color: '#fff',
    borderColor: ZOHO_RED,
    boxShadow: '0 3px 8px rgba(228, 37, 39, 0.25)',
  },
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    margin: '4px 0 8px',
    lineHeight: 1.5,
  },
  previewDoc: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '24px 28px',
    minHeight: 400,
    maxHeight: 640,
    overflowY: 'auto',
    fontSize: 14,
    lineHeight: 1.65,
    color: '#1f2937',
    outline: 'none',
  },
  actionRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  buttonSecondary: {
    padding: '12px 18px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  successCard: {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderLeft: '4px solid #10b981',
    borderRadius: 16,
    padding: 32,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
    textAlign: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    fontSize: 32,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
  },
};

export default App;
