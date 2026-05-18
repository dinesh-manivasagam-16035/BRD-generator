'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const { generateBRD } = require('./brdGenerator');
const { createZohoWriterDoc, brdToHTML } = require('./zohoWriter');

const app = express();
// Using GitHub Models (free tier) as the LLM backend — OpenAI-compatible API.
// Lazy instantiation so module load never fails when env vars are missing.
let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  // Prefer OpenAI direct; fall back to GitHub Models proxy if only GITHUB_TOKEN is set.
  const useOpenAI = !!process.env.OPENAI_API_KEY;
  const apiKey = useOpenAI ? process.env.OPENAI_API_KEY : process.env.GITHUB_TOKEN;
  if (!apiKey) {
    const err = new Error('Missing OPENAI_API_KEY / GITHUB_TOKEN env var');
    err.code = 'MISSING_LLM_KEY';
    throw err;
  }
  _openai = new OpenAI({
    apiKey,
    baseURL: useOpenAI ? undefined : 'https://models.github.ai/inference',
  });
  return _openai;
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer — store uploads in /tmp (writable in Catalyst Functions runtime)
const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ── Root ─────────────────────────────────────────────────────────────────────
// SPA is served by the Catalyst Client (`AutoMateBRDClient` mapped to `/*`).
// This function only exposes API endpoints under /server/AutoMateBRDFunction/.
app.get('/', (_req, res) => {
  res.json({
    service: 'AutoMateBRDFunction',
    status: 'ok',
    endpoints: ['/health', '/debug-models', '/generate-brd', '/push-to-zoho'],
  });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /generate-brd ────────────────────────────────────────────────────────
/**
 * Accepts multipart/form-data with:
 *   - file           : video, audio, or transcript file (required unless transcript field is set)
 *   - transcript     : raw transcript text (optional alternative to file)
 *   - projectName    : string (optional)
 *   - clientName     : string (optional)
 *   - analystName    : string (optional)
 *   - managerInputs  : string (optional) — extra notes from the Meeting Manager
 *
 * Returns: { success, brd, html, projectDetails }
 * The client then reviews/edits the HTML and POSTs it to /push-to-zoho.
 */
app.post('/generate-brd', upload.single('audio'), async (req, res) => {
  const tmpFilePath = req.file ? req.file.path : null;

  try {
    // ── 1. Validate input ────────────────────────────────────────────────────
    if (!req.file && !req.body.transcript) {
      return res.status(400).json({
        success: false,
        error: 'No input provided. Send a file or a "transcript" field.',
      });
    }

    const projectDetails = {
      projectName: (req.body.projectName || 'Untitled Project').trim(),
      clientName:  (req.body.clientName  || 'Unknown Client').trim(),
      analystName: (req.body.analystName || 'Business Analyst').trim(),
      date:        new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
    };

    // managerInputs may arrive as a string, an object (e.g. {"priority":"high"}),
    // or be omitted entirely. Normalize to a trimmed string for downstream prompt use.
    let managerInputs = req.body.managerInputs;
    if (managerInputs && typeof managerInputs === 'object') {
      try {
        managerInputs = JSON.stringify(managerInputs);
      } catch (_) {
        managerInputs = '';
      }
    } else if (typeof managerInputs === 'string') {
      managerInputs = managerInputs.trim();
    } else {
      managerInputs = '';
    }

    // ── 2. Resolve transcript text ───────────────────────────────────────────
    let transcriptText = '';

    if (req.file) {
      const mime = req.file.mimetype;

      if (mime === 'text/plain') {
        // Plain-text transcript — read directly
        transcriptText = fs.readFileSync(tmpFilePath, 'utf8');
      } else if (mime === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(fs.readFileSync(tmpFilePath));
        transcriptText = data.text;
      } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: tmpFilePath });
        transcriptText = result.value;
      } else {
        // Audio / video — transcribe via OpenAI Whisper
        transcriptText = await transcribeFile(tmpFilePath, req.file.originalname);
      }
    } else {
      // Transcript supplied as a text field in the request body
      transcriptText = (req.body.transcript || '').trim();
    }

    if (!transcriptText) {
      return res.status(422).json({
        success: false,
        error: 'Transcript is empty. Please provide a valid input.',
      });
    }

    // ── 3. Generate BRD JSON via OpenAI (transcript + manager inputs) ──────
    const brd = await generateBRD(transcriptText, projectDetails, getOpenAI(), managerInputs);

    // ── 4. Render preview HTML — DO NOT push to Zoho yet ─────────────────────
    const html = brdToHTML(brd, projectDetails);

    return res.status(200).json({
      success: true,
      brd,
      html,
      projectDetails,
    });

  } catch (err) {
    console.error('[generate-brd] Error:', err);

    // Detect GitHub Models / OpenAI rate-limit (429) and surface a friendly message.
    const msg = (err && err.message) ? String(err.message) : '';
    const isRateLimit =
      err && (err.status === 429 || err.code === 'rate_limit_exceeded' ||
        /rate.?limit|quota|too many requests/i.test(msg));

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        error: 'AI provider rate limit reached. GitHub Models free tier allows ~8 requests/minute and ~50/day per model. Please wait ~60 seconds and try again.',
        code: 'RATE_LIMIT',
        retryAfterSec: 60,
      });
    }

    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'An unexpected error occurred.',
      code: err.code,
      status: err.status,
    });
  } finally {
    // Clean up temp file
    if (tmpFilePath) {
      try { fs.unlinkSync(tmpFilePath); } catch (_) { /* ignore */ }
    }
  }
});

// ── POST /push-to-zoho ────────────────────────────────────────────────────────
/**
 * After the Meeting Manager reviews/edits the BRD preview, the client posts:
 *   { brd, editedHtml, projectDetails }
 * and we create the Zoho Writer document from the edited HTML.
 */
app.post('/push-to-zoho', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    // Body may arrive as a JSON string (text/plain to avoid CORS preflight)
    // or as a parsed object (application/json via express.json()).
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
      }
    }
    const { brd, editedHtml, projectDetails } = body || {};
    if (!projectDetails || (!editedHtml && !brd)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectDetails and editedHtml (or brd).',
      });
    }

    const { documentId, documentUrl, documentName } =
      await createZohoWriterDoc(brd, projectDetails, editedHtml);

    return res.status(200).json({
      success: true,
      documentId,
      documentUrl,
      documentName,
      projectName: projectDetails.projectName,
    });
  } catch (err) {
    console.error('[push-to-zoho] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to push document to Zoho Writer.',
    });
  }
});

// ── OpenAI Whisper transcription helper ───────────────────────────────────────
async function transcribeFile(filePath, originalName) {
  const fileStream = fs.createReadStream(filePath);
  // Whisper requires the filename to have a valid extension for format detection
  fileStream.path = originalName || path.basename(filePath);

  const response = await getOpenAI().audio.transcriptions.create({
    model: 'whisper-1',
    file:  fileStream,
    response_format: 'text',
  });

  return typeof response === 'string' ? response : response.text || '';
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ── Catalyst / local startup ──────────────────────────────────────────────────
const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;
app.listen(PORT, () => {
  console.log(`AutoMateBRD server listening on port ${PORT}`);
});

module.exports = app;
