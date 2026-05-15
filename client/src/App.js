import React, { useState, useRef } from 'react';

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    padding: '40px',
    width: '100%',
    maxWidth: '640px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '32px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  section: { marginBottom: '24px' },
  dropzone: (isDragging) => ({
    border: `2px dashed ${isDragging ? '#667eea' : '#cbd5e0'}`,
    borderRadius: '10px',
    padding: '32px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragging ? '#ebf4ff' : '#f7fafc',
    transition: 'all 0.2s',
  }),
  dropzoneText: { color: '#718096', fontSize: '14px' },
  fileName: {
    marginTop: '10px',
    fontSize: '13px',
    color: '#2d3748',
    fontWeight: '600',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#2d3748',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
  },
  button: (loading) => ({
    width: '100%',
    padding: '14px',
    background: loading ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.2s',
  }),
  error: {
    background: '#fff5f5',
    border: '1px solid #fc8181',
    borderRadius: '8px',
    padding: '14px',
    color: '#c53030',
    fontSize: '14px',
    marginTop: '16px',
  },
  result: {
    background: '#f0fff4',
    border: '1px solid #68d391',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '16px',
  },
  resultTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#276749',
    marginBottom: '10px',
  },
  link: {
    display: 'inline-block',
    marginTop: '8px',
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
    wordBreak: 'break-all',
  },
  divider: {
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: '13px',
    margin: '8px 0',
  },
};

export default function App() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file && !transcript.trim()) {
      setError('Please upload a file or paste a transcript.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (transcript.trim()) formData.append('transcript', transcript.trim());

      const res = await fetch('/generate-brd', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>AutoMateBRD</h1>
        <p style={styles.subtitle}>
          Upload a meeting recording or paste a transcript to generate a Business Requirements Document automatically.
        </p>

        <form onSubmit={handleSubmit}>
          {/* File upload */}
          <div style={styles.section}>
            <label style={styles.label}>Upload File (audio/video/text)</label>
            <div
              style={styles.dropzone(isDragging)}
              onClick={() => inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <p style={styles.dropzoneText}>
                {isDragging ? 'Drop it here!' : 'Drag & drop a file, or click to browse'}
              </p>
              <p style={{ ...styles.dropzoneText, fontSize: '12px', marginTop: '4px' }}>
                Supported: .mp4, .mp3, .wav, .m4a, .txt, .pdf, .docx
              </p>
              {file && <p style={styles.fileName}>Selected: {file.name}</p>}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mp3,.wav,.m4a,.txt,.pdf,.docx"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Divider */}
          <div style={styles.divider}>— OR —</div>

          {/* Transcript textarea */}
          <div style={styles.section}>
            <label style={styles.label}>Paste Transcript</label>
            <textarea
              style={styles.textarea}
              placeholder="Paste your meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>

          <button type="submit" style={styles.button(loading)} disabled={loading}>
            {loading ? 'Generating BRD...' : 'Generate BRD'}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        {result && (
          <div style={styles.result}>
            <p style={styles.resultTitle}>BRD Generated Successfully!</p>
            {result.documentId && (
              <p style={{ fontSize: '13px', color: '#2d6a4f' }}>
                Document ID: <strong>{result.documentId}</strong>
              </p>
            )}
            {result.viewUrl && (
              <a href={result.viewUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                Open BRD in Zoho Writer →
              </a>
            )}
            {result.downloadUrl && (
              <>
                <br />
                <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  Download BRD →
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
