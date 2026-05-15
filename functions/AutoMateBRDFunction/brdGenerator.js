'use strict';

const BRD_SYSTEM_PROMPT = `You are a Senior Zoho Implementation Business Analyst with 15+ years of experience implementing the Zoho One suite (Zoho CRM, Zoho Desk, Zoho Books, Zoho People, Zoho Creator, Zoho Analytics, Zoho Campaigns, Zoho Inventory, Zoho Projects, Zoho SalesIQ, Zoho Mail, Zoho Flow, Zoho Cliq, Zoho Forms, Zoho Sign, Zoho Survey, etc.) for enterprise clients. You identify EVERY Zoho product required for the engagement, produce a separate implementation block per product (modules, customizations, workflows, integrations, functional requirements), and design cross-product integration workflows expressed as Mermaid flowcharts. Always return valid JSON only — no markdown, no code fences.`;

const BRD_USER_PROMPT = (transcript, projectDetails, managerInputs) => `
Analyze the following meeting transcript and project details, then generate a comprehensive BRD in JSON.

PROJECT INFORMATION:
- Project Name: ${projectDetails.projectName || 'TBD'}
- Client / Company: ${projectDetails.clientName || 'TBD'}
- Analyst: ${projectDetails.analystName || 'Business Analyst'}
- Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
- Project Description: ${projectDetails.projectDescription || 'N/A'}

MEETING TRANSCRIPT:
${transcript}
${managerInputs ? `
ADDITIONAL MANAGER NOTES / CLARIFICATIONS (treat as authoritative; merge with transcript):
${managerInputs}
` : ''}

Return a JSON object with EXACTLY this structure:
{
  "executiveSummary": "string",
  "projectOverview": {
    "projectName": "string",
    "projectDescription": "string",
    "projectBackground": "string",
    "projectObjectives": ["string"]
  },
  "businessObjectives": [
    { "objective": "string", "priority": "High|Medium|Low", "measurableOutcome": "string" }
  ],
  "stakeholders": [
    { "name": "string", "role": "string", "responsibilities": "string" }
  ],
  "scope": {
    "inScope": ["string"],
    "outOfScope": ["string"],
    "assumptions": ["string"]
  },
  "functionalRequirements": [
    { "id": "FR-001", "category": "string", "requirement": "string", "priority": "High|Medium|Low", "acceptanceCriteria": "string" }
  ],
  "nonFunctionalRequirements": [
    { "id": "NFR-001", "category": "Performance|Security|Scalability|Usability|Reliability|Maintainability", "requirement": "string", "priority": "High|Medium|Low" }
  ],
  "technicalRequirements": [
    { "category": "string", "requirement": "string", "details": "string" }
  ],
  "constraints": ["string"],
  "risks": [
    { "risk": "string", "impact": "High|Medium|Low", "probability": "High|Medium|Low", "mitigation": "string" }
  ],
  "successCriteria": ["string"],
  "zohoProducts": ["Zoho CRM", "Zoho Desk"],
  "productImplementations": [
    {
      "product": "Zoho CRM",
      "objectives": ["string"],
      "modulesUsed": ["Leads", "Deals", "Contacts"],
      "customizations": ["string"],
      "workflows": ["string"],
      "integrations": ["string"],
      "functionalRequirements": [
        { "id": "FR-CRM-001", "requirement": "string", "priority": "High|Medium|Low", "acceptanceCriteria": "string" }
      ]
    }
  ],
  "integrationWorkflow": {
    "description": "string explaining how the Zoho products connect end-to-end",
    "mermaidDiagram": "flowchart TD\n    A[Zoho CRM] --> B[Zoho Desk]\n    B --> C[Zoho Books]"
  },
  "timeline": {
    "estimatedDuration": "string",
    "phases": [
      { "phase": "string", "duration": "string", "deliverables": ["string"] }
    ]
  },
  "approvals": [
    { "role": "string", "name": "" }
  ]
}

Rules:
- Number all functional requirements FR-001, FR-002, etc.
- Number all non-functional requirements NFR-001, NFR-002, etc.
- Be specific and extract every requirement mentioned in the transcript.
- Use professional business language.
- Identify ALL Zoho products needed in "zohoProducts" (e.g., "Zoho CRM", "Zoho Desk", "Zoho Books", "Zoho Creator", "Zoho Analytics", "Zoho Flow").
- For EVERY product in "zohoProducts" produce a corresponding entry in "productImplementations" with product-specific modules, customizations, workflows, integrations, and FR IDs prefixed by product code (FR-CRM-001, FR-DESK-001, FR-BOOKS-001, FR-CREATOR-001, FR-ANALYTICS-001, etc.).
- "integrationWorkflow.mermaidDiagram" MUST be valid Mermaid \`flowchart TD\` syntax (no backticks, no code fences, real newline characters). Use node IDs A,B,C... with labels like A[Zoho CRM]. Show the cross-product data flow described in the transcript.
- If only ONE Zoho product is needed, still produce a single-node Mermaid flowchart.
- Return ONLY valid JSON.
`;

async function generateBRD(transcript, projectDetails, openai, managerInputs = '') {
  const completion = await openai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: BRD_SYSTEM_PROMPT },
      { role: 'user', content: BRD_USER_PROMPT(transcript, projectDetails, managerInputs) }
    ],
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0].message.content;
  return JSON.parse(raw);
}

module.exports = { generateBRD };
