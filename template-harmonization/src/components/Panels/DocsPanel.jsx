import React, { useState } from 'react';

/**
 * DocsPanel Component.
 * Full interactive product documentation for the Harmonize by Sirion platform.
 * Covers product overview, 14-step RAG pipeline, step-by-step usage guide,
 * API key setup, vector search concepts, and troubleshooting.
 *
 * @returns {React.ReactElement} The rendered documentation panel.
 */
export default function DocsPanel() {
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const sections = [
    { id: 'overview',   icon: '🏠', label: 'Product Overview' },
    { id: 'pipeline',   icon: '🔄', label: '14-Step Pipeline' },
    { id: 'guide',      icon: '📖', label: 'Step-by-Step Guide' },
    { id: 'api',        icon: '🔑', label: 'API Key Setup' },
    { id: 'vector',     icon: '🧠', label: 'Vector Search & RAG' },
    { id: 'faq',        icon: '💬', label: 'FAQ & Troubleshooting' },
  ];

  const pipelineSteps = [
    { num: 1,  label: 'Upload Documents',       desc: 'Import DOCX/XLSX client contract templates. Multiple files supported.',                     icon: '📁' },
    { num: 2,  label: 'Extract Text',           desc: 'Parse raw text from uploaded documents using mammoth (DOCX) or SheetJS (XLSX).',            icon: '📝' },
    { num: 3,  label: 'Detect Sections',        desc: 'Identify logical clause boundaries via heading detection and regex rules.',                  icon: '🔍' },
    { num: 4,  label: 'Extract Clauses',        desc: 'Decompose each section into individual indexed clauses with unique IDs (CL001…).',          icon: '✂️' },
    { num: 5,  label: 'Generate Metadata',      desc: 'LLM extracts clauseType, governingLaw, liabilityCap, indemnityScope, severity per clause.', icon: '🏷️' },
    { num: 6,  label: 'Chunk Clauses',          desc: 'Long clauses are split into overlapping character-limited chunks for embedding accuracy.',   icon: '🧩' },
    { num: 7,  label: 'Generate Embeddings',    desc: 'Convert clause text to high-dimensional float vectors via Gemini/OpenAI/mock models.',      icon: '📐' },
    { num: 8,  label: 'Store in Vector DB',     desc: 'Index embeddings + metadata locally (VectorStore) and optionally in Supabase pgvector.',    icon: '🗄️' },
    { num: 9,  label: 'Vector Similarity Search', desc: 'Cosine similarity search retrieves the nearest matching clauses across documents.',       icon: '🔎' },
    { num: 10, label: 'Metadata Re-ranking',    desc: 'Boost clause matches by clauseType (+0.15) and governingLaw (+0.10) alignment.',            icon: '📊' },
    { num: 11, label: 'LLM Semantic Verification', desc: 'LLM checks if top-matched clause pairs are legally equivalent beyond surface similarity.', icon: '⚖️' },
    { num: 12, label: 'Rule Engine Validation', desc: 'Playbook rules flag liability cap violations, unilateral indemnity, and non-standard jurisdiction.', icon: '📋' },
    { num: 13, label: 'Merge Recommendation',   desc: 'AI proposes the best-fit standard clause merging matched variants into master language.',   icon: '🤝' },
    { num: 14, label: 'Annotation & Assembly',  desc: 'Smart tags (CLIs, Smart Fields) and final modular contract assembly with export.',          icon: '🏗️' },
  ];

  const guideSteps = [
    {
      step: 'Setup',
      icon: '⚙️',
      color: '#a78bfa',
      title: '1. Configure Your AI Model',
      content: `Before starting, go to the **Setup** panel in the sidebar.

- Enter your **API key** for Gemini, OpenAI, or Anthropic
- Click **"Test & Save"** to verify the connection
- Alternatively, enable **Demo Mode** to use the app with mock responses (no API key required)
- Choose the **Match Engine clustering mode** — "Vector Clustering" (fast, no API cost) or "LLM Context" (more accurate but uses API credits)`,
    },
    {
      step: 'Upload',
      icon: '📁',
      color: '#60a5fa',
      title: '2. Upload Your Contract Templates',
      content: `Navigate to the **Upload Documents** panel.

- Drag-and-drop or browse to select **DOCX** or **XLSX** files
- You can upload **multiple files** simultaneously — the tool compares them against each other
- Supported formats: \`.docx\`, \`.doc\`, \`.xlsx\`, \`.xls\`
- File size limit: typically up to 10 MB per file
- Click **"Extract & Analyze Sections"** to start the pipeline`,
    },
    {
      step: 'Inventory',
      icon: '📋',
      color: '#34d399',
      title: '3. Review the Clause Inventory',
      content: `The **Clause Inventory** panel shows every extracted clause with its unique ID (CL001, CL002…).

- Use the **search bar** to find clauses by keyword
- Enable **Semantic Search** (toggle) to search by meaning using vector similarity
- Each clause chip shows a **similarity match percentage** versus your query
- Review the clause list to confirm proper extraction before proceeding`,
    },
    {
      step: 'Extract',
      icon: '🔍',
      color: '#f59e0b',
      title: '4. Section Harmonization',
      content: `The **Section Harmonization** panel is the core of the tool.

- **Grouped View**: See all matching clause groups with conflict/match badges
  - 🟢 Exact Match (≥90%) · 🟡 Near-Duplicate (50–89%) · 🔴 Conflict Flagged (<50%)
  - ✓ **Verified** — semantically confirmed by LLM
  - ⚖ **Clause Type** — metadata-extracted category (Indemnity, Liability…)
  - Rule compliance flags: ✓ pass / ⚠ warning / ✕ fail
- **Side-by-Side View**: Compare documents column-by-column
- **Documents View**: Full raw document viewer
- Click **"Harmonize Section"** on any group to generate AI-merged standard language`,
    },
    {
      step: 'Annotate',
      icon: '🏷️',
      color: '#f472b6',
      title: '5. Annotation & Assembly',
      content: `The **Annotation** panel adds machine-readable metadata to your harmonized output.

- Add **Smart Tags** (e.g. \`[PARTY_A]\`, \`[NOTICE_PERIOD]\`) to clauses
- Insert **CLIs** (Contract Language Items) for CLM system compatibility
- Review and approve annotated sections
- Bulk-annotate all sections using the AI bulk annotation feature`,
    },
    {
      step: 'Dashboard',
      icon: '📊',
      color: '#38bdf8',
      title: '6. Consolidation Dashboard',
      content: `The **Dashboard** shows KPIs and analytics across all processed clauses.

- View **harmonization progress** across sections
- See **conflict count**, **match rates**, and **approved sections**
- Review the **recommended modular contract structure**
- Use insights to inform negotiation strategies`,
    },
    {
      step: 'Export',
      icon: '📤',
      color: '#a3e635',
      title: '7. Export Your Deliverables',
      content: `The **Export** panel packages your work for delivery.

- Download the **Harmonized Template** as DOCX
- Export the **Clause Inventory** as XLSX (with metadata, IDs, similarity scores)
- Download the **CLM Configuration JSON** for import into Sirion or other CLM systems
- Export the **Governance Audit Log** as JSON for compliance review`,
    },
  ];

  const faqs = [
    {
      q: 'Do I need an API key to use Harmonize?',
      a: 'No — you can click "Enable Demo Mode" on the Setup panel to use the app with simulated AI responses. This works for testing the UI and pipeline flow without spending any API credits.',
    },
    {
      q: 'Which AI models are supported?',
      a: 'Harmonize supports Google Gemini (gemini-3.6-flash), OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, and multiple models via OpenRouter (Gemini, Claude Sonnet 4, GPT-4o, Llama 4 Maverick). Switch between them from the model dropdown in the topbar.',
    },
    {
      q: 'What document formats can I upload?',
      a: 'DOCX (.docx, .doc) and Excel (.xlsx, .xls) files are fully supported. DOCX files are parsed using mammoth.js preserving heading structure. Excel files are parsed with SheetJS and auto-generate clause sections from rows.',
    },
    {
      q: 'What is "Vector Clustering" vs "LLM Context" mode?',
      a: 'Vector Clustering groups and scores clause similarity purely using local cosine similarity between embeddings — it\'s fast, free, and works offline. LLM Context mode sends clause pairs to the LLM API for richer semantic grouping but consumes API credits. You can change this in the Setup panel under "Match Engine".',
    },
    {
      q: 'Where are the vectors stored?',
      a: 'Vectors are stored in-browser via an in-memory VectorStore (lost on page refresh). If you configure a Supabase connection with pgvector enabled, embeddings are also persisted to the database for cross-session reuse via the match_clauses RPC function.',
    },
    {
      q: 'Why do some clauses show ⚠ warnings in the rule flags?',
      a: 'The Rule Engine validates clauses against a standard legal playbook. Warnings appear for: (1) unilateral indemnity obligations, (2) liability capped above standard limits, or (3) governing law set to a non-preferred jurisdiction (outside Delaware/New York). These are advisory — you can override them.',
    },
    {
      q: 'What does "✓ Verified" mean on a section card?',
      a: '"✓ Verified" means the LLM Semantic Verification step (Step 11) confirmed that the matched clause pair is legally equivalent — not just textually similar. It checks that both clauses impose the same legal rights and obligations even if phrased differently.',
    },
    {
      q: 'How do I export the final document?',
      a: 'After harmonizing and approving sections, go to the Export panel (Step 6 in the sidebar). You can download the harmonized DOCX, an XLSX clause inventory, a CLM configuration JSON, and a governance audit log.',
    },
    {
      q: 'The app shows "Parsing failed" for my file — what should I do?',
      a: 'Ensure the file is a valid DOCX or XLSX (not a corrupted or password-protected file). Try re-saving the document in Microsoft Word / Excel before uploading. If the error persists, try uploading one file at a time to isolate the issue.',
    },
    {
      q: 'Can I use this with Supabase for persistent storage?',
      a: 'Yes. Set your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables. Create a `clauses` table with a `vector(768)` embedding column and deploy the `match_clauses` SQL function for pgvector similarity search. See the API Key Setup section for details.',
    },
  ];

  const cardStyle = (color) => ({
    background: `${color}10`,
    border: `1px solid ${color}30`,
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  });

  const badgeStyle = (color) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '10px',
    background: `${color}20`,
    color: color,
    border: `1px solid ${color}40`,
    fontSize: '11px',
    fontWeight: 600,
    marginRight: '6px',
    marginBottom: '4px',
  });

  return (
    <section className="step-panel active" id="panel-docs" style={{ padding: 0, minHeight: '100vh' }}>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

        {/* ── Left nav ── */}
        <nav style={{
          width: '220px',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          padding: '24px 0',
          overflowY: 'auto',
          background: 'var(--bg-sidebar, rgba(255,255,255,0.02))',
        }}>
          <div style={{ padding: '0 16px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Documentation
          </div>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: activeSection === s.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: 'none',
                borderLeft: activeSection === s.id ? '3px solid #a78bfa' : '3px solid transparent',
                color: activeSection === s.id ? '#a78bfa' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeSection === s.id ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Main content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 64px' }}>

          {/* ── OVERVIEW ── */}
          {activeSection === 'overview' && (
            <div>
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px', background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Harmonize by Sirion
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, maxWidth: '680px' }}>
                  An AI-powered contract template harmonization platform. Upload multiple client contract templates and let Harmonize automatically extract, compare, merge, and annotate clauses — producing a single master template ready for CLM import.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {[
                  { icon: '🔍', title: 'Clause Extraction', desc: 'Automatically detect and extract legal clauses from DOCX/XLSX files with unique traceability IDs.' },
                  { icon: '🧠', title: 'Vector Search', desc: 'Embeddings-powered semantic search finds matching clauses across documents even when wording differs.' },
                  { icon: '⚖️', title: 'Rule Engine', desc: 'Playbook validation flags liability, indemnity, and jurisdiction issues before merging.' },
                  { icon: '🤖', title: 'LLM Harmonization', desc: 'AI generates standard master language by merging matching clause variants intelligently.' },
                  { icon: '🏷️', title: 'Smart Annotation', desc: 'Insert CLIs, Smart Fields, and custom tags compatible with Sirion CLM for seamless import.' },
                  { icon: '📤', title: 'Multi-format Export', desc: 'Export harmonized DOCX templates, XLSX inventories, CLM JSON configs, and audit logs.' },
                ].map((feat, i) => (
                  <div key={i} style={cardStyle('#a78bfa')}>
                    <div style={{ fontSize: '28px', marginBottom: '10px' }}>{feat.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>{feat.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feat.desc}</div>
                  </div>
                ))}
              </div>

              <div style={cardStyle('#60a5fa')}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>⚡ Quick Start</h3>
                <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 2, color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <li>Go to <strong>Setup</strong> → Enter your API key (or enable Demo Mode)</li>
                  <li>Go to <strong>Upload Documents</strong> → Import your client contract DOCX/XLSX files</li>
                  <li>Click <strong>"Extract &amp; Analyze Sections"</strong> to run the full 14-step pipeline</li>
                  <li>Review matched clause groups in <strong>Section Harmonization</strong></li>
                  <li>Click <strong>"Harmonize Section"</strong> on each group to generate master language</li>
                  <li>Approve, annotate, and <strong>Export</strong> your deliverables</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── PIPELINE ── */}
          {activeSection === 'pipeline' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>14-Step RAG Pipeline</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>
                Harmonize implements a full Retrieval-Augmented Generation pipeline from raw document upload to annotated master contract assembly.
              </p>

              <div style={{ position: 'relative' }}>
                {pipelineSteps.map((step, i) => (
                  <div key={step.num} style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                    {/* Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px', color: '#fff', flexShrink: 0,
                        boxShadow: '0 0 12px rgba(167,139,250,0.4)',
                      }}>
                        {step.num}
                      </div>
                      {i < pipelineSteps.length - 1 && (
                        <div style={{ width: '2px', flex: 1, minHeight: '24px', background: 'rgba(167,139,250,0.2)', margin: '4px 0' }} />
                      )}
                    </div>
                    {/* Card */}
                    <div style={{
                      flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px', padding: '14px 16px', marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '18px' }}>{step.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{step.label}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GUIDE ── */}
          {activeSection === 'guide' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Step-by-Step Usage Guide</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>
                Follow these steps to complete a full harmonization project from start to finish.
              </p>
              {guideSteps.map((s, i) => (
                <div key={i} style={{ ...cardStyle(s.color), marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '26px' }}>{s.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{s.title}</h3>
                    <span style={badgeStyle(s.color)}>{s.step}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {s.content.split('\n').map((line, li) => {
                      if (line.startsWith('- ')) {
                        return <div key={li} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}><span style={{ color: s.color, marginTop: '2px' }}>•</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>') }} /></div>;
                      }
                      if (line.trim() === '') return <div key={li} style={{ height: '8px' }} />;
                      return <div key={li} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>') }} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── API KEY SETUP ── */}
          {activeSection === 'api' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>API Key Setup</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>
                Harmonize supports multiple AI providers. You only need one key to get started.
              </p>

              {[
                {
                  name: 'Google Gemini (Recommended)',
                  color: '#60a5fa',
                  model: 'gemini-3.6-flash',
                  icon: '✦',
                  steps: [
                    'Visit https://aistudio.google.com/apikey',
                    'Sign in with your Google account',
                    'Click "Create API key" → choose a project',
                    'Copy the key and paste it in Setup → API Key field',
                    'Select "Gemini 3.6 Flash" in the model dropdown',
                  ],
                  limits: 'Free tier: 15 requests/min, 1M tokens/min. Sufficient for most harmonization projects.',
                },
                {
                  name: 'OpenAI GPT-4o',
                  color: '#34d399',
                  model: 'openai-gpt-4o',
                  icon: '⊕',
                  steps: [
                    'Visit https://platform.openai.com/api-keys',
                    'Log in and click "Create new secret key"',
                    'Copy the key (it will only be shown once)',
                    'Paste it in Setup → API Key field',
                    'Select "OpenAI GPT-4o" in the model dropdown',
                  ],
                  limits: 'Paid service. Ensure your account has credits. GPT-4o is billed per token.',
                },
                {
                  name: 'Anthropic Claude',
                  color: '#f472b6',
                  model: 'anthropic-claude-3-5-sonnet-20241022',
                  icon: 'Ⓐ',
                  steps: [
                    'Visit https://console.anthropic.com/account/keys',
                    'Click "Create Key" and give it a name',
                    'Copy the API key',
                    'Paste it in Setup → API Key field',
                    'Select "Anthropic Claude 3.5 Sonnet" in the dropdown',
                  ],
                  limits: 'Paid service with free tier credits for new accounts.',
                },
                {
                  name: 'OpenRouter (Multi-model)',
                  color: '#fbbf24',
                  model: 'openrouter',
                  icon: '⇄',
                  steps: [
                    'Visit https://openrouter.ai/keys',
                    'Create an account and generate an API key',
                    'Paste it in Setup → API Key field',
                    'Select any "OpenRouter" model from the dropdown',
                  ],
                  limits: 'Supports multiple models via a single key. Pay-per-use with some free models available.',
                },
              ].map((provider, i) => (
                <div key={i} style={{ ...cardStyle(provider.color), marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '22px', color: provider.color }}>{provider.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{provider.name}</h3>
                    <code style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>{provider.model}</code>
                  </div>
                  <ol style={{ margin: '0 0 12px', paddingLeft: '18px', lineHeight: 2, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {provider.steps.map((s, si) => <li key={si}>{s}</li>)}
                  </ol>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px' }}>
                    ℹ️ {provider.limits}
                  </div>
                </div>
              ))}

              <div style={{ ...cardStyle('#a78bfa'), marginTop: '8px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '15px' }}>🔧 Supabase Configuration (Optional)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px', lineHeight: 1.7 }}>
                  For persistent vector storage across sessions, configure Supabase with pgvector.
                </p>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)', padding: '14px 16px', borderRadius: '8px',
                  fontSize: '12px', color: '#a78bfa', overflowX: 'auto', lineHeight: 1.7, margin: 0
                }}>
{`# .env (in your project root)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

-- SQL: Create clauses table with pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE clauses (
  id TEXT PRIMARY KEY,
  doc_name TEXT,
  heading TEXT,
  content TEXT,
  embedding vector(768),
  metadata JSONB
);

-- SQL: Similarity search function
CREATE FUNCTION match_clauses(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE(id text, content text, doc_name text, heading text, metadata jsonb, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, content, doc_name, heading, metadata,
         1 - (embedding <=> query_embedding) AS similarity
  FROM clauses
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;`}
                </pre>
              </div>
            </div>
          )}

          {/* ── VECTOR SEARCH ── */}
          {activeSection === 'vector' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Vector Search & RAG</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px', lineHeight: 1.7 }}>
                Harmonize uses a Retrieval-Augmented Generation (RAG) architecture to match clauses based on semantic meaning — not just keyword overlap.
              </p>

              {[
                {
                  title: '🧮 What are Embeddings?',
                  color: '#a78bfa',
                  body: `An **embedding** is a list of hundreds of numbers (a vector) that represents the semantic meaning of a piece of text. Clauses with similar legal meaning will have vectors that point in similar directions in high-dimensional space, even if they use completely different words.

Harmonize generates embeddings using:
- **Gemini text-embedding-004** (768 dimensions) — default
- **OpenAI text-embedding-3-small** (1536 dimensions)
- **Mock deterministic vectors** (seeded by text hash, for demo mode)`,
                },
                {
                  title: '📐 Cosine Similarity',
                  color: '#60a5fa',
                  body: `To compare two clauses, Harmonize computes the **cosine similarity** between their embeddings:

\`similarity = dot(A, B) / (|A| × |B|)\`

A score of **1.0** means identical direction (same meaning), **0.0** means orthogonal (unrelated), and **-1.0** means opposite. In practice, legal clause matches typically score:
- 0.90–1.0 = Exact Match
- 0.50–0.89 = Near-Duplicate
- < 0.50 = Conflict / Unrelated`,
                },
                {
                  title: '📊 Metadata Re-ranking (Step 10)',
                  color: '#34d399',
                  body: `Raw cosine scores are boosted by metadata alignment:

- **+0.15** if matched clauses share the same \`clauseType\` (e.g. both are "Indemnity")
- **+0.10** if matched clauses share the same \`governingLaw\` (e.g. both "Delaware")

Scores are clamped to a maximum of 1.0. This pushes legally-relevant matches higher in the ranking even if raw vector similarity is moderate.`,
                },
                {
                  title: '⚖️ LLM Semantic Verification (Step 11)',
                  color: '#f59e0b',
                  body: `Vector similarity catches surface-level meaning matches, but two clauses can be vectorially close while imposing different legal obligations (e.g. capped vs uncapped liability).

For any match scoring ≥ 50%, Harmonize sends both clauses to the LLM with the prompt:
> *"Are these two clauses legally equivalent — do they express the same rights and obligations?"*

The LLM returns:
- **verified** (boolean) — true if equivalent
- **score** (0–100) — confidence level
- **reason** — a 1-2 sentence explanation

This is displayed as the **✓ Verified** badge on section cards.`,
                },
                {
                  title: '🗄️ In-Memory vs. Supabase pgvector',
                  color: '#f472b6',
                  body: `**In-memory VectorStore** (always active):
- Lives in browser memory, reset on page refresh
- Zero latency, no setup required
- Supports the same cosine search + metadata re-ranking

**Supabase pgvector** (optional, persistent):
- Vectors are uploaded to the \`clauses\` table after indexing
- Subsequent searches call the \`match_clauses\` SQL function
- Persists across sessions and supports team collaboration
- Requires Supabase project with pgvector extension enabled`,
                },
              ].map((card, i) => (
                <div key={i} style={{ ...cardStyle(card.color), marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>{card.title}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    {card.body.split('\n').map((line, li) => {
                      if (line.startsWith('- ') || line.startsWith('- **')) {
                        return <div key={li} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}><span style={{ color: card.color, marginTop: '2px' }}>•</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>') }} /></div>;
                      }
                      if (line.startsWith('> ')) {
                        return <blockquote key={li} style={{ margin: '10px 0', paddingLeft: '14px', borderLeft: `3px solid ${card.color}`, color: 'var(--text-muted)', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: line.slice(2) }} />;
                      }
                      if (line.trim() === '') return <div key={li} style={{ height: '8px' }} />;
                      return <div key={li} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>') }} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FAQ ── */}
          {activeSection === 'faq' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>FAQ & Troubleshooting</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>
                Answers to the most common questions about using Harmonize.
              </p>
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px',
                    marginBottom: '10px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '16px 20px',
                      background: expandedFaq === i ? 'rgba(167,139,250,0.08)' : 'var(--bg-card)',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{
                      fontSize: '18px',
                      color: '#a78bfa',
                      transform: expandedFaq === i ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}>⌄</span>
                  </button>
                  {expandedFaq === i && (
                    <div style={{
                      padding: '0 20px 16px',
                      background: 'rgba(167,139,250,0.04)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.8,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div style={{ paddingTop: '14px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ ...cardStyle('#60a5fa'), marginTop: '28px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>🆘 Still need help?</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  Check the <strong>Governance Log</strong> (exported from the Export panel) for a full audit trail of all pipeline operations and errors.
                  For technical issues, inspect the browser <strong>Console</strong> (F12) — pipeline errors are logged with detailed messages and fallback information.
                </p>
              </div>
            </div>
          )}

        </main>
      </div>
    </section>
  );
}
