import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GovernanceLog } from './governance';

export const AIEngine = (() => {
  const DEFAULT_MODEL = 'gemini-2.0-flash';

  const RETIRED_MODELS = [
    'gemini-2.5-flash',          // deprecated for new users — use gemini-2.0-flash
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1-5-pro-latest',
    'gemini-1-5-pro',
    'gemini-1.5-pro-latest'
  ];

  /**
   * Retrieves the current selected AI model name from localStorage.
   * Falls back to DEFAULT_MODEL if not set or if the stored model is retired.
   *
   * @returns {string} The active model identifier.
   */
  function getModel() {
    const stored = localStorage.getItem('harmonize_gemini_model');
    if (!stored || RETIRED_MODELS.includes(stored)) {
      localStorage.removeItem('harmonize_gemini_model');
      return DEFAULT_MODEL;
    }
    return stored;
  }

  /**
   * Saves the chosen AI model identifier to localStorage.
   *
   * @param {string} model - The model identifier to use.
   */
  function setModel(model) {
    localStorage.setItem('harmonize_gemini_model', model);
  }

  let _apiKey = null;
  let _openAiKey = null;
  let _anthropicKey = null;
  let _openRouterKey = null;

  // SDK client instances — lazily created and cached per key
  let _geminiClient = null;
  let _openaiClient = null;
  let _anthropicClient = null;
  let _openRouterClient = null;

  /**
   * Sets the Gemini API key in memory and localStorage, invalidating the cached client.
   *
   * @param {string} key - The Gemini API key.
   */
  function setKey(key) {
    _apiKey = key.trim();
    localStorage.setItem('harmonize_gemini_key', _apiKey);
    _geminiClient = null; // reset cached client
  }

  /**
   * Sets the OpenAI API key in memory and localStorage, invalidating the cached client.
   *
   * @param {string} key - The OpenAI API key.
   */
  function setOpenAiKey(key) {
    _openAiKey = key.trim();
    localStorage.setItem('harmonize_openai_key', _openAiKey);
    _openaiClient = null; // reset cached client
  }

  /**
   * Sets the Anthropic API key in memory and localStorage, invalidating the cached client.
   *
   * @param {string} key - The Anthropic API key.
   */
  function setAnthropicKey(key) {
    _anthropicKey = key.trim();
    localStorage.setItem('harmonize_anthropic_key', _anthropicKey);
    _anthropicClient = null; // reset cached client
  }

  /**
   * Sets the OpenRouter API key in memory and localStorage, invalidating the cached client.
   *
   * @param {string} key - The OpenRouter API key.
   */
  function setOpenRouterKey(key) {
    _openRouterKey = key.trim();
    localStorage.setItem('harmonize_openrouter_key', _openRouterKey);
    _openRouterClient = null; // reset cached client
  }

  /**
   * Retrieves the Gemini API key from memory, environment variables, or localStorage.
   *
   * @returns {string|null} The API key if found, otherwise null.
   */
  function getKey() {
    if (!_apiKey) {
      _apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('harmonize_gemini_key') || null;
    }
    return _apiKey;
  }

  /**
   * Retrieves the OpenAI API key from memory, environment variables, or localStorage.
   *
   * @returns {string|null} The API key if found, otherwise null.
   */
  function getOpenAiKey() {
    if (!_openAiKey) {
      _openAiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('harmonize_openai_key') || null;
    }
    return _openAiKey;
  }

  /**
   * Retrieves the Anthropic API key from memory, environment variables, or localStorage.
   *
   * @returns {string|null} The API key if found, otherwise null.
   */
  function getAnthropicKey() {
    if (!_anthropicKey) {
      _anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('harmonize_anthropic_key') || null;
    }
    return _anthropicKey;
  }

  /**
   * Retrieves the OpenRouter API key from memory, environment variables, or localStorage.
   *
   * @returns {string|null} The API key if found, otherwise null.
   */
  function getOpenRouterKey() {
    if (!_openRouterKey) {
      _openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY || localStorage.getItem('harmonize_openrouter_key') || null;
    }
    return _openRouterKey;
  }

  /**
   * Clears the Gemini API key from memory and localStorage.
   */
  function clearKey() {
    _apiKey = null;
    _geminiClient = null;
    localStorage.removeItem('harmonize_gemini_key');
  }

  /**
   * Returns (or lazily creates) the Google GenAI SDK client.
   *
   * @returns {GoogleGenAI} Configured Gemini client.
   */
  function getGeminiClient() {
    const key = getKey();
    if (!key) throw new Error('No Gemini API key set. Please enter it in Setup.');
    if (!_geminiClient) {
      _geminiClient = new GoogleGenAI({ apiKey: key });
    }
    return _geminiClient;
  }

  /**
   * Returns (or lazily creates) the OpenAI SDK client.
   *
   * @returns {OpenAI} Configured OpenAI client.
   */
  function getOpenAIClient() {
    const key = getOpenAiKey();
    if (!key) throw new Error('No OpenAI API key set. Please enter it in Setup.');
    if (!_openaiClient) {
      _openaiClient = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    }
    return _openaiClient;
  }

  /**
   * Returns (or lazily creates) the Anthropic SDK client.
   *
   * @returns {Anthropic} Configured Anthropic client.
   */
  function getAnthropicClient() {
    const key = getAnthropicKey();
    if (!key) throw new Error('No Anthropic API key set. Please enter it in Setup.');
    if (!_anthropicClient) {
      _anthropicClient = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    }
    return _anthropicClient;
  }

  /**
   * Returns (or lazily creates) the OpenRouter SDK client.
   * Uses the OpenAI SDK with a custom baseURL since OpenRouter is OpenAI-compatible.
   *
   * @returns {OpenAI} Configured OpenRouter client.
   */
  function getOpenRouterClient() {
    const key = getOpenRouterKey();
    if (!key) throw new Error('No OpenRouter API key set. Please enter it in Setup.');
    if (!_openRouterClient) {
      _openRouterClient = new OpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Harmonize - Template Harmonizer'
        }
      });
    }
    return _openRouterClient;
  }

  /**
   * Strips markdown code fences from an AI text response and parses it as JSON.
   *
   * @param {string} text - Raw text from the model.
   * @returns {Object} Parsed JSON object.
   */
  function parseJsonResponse(text) {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  }

  /**
   * Unified dispatcher to invoke the selected AI model's SDK.
   * Handles Gemini, OpenAI, and Anthropic via their official SDKs — no raw fetch calls.
   * Automatically parses JSON blocks if configured via options.
   * Retries automatically on rate-limit / quota errors with exponential backoff.
   *
   * @param {string} prompt - The text prompt payload.
   * @param {Object} [opts={}] - Configuration options.
   * @param {number} [opts.temperature] - Temperature control (0.0–1.0).
   * @param {number} [opts.maxTokens] - Limit of output tokens.
   * @param {boolean} [opts.json] - Flag to request clean parsed JSON return format.
   * @param {boolean} [opts.noRetry] - When true, disables automatic retry on rate-limit errors.
   * @returns {Promise<string|Object>} The text response, or a parsed JSON object.
   */
  async function callModel(prompt, opts = {}) {
    const model = getModel();
    if (!model) throw new Error('No model selected.');

    /**
     * Performs the actual SDK call for the active model.
     *
     * @returns {Promise<string|Object>} Parsed or raw response text.
     */
    async function executeRequest() {

      // ── Gemini via @google/genai SDK ──────────────────────────────────────
      if (model.startsWith('gemini')) {
        const client = getGeminiClient();
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxTokens ?? 8192,
          },
        });
        const text = response.text ?? '';
        if (opts.json) {
          try {
            return parseJsonResponse(text);
          } catch {
            throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
          }
        }
        return text;

      // ── OpenAI via openai SDK ─────────────────────────────────────────────
      } else if (model.startsWith('openai')) {
        const client = getOpenAIClient();
        const modelId = model.replace('openai-', '');
        const completion = await client.chat.completions.create({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts.temperature ?? 0.3,
          max_tokens: Math.min(opts.maxTokens ?? 4096, 4096),
        });
        const text = completion.choices[0]?.message?.content ?? '';
        if (opts.json) {
          try {
            return parseJsonResponse(text);
          } catch {
            throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
          }
        }
        return text;

      // ── Anthropic via @anthropic-ai/sdk SDK ───────────────────────────────
      } else if (model.startsWith('anthropic')) {
        const client = getAnthropicClient();
        const modelId = model.replace('anthropic-', '');
        const message = await client.messages.create({
          model: modelId,
          max_tokens: Math.min(opts.maxTokens ?? 4096, 4096),
          temperature: opts.temperature ?? 0.3,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = message.content[0]?.text ?? '';
        if (opts.json) {
          try {
            return parseJsonResponse(text);
          } catch {
            throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
          }
        }
        return text;

      // ── OpenRouter via OpenAI-compatible SDK ──────────────────────────────
      } else if (model.startsWith('openrouter')) {
        const client = getOpenRouterClient();
        const modelId = model.replace('openrouter-', '');
        const reqBody = {
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts.temperature ?? 0.3,
        };
        // Only send max_tokens if explicitly provided — omitting it lets
        // OpenRouter auto-cap based on available credits (avoids 402 errors).
        if (opts.maxTokens) {
          reqBody.max_tokens = opts.maxTokens;
        }
        const completion = await client.chat.completions.create(reqBody);
        const text = completion.choices[0]?.message?.content ?? '';
        if (opts.json) {
          try {
            return parseJsonResponse(text);
          } catch {
            throw new Error(`AI returned invalid JSON: ${text.slice(0, 300)}`);
          }
        }
        return text;

      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
    }

    // Exponential backoff retry loop for rate-limit / quota errors
    const maxRetries = 5;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await executeRequest();
      } catch (err) {
        const msg = err.message?.toLowerCase() ?? '';
        const isRateLimit =
          msg.includes('quota') ||
          msg.includes('429') ||
          msg.includes('rate limit') ||
          msg.includes('limit exceeded') ||
          msg.includes('retry in') ||
          err.status === 429;

        if (isRateLimit && attempt < maxRetries && !opts.noRetry) {
          console.warn(`Rate limit / Quota exceeded on attempt ${attempt}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2.5; // Exponential backoff
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Verifies connectivity by sending a lightweight test query to the selected AI provider.
   *
   * @returns {Promise<boolean>} True if the connection succeeded, false otherwise.
   */
  async function testConnection() {
    const result = await callModel('Say "connected" and nothing else.', { maxTokens: 10, noRetry: true });
    return typeof result === 'string' && result.length > 0;
  }

  /**
   * Groups top-level document headings from multiple contract templates
   * that share a common legal or business topic.
   *
   * @param {Array<Object>} docsWithSections - Document sections payload list.
   * @returns {Promise<Array<Object>>} List of group objects detailing cluster mappings.
   */
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

  /**
   * Compares multiple versions of a section to assign semantic similarity scores between them.
   *
   * @param {string} groupName - Cleaned canonical section title.
   * @param {Array<Object>} variants - Individual text versions of the section.
   * @returns {Promise<Array<Object>>} Pairwise similarity evaluations.
   */
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

  /**
   * Analyzes section content versions to detect placeholders (Smart Tags),
   * standalone clause candidates (CLIs), and assembly/conditional logic rules.
   *
   * @param {string} groupName - The canonical group name.
   * @param {Array<Object>} variants - Individual text versions of the section.
   * @param {Array<string>} [knownSmartTags=[]] - Existing tags context to prioritize.
   * @returns {Promise<Object>} Object containing detected smart tags, CLI candidates, and assembly rules.
   */
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

  /**
   * Merges multiple section versions into a single unified standard clause.
   * Provides variations and notes differences where relevant.
   *
   * @param {string} groupName - Canonical section title.
   * @param {Array<Object>} variants - Text versions of the section.
   * @param {Object} [annotations=null] - Detected variables or placeholders context.
   * @returns {Promise<Object>} Object containing standard clause text, variation options, and rationale.
   */
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
    setOpenRouterKey, getOpenRouterKey,
    clearKey, setModel, getModel,
    testConnection, groupSections, scoreSimilarity,
    annotateSection, harmonizeSection,
    callModel
  };
})();
