'use strict';

const axios = require('axios');
const FormData = require('form-data');

/**
 * Exchange a Zoho refresh token for a fresh access token.
 */
async function getZohoAccessToken() {
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_URL } = process.env;
  const accountsUrl = ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com/oauth/v2/token';

  const params = new URLSearchParams({
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    refresh_token: ZOHO_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  const response = await axios.post(accountsUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.data.access_token) {
    throw new Error('Zoho token refresh failed: ' + JSON.stringify(response.data));
  }
  return response.data.access_token;
}

/**
 * Convert a structured BRD object to a styled HTML string.
 */
function brdToHTML(brd, projectDetails) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const projectName = projectDetails.projectName || brd.projectOverview?.projectName || 'Project';

  const badge = (level) => {
    const levelLower = (level || '').toLowerCase();
    return `<span class="badge ${levelLower}">${level || ''}</span>`;
  };

  const ul = (items) => `<ul>${(items || []).map(i => `<li>${i}</li>`).join('')}</ul>`;

  const tableRows = (data, fields) =>
    (data || []).map(row =>
      `<tr>${fields.map(f => `<td>${Array.isArray(row[f]) ? ul(row[f]) : (row[f] || '')}</td>`).join('')}</tr>`
    ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BRD – ${projectName}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px 60px; color: #1a1a2e; line-height: 1.6; }
  h1 { color: #226DB4; font-size: 22px; border-bottom: 3px solid #E42527; padding-bottom: 6px; margin-top: 36px; }
  h2 { color: #226DB4; background: #fef2f2; padding: 6px 14px; border-left: 4px solid #E42527; font-size: 16px; }
  h3 { color: #E42527; font-size: 15px; margin-top: 18px; border-bottom: 1px dashed #F9B21D; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px; }
  th { background: #226DB4; color: #fff; padding: 9px 12px; text-align: left; }
  td { padding: 7px 12px; border: 1px solid #dde3ed; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f9ff; }
  ul { margin: 0; padding-left: 18px; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .high { background: #fde8e8; color: #c0392b; }
  .medium { background: #fef9e7; color: #d68910; }
  .low { background: #eafaf1; color: #1e8449; }
  .cover { text-align: center; padding: 80px 0 50px; }
  .cover h1 { font-size: 34px; border: none; color: #226DB4; }
  .cover p { font-size: 16px; color: #555; margin: 6px 0; }
  .product-block { background: #fafbff; border: 1px solid #e3e8f3; border-left: 4px solid #226DB4; padding: 14px 18px; margin: 16px 0; border-radius: 4px; }
  .product-block h3 { margin-top: 0; }
  .product-pill { display: inline-block; background: #E42527; color: #fff; padding: 4px 12px; border-radius: 14px; font-size: 13px; font-weight: 600; margin: 4px 6px 4px 0; }
  .workflow-box { background: #fffdf5; border: 1px solid #F9B21D; padding: 18px; margin: 14px 0; border-radius: 6px; text-align: center; font-family: 'Courier New', monospace; white-space: pre-wrap; font-size: 13px; }
  .footer { text-align: center; color: #aaa; font-size: 12px; margin-top: 60px; border-top: 1px solid #eee; padding-top: 16px; }
</style>
</head>
<body>

<div class="cover">
  <h1>Business Requirements Document</h1>
  <h2 style="background:none;border:none;font-size:22px;color:#E42527;">${projectName}</h2>
  <p><strong>Client:</strong> ${projectDetails.clientName || 'N/A'}</p>
  <p><strong>Prepared By:</strong> ${projectDetails.analystName || projectDetails.requestedBy || 'Business Analyst'}</p>
  <p><strong>Date:</strong> ${date}</p>
  <p><strong>Version:</strong> 1.0 – DRAFT</p>
</div>

<h1>1. Executive Summary</h1>
<p>${brd.executiveSummary || ''}</p>

<h1>2. Project Overview</h1>
<p><strong>Project Name:</strong> ${brd.projectOverview?.projectName || projectName}</p>
<p><strong>Description:</strong> ${brd.projectOverview?.projectDescription || ''}</p>
<p><strong>Background:</strong> ${brd.projectOverview?.projectBackground || ''}</p>
<h2>2.1 Project Objectives</h2>
${ul(brd.projectOverview?.projectObjectives)}

<h1>3. Business Objectives</h1>
<table>
  <tr><th>Objective</th><th>Priority</th><th>Measurable Outcome</th></tr>
  ${(brd.businessObjectives || []).map(o =>
    `<tr><td>${o.objective}</td><td>${badge(o.priority)}</td><td>${o.measurableOutcome || ''}</td></tr>`
  ).join('')}
</table>

<h1>4. Stakeholders</h1>
<table>
  <tr><th>Name</th><th>Role</th><th>Responsibilities</th></tr>
  ${tableRows(brd.stakeholders, ['name', 'role', 'responsibilities'])}
</table>

<h1>5. Scope</h1>
<h2>5.1 In Scope</h2>${ul(brd.scope?.inScope)}
<h2>5.2 Out of Scope</h2>${ul(brd.scope?.outOfScope)}
<h2>5.3 Assumptions</h2>${ul(brd.scope?.assumptions)}

<h1>6. Functional Requirements</h1>
<table>
  <tr><th>ID</th><th>Category</th><th>Requirement</th><th>Priority</th><th>Acceptance Criteria</th></tr>
  ${(brd.functionalRequirements || []).map(r =>
    `<tr><td><strong>${r.id}</strong></td><td>${r.category || ''}</td><td>${r.requirement}</td><td>${badge(r.priority)}</td><td>${r.acceptanceCriteria || ''}</td></tr>`
  ).join('')}
</table>

<h1>7. Non-Functional Requirements</h1>
<table>
  <tr><th>ID</th><th>Category</th><th>Requirement</th><th>Priority</th></tr>
  ${(brd.nonFunctionalRequirements || []).map(r =>
    `<tr><td><strong>${r.id}</strong></td><td>${r.category || ''}</td><td>${r.requirement}</td><td>${badge(r.priority)}</td></tr>`
  ).join('')}
</table>

<h1>8. Technical Requirements</h1>
<table>
  <tr><th>Category</th><th>Requirement</th><th>Details</th></tr>
  ${tableRows(brd.technicalRequirements, ['category', 'requirement', 'details'])}
</table>

<h1>9. Constraints</h1>
${ul(brd.constraints)}

<h1>10. Risk Assessment</h1>
<table>
  <tr><th>Risk</th><th>Impact</th><th>Probability</th><th>Mitigation</th></tr>
  ${(brd.risks || []).map(r =>
    `<tr><td>${r.risk}</td><td>${badge(r.impact)}</td><td>${badge(r.probability)}</td><td>${r.mitigation || ''}</td></tr>`
  ).join('')}
</table>

<h1>11. Success Criteria</h1>
${ul(brd.successCriteria)}

<h1>12. Timeline</h1>
<p><strong>Estimated Duration:</strong> ${brd.timeline?.estimatedDuration || 'TBD'}</p>
<table>
  <tr><th>Phase</th><th>Duration</th><th>Deliverables</th></tr>
  ${(brd.timeline?.phases || []).map(p =>
    `<tr><td>${p.phase}</td><td>${p.duration}</td><td>${ul(p.deliverables)}</td></tr>`
  ).join('')}
</table>

<h1>13. Zoho Products in Scope</h1>
<p>The following Zoho products are involved in this implementation:</p>
<p>${(brd.zohoProducts || []).map(p => `<span class="product-pill">${p}</span>`).join('')}</p>

<h1>14. Product-Wise Implementation</h1>
${(brd.productImplementations || []).map(pi => `
<div class="product-block">
  <h3>${pi.product || ''}</h3>
  <p><strong>Objectives:</strong></p>
  ${ul(pi.objectives)}
  <p><strong>Modules Used:</strong></p>
  ${ul(pi.modulesUsed)}
  <p><strong>Customizations:</strong></p>
  ${ul(pi.customizations)}
  <p><strong>Workflows / Automations:</strong></p>
  ${ul(pi.workflows)}
  <p><strong>Integrations:</strong></p>
  ${ul(pi.integrations)}
  <p><strong>Functional Requirements:</strong></p>
  <table>
    <tr><th>ID</th><th>Requirement</th><th>Priority</th><th>Acceptance Criteria</th></tr>
    ${(pi.functionalRequirements || []).map(r =>
      `<tr><td><strong>${r.id || ''}</strong></td><td>${r.requirement || ''}</td><td>${badge(r.priority)}</td><td>${r.acceptanceCriteria || ''}</td></tr>`
    ).join('')}
  </table>
</div>`).join('')}

<h1>15. Integration Workflow</h1>
<p>${brd.integrationWorkflow?.description || ''}</p>
<div class="mermaid workflow-box">${brd.integrationWorkflow?.mermaidDiagram || ''}</div>

<h1>16. Document Approvals</h1>
<table>
  <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr>
  ${(brd.approvals || []).map(a =>
    `<tr><td>${a.role}</td><td>${a.name || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>`
  ).join('')}
</table>

<div class="footer">
  Generated by Smbs-BRD Generator &nbsp;|&nbsp; ${date} &nbsp;|&nbsp; CONFIDENTIAL
</div>
</body>
</html>`;
}

/**
 * Create a new Zoho Writer document from BRD data.
 * If `editedHtml` is provided (manager-reviewed HTML), it is uploaded as-is;
 * otherwise the HTML is generated from the structured `brd` object.
 * Returns { documentId, documentUrl, documentName }.
 */
async function createZohoWriterDoc(brd, projectDetails, editedHtml) {
  const accessToken = await getZohoAccessToken();
  const htmlContent = (editedHtml && String(editedHtml).trim()) || brdToHTML(brd, projectDetails);
  const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
  const safeName = (projectDetails.projectName || 'Project').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  const docName = `BRD_${safeName}_${Date.now()}`;

  const formData = new FormData();
  formData.append('content', htmlBuffer, {
    filename: `${docName}.html`,
    contentType: 'text/html',
    knownLength: htmlBuffer.length
  });

  const tldMatch = (process.env.ZOHO_ACCOUNTS_URL || '').match(/accounts\.zoho\.([a-z.]+?)(?:\/|$)/);
  const tld = tldMatch ? tldMatch[1] : 'com';
  const writerUrl = process.env.ZOHO_WRITER_API_URL || `https://writer.zoho.${tld}/api/v1`;
  console.log(`[ZohoWriter] Using Writer API: ${writerUrl}`);
  let response;
  try {
    const contentLength = await new Promise((resolve, reject) =>
      formData.getLength((err, len) => (err ? reject(err) : resolve(len)))
    );
    response = await axios.post(`${writerUrl}/documents`, formData, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...formData.getHeaders(),
        'Content-Length': contentLength
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  } catch (err) {
    console.error('[ZohoWriter] POST /documents failed');
    console.error('[ZohoWriter] status:', err.response?.status);
    console.error('[ZohoWriter] data:', JSON.stringify(err.response?.data, null, 2));
    console.error('[ZohoWriter] headers:', JSON.stringify(err.response?.headers, null, 2));
    const apiMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Zoho Writer API error (${err.response?.status || 'no status'}): ${apiMsg}`);
  }

  const docId = response.data?.document_id || response.data?.id || response.data?.data?.document_id;
  if (!docId) {
    throw new Error('Zoho Writer did not return a document_id: ' + JSON.stringify(response.data));
  }

  return {
    documentId: docId,
    documentUrl: `https://writer.zoho.${tld}/writer/open/${docId}`,
    documentName: docName
  };
}

module.exports = { createZohoWriterDoc, getZohoAccessToken, brdToHTML };
