# AutoMateBRD

Automatically generate Business Requirements Documents (BRDs) from meeting videos or transcripts using OpenAI GPT-4o and Zoho Writer — deployed on Zoho Catalyst.

---

## Overview

AutoMateBRD accepts a video file or plain-text transcript, extracts the content, sends it to OpenAI for structured BRD generation, and saves the result as a Zoho Writer document. A React frontend provides a simple upload interface.

### Architecture

```
React Frontend (client/)
        │
        ▼
Zoho Catalyst Advanced Function (functions/AutoMateBRDFunction/)
        │
        ├── brdGenerator.js  →  OpenAI GPT-4o
        └── zohoWriter.js    →  Zoho Writer API v1
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18.x |
| Zoho Catalyst CLI | latest (`npm i -g zcatalyst-cli`) |
| Zoho Writer account | — |
| OpenAI account | — |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (sk-…) |
| `ZOHO_CLIENT_ID` | Zoho OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth refresh token (offline access) |
| `ZOHO_WRITER_API_URL` | Zoho Writer API base URL (e.g. `https://writer.zoho.com/api/v1`) |
| `ZOHO_ACCOUNTS_URL` | Zoho Accounts URL (e.g. `https://accounts.zoho.com`) |

### Obtaining Zoho OAuth Credentials

1. Go to [Zoho API Console](https://api-console.zoho.com/) and create a **Server-based Application**.
2. Add the scope: `ZohoWriter.documents.ALL`.
3. Generate an authorization code and exchange it for a refresh token using the standard OAuth 2.0 flow.
4. Copy the `client_id`, `client_secret`, and `refresh_token` into `.env`.

---

## Local Development

### Install dependencies

```bash
# Backend function
cd functions/AutoMateBRDFunction
npm install

# Frontend
cd ../../client
npm install
```

### Run the frontend

```bash
cd client
npm start
```

The React app runs at `http://localhost:3000`. It proxies API calls to the Catalyst local emulator.

### Run the function locally

```bash
# From project root
catalyst serve
```

The local emulator starts on `http://localhost:3001`.

---

## Project Structure

```
AutoMateBRD/
├── catalyst.json                         # Zoho Catalyst project config
├── .env.example                          # Environment variable template
├── client/                               # React frontend
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js                        # Main upload + BRD display component
│       └── index.js
└── functions/
    └── AutoMateBRDFunction/              # Catalyst Advanced Function
        ├── package.json
        ├── index.js                      # HTTP handler / entry point
        ├── brdGenerator.js               # OpenAI GPT-4o BRD generation
        └── zohoWriter.js                 # Zoho Writer document creation
```

---

## API Reference

### `POST /generateBRD`

Generates a BRD from a transcript or video upload.

**Request** (`multipart/form-data` or `application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `transcript` | `string` | Yes* | Plain-text meeting transcript |
| `file` | `File` | Yes* | Video/audio file (mp4, mp3, wav) |
| `title` | `string` | No | Document title (default: `BRD – <timestamp>`) |

*Provide either `transcript` or `file`.

**Response** (`application/json`):

```json
{
  "success": true,
  "documentId": "zoho-writer-document-id",
  "documentUrl": "https://writer.zoho.com/writer/open/<id>",
  "brd": "## Business Requirements Document\n..."
}
```

**Error response**:

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Deployment to Zoho Catalyst

### 1. Login

```bash
catalyst login
```

### 2. Link the project

```bash
catalyst init
```

Select the existing Catalyst project when prompted, or create a new one.

### 3. Set environment variables

In the [Catalyst Console](https://catalyst.zoho.com), navigate to **Functions → AutoMateBRDFunction → Configurations → Environment Variables** and add all variables from `.env.example`.

### 4. Deploy

```bash
catalyst deploy
```

This deploys both the Advanced Function and the React frontend (served as a Catalyst hosting site).

### 5. Verify

After deployment, open the Catalyst Console and check:
- **Functions** → `AutoMateBRDFunction` → Logs for any startup errors.
- **Hosting** → visit the published URL to confirm the frontend loads.

---

## BRD Output Structure

The generated BRD follows this standard template:

1. **Executive Summary**
2. **Project Objectives**
3. **Scope** (In scope / Out of scope)
4. **Stakeholders**
5. **Functional Requirements**
6. **Non-Functional Requirements**
7. **Assumptions & Constraints**
8. **Acceptance Criteria**
9. **Appendix**

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| `401 Unauthorized` from Zoho Writer | Refresh token may be expired — regenerate in API Console |
| `429 Too Many Requests` from OpenAI | Reduce request rate or upgrade OpenAI plan |
| Function timeout | Increase timeout in `catalyst.json` (max 540 s on Catalyst) |
| CORS errors in local dev | Confirm `catalyst serve` is running and proxy is configured in `client/package.json` |

---

## License

MIT
