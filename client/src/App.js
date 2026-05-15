import React, { useRef, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const ZOHO_LOGO =
  'https://www.zohowebstatic.com/sites/zweb/images/zoho_general_pages/zoho-logo-web.svg';

const ZOHO_RED = '#E42527';
const ZOHO_RED_DARK = '#C8202C';

function App() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!file && !transcript.trim()) {
      setError('Please upload a file or paste a transcript.');
      return;
    }

    const formData = new FormData();
    if (file) formData.append('file', file);
    if (transcript.trim()) formData.append('transcript', transcript.trim());

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate-brd`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src={ZOHO_LOGO} alt="Zoho" style={styles.logo} />
          <div style={styles.divider} />
          <h1 style={styles.title}>SMBS BRD Generator</h1>
        </div>
        <p style={styles.subtitle}>
          AI-powered Business Requirements Documents — drop a meeting recording or transcript, get a polished BRD in Zoho Writer.
        </p>
      </header>

      <main style={styles.main}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <label style={styles.sectionLabel}>1. Upload meeting file</label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current && inputRef.current.click()}
            style={{
              ...styles.dropzone,
              ...(isDragging ? styles.dropzoneActive : {}),
            }}
          >
            <div style={styles.dropIcon}>⬆</div>
            <div style={styles.dropTitle}>
              {file ? file.name : 'Drag & drop a file here, or click to browse'}
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

          <div style={styles.orRow}>
            <div style={styles.orLine} />
            <span style={styles.orText}>OR</span>
            <div style={styles.orLine} />
          </div>

          <label style={styles.sectionLabel}>2. Paste a transcript</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your meeting transcript here..."
            rows={8}
            style={styles.textarea}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? 'Generating BRD...' : 'Generate BRD'}
          </button>
        </form>

        {result && (
          <div style={styles.resultCard}>
            <h2 style={styles.resultTitle}>✨ BRD generated successfully</h2>
            {result.documentId && (
              <div style={styles.resultRow}>
                Document ID: <strong>{result.documentId}</strong>
              </div>
            )}
            <div style={styles.resultLinks}>
              {result.viewUrl && (
                <a
                  href={result.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.linkPrimary}
                >
                  Open BRD in Zoho Writer →
                </a>
              )}
              {result.downloadUrl && (
                <a
                  href={result.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.linkSecondary}
                >
                  Download BRD →
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        Powered by Zoho Catalyst · Zoho Writer · OpenAI
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
};

export default App;
