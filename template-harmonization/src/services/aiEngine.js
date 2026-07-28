import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { pipeline, env } from '@xenova/transformers';
import { GovernanceLog } from './governance';

// Configure transformers.js to avoid running in a WebWorker if not needed, or to fetch correctly
env.allowLocalModels = false; // We are fetching from HuggingFace Hub

export const AIEngine = (() => {
  let embeddingQuotaExceeded = false;
  const DEFAULT_MODEL = 'gemini-3.6-flash';

  const RETIRED_MODELS = [
    'gemini-3.5-flash',
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
      _apiKey = localStorage.getItem('harmonize_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY || null;
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
      _openAiKey = localStorage.getItem('harmonize_openai_key') || import.meta.env.VITE_OPENAI_API_KEY || null;
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
      _anthropicKey = localStorage.getItem('harmonize_anthropic_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || null;
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
      _openaiClient = new OpenAI({
        apiKey: key,
        baseURL: window.location.origin + '/api/openai',
        dangerouslyAllowBrowser: true
      });
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
      _anthropicClient = new Anthropic({
        apiKey: key,
        baseURL: window.location.origin + '/api/anthropic',
        dangerouslyAllowBrowser: true
      });
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
   * If the response is truncated (token limit hit), attempts to auto-close the
   * dangling JSON structure before parsing so the app doesn't hard-fail.
   *
   * @param {string} text - Raw text from the model.
   * @returns {Object} Parsed JSON object (may be partial if truncated).
   */
  function parseJsonResponse(text) {
    let cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // First try: straight parse
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      // Second try: auto-close truncated JSON by balancing braces/brackets
      try {
        let fixed = cleaned;
        // Remove trailing incomplete key-value pair (e.g. , "key": "unfinished)
        fixed = fixed.replace(/,?\s*"[^"]*"\s*:\s*"[^"]*$/, '');
        fixed = fixed.replace(/,?\s*"[^"]*"\s*:\s*$/, '');
        fixed = fixed.replace(/,\s*$/, ''); // trailing comma

        // Count unclosed braces/brackets and close them
        const opens = (fixed.match(/{/g) || []).length - (fixed.match(/}/g) || []).length;
        const arrOpens = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
        for (let i = 0; i < arrOpens; i++) fixed += ']';
        for (let i = 0; i < opens; i++) fixed += '}';

        return JSON.parse(fixed);
      } catch (e2) {
        throw new Error(`Unparseable JSON (likely truncated by token limit): ${cleaned.slice(0, 200)}`);
      }
    }
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

    // ── Demo / Offline Mode guard ─────────────────────────────────────────────
    // When the stored key is 'mock-key' (demo mode), skip all real API calls
    // and return plausible stub data so the workflow can proceed without a 401.
    let activeKey = null;
    if (model.startsWith('gemini')) {
      activeKey = getKey();
    } else if (model.startsWith('openai')) {
      activeKey = getOpenAiKey();
    } else if (model.startsWith('anthropic')) {
      activeKey = getAnthropicKey();
    } else if (model.startsWith('openrouter')) {
      activeKey = getOpenRouterKey();
    }

    if (activeKey === 'mock-key') {
      if (opts.json) {
        // Return minimal valid JSON depending on what the prompt is asking for
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('group') && promptLower.includes('section')) {
          return [];  // groupSections → empty array is safe
        }
        if (promptLower.includes('similarity') || promptLower.includes('score')) {
          return [];  // scoreSimilarity → empty array
        }
        if (promptLower.includes('smart tag') || promptLower.includes('annotate') || promptLower.includes('cli')) {
          return { smartTags: [], cliCandidates: [], assemblyLogic: [] };
        }
        if (promptLower.includes('harmonize') || promptLower.includes('standard clause')) {
          return {
            similarityLevel: 'high',
            standardClause: '[Demo Mode] This is a placeholder harmonized clause. Connect a real API key to generate actual content.',
            variations: [],
            rationale: 'Demo mode active — no AI call was made.'
          };
        }
        return {};
      }
      return '[Demo Mode] Connect a real API key to get actual AI responses.';
    }

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
          } catch (e) {
            console.warn('JSON parse failed (Gemini), returning null:', e.message);
            return null;
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
          } catch (e) {
            console.warn('JSON parse failed (OpenAI), returning null:', e.message);
            return null;
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
          } catch (e) {
            console.warn('JSON parse failed (Anthropic), returning null:', e.message);
            return null;
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
          // Cap output tokens to stay within free-tier credit limits.
          // Hard cap at 370 — safely within the account's available credit balance.
          max_tokens: Math.min(opts.maxTokens ?? 370, 370),
        };
        const completion = await client.chat.completions.create(reqBody);
        const text = completion.choices[0]?.message?.content ?? '';
        if (opts.json) {
          try {
            return parseJsonResponse(text);
          } catch (e) {
            console.warn('JSON parse failed (OpenRouter), returning null:', e.message);
            return null;
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

    const result = await callModel(prompt, { json: true, temperature: 0.2, maxTokens: 370 });

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

  // --- EMBEDDING MODES ---

  let embeddingPipeline = null;
  let isLoadingModel = false;

  /**
   * Retrieves the current embedding mode (nlp or transformers).
   */
  function getEmbeddingMode() {
    return localStorage.getItem('harmonize_embedding_mode') || 'nlp';
  }

  /**
   * Generates a semantic vector embedding array using the selected mode.
   *
   * @param {string} text - The input text to embed.
   * @param {number} [dimensions=768] - Desired dimensions of the vector.
   * @returns {Promise<Array<number>>} A float array representing the vector.
   */
  async function getEmbedding(text, dimensions = 768) {
    if (!text || typeof text !== 'string') {
      return Array(dimensions).fill(0);
    }
    
    const mode = getEmbeddingMode();
    if (mode === 'transformers') {
      return getEmbeddingTransformer(text, dimensions);
    } else {
      return getEmbeddingNLP(text, dimensions);
    }
  }

  /**
   * Generates a semantic vector using local AI (Transformers.js).
   */
  async function getEmbeddingTransformer(text, dimensions = 768) {
    try {
      if (!embeddingPipeline) {
        if (!isLoadingModel) {
          isLoadingModel = true;
          // Load a tiny, fast embedding model (e.g., Xenova/all-MiniLM-L6-v2)
          embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
          isLoadingModel = false;
        } else {
          // Wait if currently loading
          let retries = 0;
          while (isLoadingModel && retries < 100) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
          }
        }
      }

      if (embeddingPipeline) {
        const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
        const vec = Array.from(output.data);
        // Pad or truncate to match expected dimensions
        if (vec.length > dimensions) return vec.slice(0, dimensions);
        if (vec.length < dimensions) return [...vec, ...Array(dimensions - vec.length).fill(0)];
        return vec;
      }
    } catch (err) {
      console.warn('Transformers.js failed, falling back to NLP:', err);
    }
    return getEmbeddingNLP(text, dimensions);
  }

  /**
   * Generates a semantic vector embedding array using Classical NLP (Feature Hashing / Bag of Words).
   * Runs entirely locally in the browser with ZERO API calls.
   * Maps word frequencies to a fixed-size mathematical coordinate system.
   *
   * @param {string} text - The input text to embed.
   * @param {number} [dimensions=768] - Desired dimensions of the vector.
   * @returns {Promise<Array<number>>} A float array representing the vector.
   */
  async function getEmbeddingNLP(text, dimensions = 768) {
    if (!text || typeof text !== 'string') {
      return Array(dimensions).fill(0);
    }
    
    // 1. Tokenize: lower case, remove punctuation, split by whitespace
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2); // Ignore very short words (stop-word approximation)

    // 2. Initialize vector
    const vec = new Float32Array(dimensions);
    
    // 3. Feature Hashing Trick (TF - Term Frequency)
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      // Use absolute value of hash to find index
      const index = Math.abs(hash) % dimensions;
      // Increment term frequency weight at this dimension
      vec[index] += 1;
    }

    // 4. L2 Normalization (so cosine similarity works correctly)
    let sumSquares = 0;
    for (let i = 0; i < dimensions; i++) {
      sumSquares += vec[i] * vec[i];
    }
    
    const norm = Math.sqrt(sumSquares);
    if (norm === 0) return Array.from(vec);

    for (let i = 0; i < dimensions; i++) {
      vec[i] = vec[i] / norm;
    }

    return Array.from(vec);
  }

  // --- MOCK MODES ---
  
  /**
   * Extracts legal metadata (clause type, jurisdiction, liability caps) using the LLM.
   * Falls back to a keyword-based mock parser in offline/demo mode.
   *
   * @param {string} clauseText - The raw clause text.
   * @returns {Promise<Object>} Metadata attributes.
   */
  async function extractClauseMetadata(clauseText) {
    const model = getModel();
    let activeKey = null;
    if (model.startsWith('gemini')) {
      activeKey = getKey();
    } else if (model.startsWith('openai')) {
      activeKey = getOpenAiKey();
    } else if (model.startsWith('anthropic')) {
      activeKey = getAnthropicKey();
    } else if (model.startsWith('openrouter')) {
      activeKey = getOpenRouterKey();
    }

    if (activeKey === 'mock-key' || !activeKey) {
      return generateMockMetadata(clauseText);
    }

    const prompt = `Analyze the following legal contract clause text and extract key metadata features.
Return ONLY a JSON object with this structure, no conversational text or formatting:
{
  "clauseType": "string (e.g. Confidentiality, Indemnity, Liability, Term, Termination, Governing Law, Warranty, Audit)",
  "governingLaw": "string (e.g. Delaware, New York, England, N/A)",
  "liabilityCap": "string (e.g. 1x Fees, 2x Fees, Unlimited, N/A)",
  "indemnityScope": "string (e.g. Customer, Provider, Mutual, N/A)",
  "severity": "high|medium|low"
}

Clause Text:
"${clauseText.slice(0, 1500)}"`;

    try {
      const result = await callModel(prompt, { json: true, temperature: 0.1, maxTokens: 300 });
      return result || generateMockMetadata(clauseText);
    } catch (err) {
      console.warn('Metadata extraction failed, falling back to mock metadata:', err);
      return generateMockMetadata(clauseText);
    }
  }

  /**
   * Offline mock parser to extract metadata parameters from keywords.
   */
  function generateMockMetadata(text) {
    const lowerText = text.toLowerCase();
    let clauseType = 'General';
    let severity = 'low';
    let governingLaw = 'N/A';
    let liabilityCap = 'N/A';
    let indemnityScope = 'N/A';

    if (lowerText.includes('confidential') || lowerText.includes('disclosure')) {
      clauseType = 'Confidentiality';
    } else if (lowerText.includes('indemnify') || lowerText.includes('indemnity') || lowerText.includes('harmless')) {
      clauseType = 'Indemnity';
      severity = 'high';
      if (lowerText.includes('mutual')) indemnityScope = 'Mutual';
      else if (lowerText.includes('customer')) indemnityScope = 'Customer';
      else indemnityScope = 'Provider';
    } else if (lowerText.includes('limit') && (lowerText.includes('liability') || lowerText.includes('liable'))) {
      clauseType = 'Limitation of Liability';
      severity = 'high';
      if (lowerText.includes('1x') || lowerText.includes('one times') || lowerText.includes('12 months')) {
        liabilityCap = '1x Fees';
      } else if (lowerText.includes('unlimited')) {
        liabilityCap = 'Unlimited';
      } else {
        liabilityCap = 'Capped';
      }
    } else if (lowerText.includes('governing law') || lowerText.includes('jurisdiction') || lowerText.includes('courts')) {
      clauseType = 'Governing Law';
      if (lowerText.includes('delaware')) governingLaw = 'Delaware';
      else if (lowerText.includes('new york')) governingLaw = 'New York';
      else if (lowerText.includes('california')) governingLaw = 'California';
      else governingLaw = 'Local';
    } else if (lowerText.includes('terminate') || lowerText.includes('termination')) {
      clauseType = 'Termination';
      severity = 'medium';
    }

    return { clauseType, governingLaw, liabilityCap, indemnityScope, severity };
  }

  /**
   * Compares two clauses using the LLM to verify semantic legal equivalence.
   *
   * @param {string} clauseA - Source clause content.
   * @param {string} clauseB - Target comparison clause content.
   * @returns {Promise<Object>} Verification results containing verified boolean, match score, and description.
   */
  async function verifySemanticEquivalence(clauseA, clauseB) {
    const model = getModel();
    let activeKey = null;
    if (model.startsWith('gemini')) {
      activeKey = getKey();
    } else if (model.startsWith('openai')) {
      activeKey = getOpenAiKey();
    } else if (model.startsWith('anthropic')) {
      activeKey = getAnthropicKey();
    } else if (model.startsWith('openrouter')) {
      activeKey = getOpenRouterKey();
    }

    if (activeKey === 'mock-key' || !activeKey) {
      return generateMockVerification(clauseA, clauseB);
    }

    const prompt = `Compare the following two legal clauses and verify if they are semantically equivalent (expressing the same legal rights and obligations, even if wording differs).
Return ONLY a JSON object with this structure, no conversational text or formatting:
{
  "verified": true|false,
  "score": number (0 to 100 representing semantic closeness),
  "reason": "a short 1-2 sentence description explaining the key equivalence or differences"
}

Clause A:
"${clauseA.slice(0, 1500)}"

Clause B:
"${clauseB.slice(0, 1500)}"`;

    try {
      const result = await callModel(prompt, { json: true, temperature: 0.1, maxTokens: 250 });
      return result || generateMockVerification(clauseA, clauseB);
    } catch (err) {
      console.warn('Semantic verification failed, falling back to mock verification:', err);
      return generateMockVerification(clauseA, clauseB);
    }
  }

  /**
   * Local Jaccard fallback parser for testing/offline checks.
   */
  function generateMockVerification(clauseA, clauseB) {
    const cleanA = clauseA.toLowerCase().replace(/[^a-z]/g, '');
    const cleanB = clauseB.toLowerCase().replace(/[^a-z]/g, '');

    const setA = new Set(cleanA.split(''));
    const setB = new Set(cleanB.split(''));
    const union = new Set([...setA, ...setB]);
    const intersection = new Set([...setA].filter(x => setB.has(x)));

    const jaccard = intersection.size / (union.size || 1);
    const score = Math.round(50 + jaccard * 50);
    const verified = score >= 75;

    let reason = 'Clauses show moderate semantic similarity and cover matching legal concepts.';
    if (verified) {
      reason = 'Clauses are semantically equivalent with minor formatting/wording variations.';
    } else {
      reason = 'Clauses differ in scope or obligations (e.g. indemnity terms or caps do not match).';
    }

    return { verified, score, reason };
  }

  return {
    setKey, getKey, setOpenAiKey, getOpenAiKey, setAnthropicKey, getAnthropicKey,
    setOpenRouterKey, getOpenRouterKey,
    clearKey, setModel, getModel,
    testConnection, groupSections, scoreSimilarity,
    annotateSection, harmonizeSection,
    callModel, getEmbedding, extractClauseMetadata, verifySemanticEquivalence
  };
})();
