import { GovernanceLog } from './governance';

export const AIEngine = (() => {
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const DEFAULT_MODEL = 'gemini-2.5-flash';

  const RETIRED_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1-5-pro-latest',
    'gemini-1-5-pro',
    'gemini-pro',
    'gemini-1.5-pro-latest'
  ];

  function getModel() {
    const stored = localStorage.getItem('harmonize_gemini_model');
    if (!stored || RETIRED_MODELS.includes(stored)) {
      localStorage.removeItem('harmonize_gemini_model');
      return DEFAULT_MODEL;
    }
    return stored;
  }

  function setModel(model) {
    localStorage.setItem('harmonize_gemini_model', model);
  }

  let _apiKey = null;
  let _openAiKey = null;
  let _anthropicKey = null;

  function setKey(key) {
    _apiKey = key.trim();
    localStorage.setItem('harmonize_gemini_key', _apiKey);
  }

  function setOpenAiKey(key) {
    _openAiKey = key.trim();
    localStorage.setItem('harmonize_openai_key', _openAiKey);
  }

  function setAnthropicKey(key) {
    _anthropicKey = key.trim();
    localStorage.setItem('harmonize_anthropic_key', _anthropicKey);
  }

  function getKey() {
    if (!_apiKey) _apiKey = localStorage.getItem('harmonize_gemini_key') || null;
    return _apiKey;
  }

  function getOpenAiKey() {
    if (!_openAiKey) _openAiKey = localStorage.getItem('harmonize_openai_key') || null;
    return _openAiKey;
  }

  function getAnthropicKey() {
    if (!_anthropicKey) _anthropicKey = localStorage.getItem('harmonize_anthropic_key') || null;
    return _anthropicKey;
  }

  function clearKey() {
    _apiKey = null;
    localStorage.removeItem('harmonize_gemini_key');
  }

  async function callModel(prompt, opts = {}) {
    const model = getModel();
    if (!model) throw new Error('No model selected.');

    if (model.startsWith('gemini')) {
      const key = getKey();
      if (!key) throw new Error('No Gemini API key set. Please enter it in Setup.');
      const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.3,
          maxOutputTokens: opts.maxTokens ?? 8192
        }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (opts.json) {
        try {
          const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          return JSON.parse(cleaned);
        } catch {
          throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
        }
      }
      return text;

    } else if (model.startsWith('openai')) {
      const key = getOpenAiKey();
      if (!key) throw new Error('No OpenAI API key set. Please enter it in Setup.');
      const url = 'https://api.openai.com/v1/chat/completions';
      const body = {
        model: model.replace('openai-', ''),
        messages: [{ role: 'user', content: prompt }],
        temperature: opts.temperature ?? 0.3,
        max_tokens: Math.min(opts.maxTokens ?? 4096, 4096)
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (opts.json) {
        try {
          const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          return JSON.parse(cleaned);
        } catch {
          throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
        }
      }
      return text;

    } else if (model.startsWith('anthropic')) {
      const key = getAnthropicKey();
      if (!key) throw new Error('No Anthropic API key set. Please enter it in Setup.');

      const url = 'https://corsproxy.io/?' + encodeURIComponent('https://api.anthropic.com/v1/messages');
      const body = {
        model: model.replace('anthropic-', ''),
        max_tokens: Math.min(opts.maxTokens ?? 4096, 4096),
        temperature: opts.temperature ?? 0.3,
        system: '',
        messages: [{ role: 'user', content: prompt }]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Anthropic API error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      if (opts.json) {
        try {
          const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          return JSON.parse(cleaned);
        } catch {
          throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
        }
      }
      return text;
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }
  }

  async function testConnection() {
    const result = await callModel('Say "connected" and nothing else.', { maxTokens: 10 });
    return typeof result === 'string' && result.length > 0;
  }

  async function groupSections(docsWithSections) {
    const sectionList = [];
    for (const doc of docsWithSections) {
      for (const sec of doc.sections) {
        sectionList.push({
          docName: doc.name,
          header: sec.header,
          contentPreview: sec.content.slice(0, 400)
        });
      }
    }

    const prompt = `You are a legal contract template analyst working on template harmonization for a CLM (Contract Lifecycle Management) system.

Below is a list of TOP-LEVEL SECTION HEADINGS extracted from ${docsWithSections.length} contract template documents. Group sections from different documents that cover the SAME legal/business topic, even if their heading names differ slightly.

Rules:
1. Only group sections that genuinely cover the same topic.
2. Use a clean, canonical name for each group.
3. Sections unique to one document should remain as a group of 1.
4. Consider the content preview to disambiguate.

Return ONLY a JSON array with this exact structure, no commentary:
[{ "groupName": "canonical section name", "sections": [{ "docName": "exact doc filename", "originalHeader": "exact heading as given" }] }]

Here are all sections:
${JSON.stringify(sectionList, null, 2)}`;

    const groups = await callModel(prompt, { json: true, maxTokens: 8192 });
    return Array.isArray(groups) ? groups : [];
  }

  async function scoreSimilarity(groupName, variants) {
    if (variants.length < 2) return [];

    const prompt = `Compare the following ${variants.length} versions of the "${groupName}" section from different contract template documents.

For each pair of documents, provide a similarity score from 0 to 100:
- 90-100: Nearly identical language
- 70-89: Same intent, moderate wording differences
- 50-69: Same topic, significant differences
- 0-49: Substantially different content

Return ONLY a JSON array with this exact structure, no explanation:
[{ "docA": "filename", "docB": "filename", "score": 85, "summary": "one sentence" }]

Document contents:
${variants.map((v, i) => `--- Document ${i + 1}: ${v.docName} ---\n${v.content.slice(0, 800)}`).join('\n\n')}`;

    const results = await callModel(prompt, { json: true, maxTokens: 4096 });
    return Array.isArray(results) ? results : [];
  }

  async function annotateSection(groupName, variants, knownSmartTags = []) {
    let knownTagsContext = '';
    if (knownSmartTags && knownSmartTags.length > 0) {
      knownTagsContext = `\nHere is a list of client-defined smart tags you MUST prioritize and match: ${JSON.stringify(knownSmartTags)}\n`;
    }

    const prompt = `Analyze the following "${groupName}" section from ${variants.length} contract template document(s).
${knownTagsContext}
Identify:
1. Smart Tags — placeholders using {{Variable_Name}} format
2. CLI Candidates — self-contained reusable clauses
3. Assembly Logic — conditional clause logic

Return ONLY this JSON object:
{ "smartTags": [{ "tag": "{{Tag_Name}}", "type": "entity|date|amount|location|reference|custom", "context": "description" }], "cliCandidates": [{ "name": "CLI name", "category": "category", "textPreview": "first 200 chars", "sourceDoc": "doc name or all" }], "assemblyLogic": [{ "rule": "condition", "type": "conditional_inclusion|ordering|dependency", "affectedClause": "clause name" }] }

Document contents:
${variants.map((v, i) => `=== Document ${i + 1}: ${v.docName} ===\n${v.content.slice(0, 1200)}`).join('\n\n')}`;

    const result = await callModel(prompt, { json: true, temperature: 0.2, maxTokens: 4096 });
    return result || { smartTags: [], cliCandidates: [], assemblyLogic: [] };
  }

  async function harmonizeSection(groupName, variants, annotations = null) {
    const annotationContext = annotations
      ? `\nIdentified smart tags for this section: ${JSON.stringify(annotations.smartTags || [])}\n`
      : '';

    const prompt = `Harmonize these ${variants.length} versions of the "${groupName}" section into a unified output.
${annotationContext}
Instructions:
1. Write ONE "standard clause" — the best, most complete language from all versions. Use {{Variable_Name}} for placeholders.
2. If any version has significantly different language, provide it as a "variation clause".
3. If all versions are very similar (90%+), produce standard clause with no variations.

Return ONLY this JSON object:
{ "similarityLevel": "high|medium|low", "standardClause": "full harmonized text", "variations": [{ "docName": "source doc", "clause": "variation text", "differenceNote": "what differs" }], "rationale": "2-3 sentences explaining decisions" }

${variants.map((v, i) => `=== Version ${i + 1} — ${v.docName} ===\n${v.content.slice(0, 1500)}`).join('\n\n')}`;

    const result = await callModel(prompt, { json: true, temperature: 0.2, maxTokens: 6144 });

    if (!result) {
      return {
        similarityLevel: 'unknown',
        standardClause: variants[0]?.content || 'Could not harmonize this section.',
        variations: [],
        rationale: 'AI harmonization returned empty result.'
      };
    }

    return {
      similarityLevel: result.similarityLevel || 'unknown',
      standardClause: result.standardClause || result.harmonized || '',
      variations: Array.isArray(result.variations) ? result.variations : [],
      rationale: result.rationale || ''
    };
  }

  return {
    setKey, getKey, setOpenAiKey, getOpenAiKey, setAnthropicKey, getAnthropicKey,
    clearKey, setModel, getModel,
    testConnection, groupSections, scoreSimilarity,
    annotateSection, harmonizeSection,
    callModel
  };
})();
