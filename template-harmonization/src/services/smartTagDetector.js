/**
 * SmartTagDetector — Deterministic regex-based SmartTag, CLI candidate, and assembly logic detection.
 *
 * Replaces AIEngine.annotateSection() entirely.
 * Zero LLM calls. Detects placeholder patterns, self-contained reusable clauses, and conditional rules.
 */
export const SmartTagDetector = (() => {

  /**
   * Patterns for detecting existing {{Placeholder}} style SmartTags already in text.
   */
  const EXISTING_TAG_PATTERN = /\{\{([^}]+)\}\}/g;

  /**
   * Inference rules: detect contextual placeholders not yet wrapped in {{}} syntax.
   * Each rule specifies a regex, tag name, and type.
   */
  const INFERRED_TAG_RULES = [
    { pattern: /\b(Customer|Client|Buyer)\b/g,                  tag: '{{Customer_Name}}',       type: 'entity' },
    { pattern: /\b(Vendor|Provider|Supplier|Licensor)\b/g,      tag: '{{Vendor_Name}}',         type: 'entity' },
    { pattern: /\b(Party A|Party B|the Company)\b/g,            tag: '{{Party_Name}}',          type: 'entity' },
    { pattern: /\[DATE\]|\[EFFECTIVE DATE\]|___+\s*,\s*20\d\d/i,tag: '{{Effective_Date}}',      type: 'date' },
    { pattern: /\[NOTICE PERIOD\]/i,                             tag: '{{Notice_Period_Days}}',  type: 'date' },
    { pattern: /\[GOVERNING LAW JURISDICTION\]/i,                tag: '{{Governing_Jurisdiction}}', type: 'location' },
    { pattern: /\[AMOUNT\]|\[FEE\]|\[CONTRACT VALUE\]/i,         tag: '{{Contract_Value}}',      type: 'amount' },
    { pattern: /\[TERRITORY\]|\[REGION\]/i,                      tag: '{{Territory}}',           type: 'location' },
    { pattern: /\[CONTRACT NO\.\]|\[ORDER NO\.\]/i,              tag: '{{Contract_Number}}',     type: 'reference' },
    { pattern: /\[TERM\]|\[INITIAL TERM\]/i,                     tag: '{{Contract_Term}}',       type: 'date' },
    { pattern: /\[RENEWAL TERM\]/i,                              tag: '{{Renewal_Term}}',        type: 'date' },
    { pattern: /\[RENEWAL NOTICE PERIOD\]/i,                     tag: '{{Renewal_Notice_Days}}', type: 'date' },
    { pattern: /\bTBD\b|\bTBC\b|\bT\.B\.D\./gi,                  tag: '{{TBD}}',                 type: 'custom' },
  ];

  /**
   * Clause types that are strong CLI (Clause Library Item) candidates —
   * self-contained, reusable clauses suitable for a clause library.
   */
  const CLI_CANDIDATE_TYPES = [
    'Confidentiality', 'Limitation of Liability', 'Indemnity', 'Governing Law',
    'Force Majeure', 'Dispute Resolution', 'Assignment', 'Notice',
    'Data Protection', 'Warranty', 'SLA / Performance', 'IP Ownership'
  ];

  /**
   * Conditional / assembly logic detection patterns.
   * Each entry matches phrases that imply conditional clause inclusion.
   */
  const ASSEMBLY_LOGIC_PATTERNS = [
    { pattern: /if.*then|where.*applicable|in the event that|subject to/i,    type: 'conditional_inclusion', rule: 'Conditionally include based on trigger condition' },
    { pattern: /unless.*otherwise|except.*as.*provided|notwithstanding/i,     type: 'conditional_inclusion', rule: 'Conditional exception clause' },
    { pattern: /at the option of|may elect to|at.{1,20}sole discretion/i,    type: 'conditional_inclusion', rule: 'Optional clause — depends on party election' },
    { pattern: /as set forth in|as defined in|as specified in/i,              type: 'dependency',            rule: 'Cross-reference dependency — order matters' },
    { pattern: /shall survive.*terminat|survives.*expir/i,                    type: 'ordering',              rule: 'Survival clause — must appear after Termination' },
    { pattern: /pursuant to section|according to clause|per section/i,        type: 'dependency',            rule: 'Section cross-reference dependency' },
  ];

  /**
   * Detects SmartTags, CLI candidates, and assembly logic for a given clause.
   *
   * @param {string} groupName - Canonical section name.
   * @param {Array<{docName: string, content: string}>} variants - Clause text from each document.
   * @param {Array<string>} [knownSmartTags=[]] - Client-defined smart tags to prioritise.
   * @returns {Object} { smartTags, cliCandidates, assemblyLogic }
   */
  function detect(groupName, variants, knownSmartTags = []) {
    const smartTagsMap = new Map(); // deduplicate by tag name
    const cliCandidates = [];
    const assemblyLogicMap = new Map(); // deduplicate by rule

    for (const variant of variants) {
      const text = variant.content || '';

      // ── 1. Detect explicit {{...}} tags already in text ───────────────────
      EXISTING_TAG_PATTERN.lastIndex = 0;
      let m;
      while ((m = EXISTING_TAG_PATTERN.exec(text)) !== null) {
        const tagName = `{{${m[1].trim()}}}`;
        if (!smartTagsMap.has(tagName)) {
          smartTagsMap.set(tagName, {
            tag: tagName,
            type: inferTagType(m[1].trim()),
            context: `Explicit placeholder found in ${variant.docName}`
          });
        }
      }

      // ── 2. Infer implicit tags from common placeholder patterns ────────────
      for (const rule of INFERRED_TAG_RULES) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(text)) {
          if (!smartTagsMap.has(rule.tag)) {
            smartTagsMap.set(rule.tag, {
              tag: rule.tag,
              type: rule.type,
              context: `Inferred from pattern in ${variant.docName}`
            });
          }
        }
      }

      // ── 3. Inject client-defined known smart tags if keyword present ───────
      for (const knownTag of knownSmartTags) {
        const tagLabel = knownTag.replace(/\{\{|\}\}/g, '').trim();
        const lowerText = text.toLowerCase();
        if (tagLabel && lowerText.includes(tagLabel.toLowerCase())) {
          const fullTag = `{{${tagLabel}}}`;
          if (!smartTagsMap.has(fullTag)) {
            smartTagsMap.set(fullTag, {
              tag: fullTag,
              type: 'custom',
              context: `Client-defined tag matched in ${variant.docName}`
            });
          }
        }
      }

      // ── 4. CLI Candidate detection ─────────────────────────────────────────
      const clauseType = detectClauseType(text);
      if (CLI_CANDIDATE_TYPES.includes(clauseType) && text.trim().length > 100) {
        const alreadyAdded = cliCandidates.some(c => c.name === groupName && c.sourceDoc === variant.docName);
        if (!alreadyAdded) {
          cliCandidates.push({
            name: groupName,
            category: clauseType,
            textPreview: text.trim().slice(0, 200),
            sourceDoc: variant.docName
          });
        }
      }

      // ── 5. Assembly logic detection ────────────────────────────────────────
      for (const rule of ASSEMBLY_LOGIC_PATTERNS) {
        if (rule.pattern.test(text)) {
          if (!assemblyLogicMap.has(rule.rule)) {
            assemblyLogicMap.set(rule.rule, {
              rule: rule.rule,
              type: rule.type,
              affectedClause: groupName
            });
          }
        }
      }
    }

    return {
      smartTags: Array.from(smartTagsMap.values()),
      cliCandidates,
      assemblyLogic: Array.from(assemblyLogicMap.values())
    };
  }

  /**
   * Infers a tag type from the placeholder label text.
   *
   * @param {string} label - Raw label inside {{ }}.
   * @returns {string} Tag type.
   */
  function inferTagType(label) {
    const lower = label.toLowerCase();
    if (/date|day|month|year|term|period|expir/.test(lower)) return 'date';
    if (/name|party|company|customer|vendor|entity/.test(lower)) return 'entity';
    if (/amount|fee|price|value|cost|sum/.test(lower))  return 'amount';
    if (/country|state|jurisdiction|territory|region/.test(lower)) return 'location';
    if (/no\.|number|id|ref|order/.test(lower)) return 'reference';
    return 'custom';
  }

  /**
   * Quick clause type detection for CLI candidate classification.
   * Mirrors a lightweight version of MetadataExtractor logic.
   *
   * @param {string} text - Clause text.
   * @returns {string} Clause type label.
   */
  function detectClauseType(text) {
    const lower = text.toLowerCase();
    if (/confidential|non-disclosure|nda/.test(lower))            return 'Confidentiality';
    if (/indemnif|hold harmless/.test(lower))                     return 'Indemnity';
    if (/limit.*liabilit|shall not exceed|in no event/.test(lower)) return 'Limitation of Liability';
    if (/governing law|jurisdiction|choice of law/.test(lower))   return 'Governing Law';
    if (/force majeure|act of god/.test(lower))                   return 'Force Majeure';
    if (/arbitrat|mediati|dispute resolution/.test(lower))        return 'Dispute Resolution';
    if (/assign(?:ment)?|transfer rights|novation/.test(lower))   return 'Assignment';
    if (/personal data|gdpr|data subject/.test(lower))            return 'Data Protection';
    if (/warrant(?:y|ies)|represents and warrants/.test(lower))   return 'Warranty';
    if (/service level|sla|uptime|availability/.test(lower))      return 'SLA / Performance';
    if (/intellectual property|work product|ip rights/.test(lower)) return 'IP Ownership';
    if (/notice shall|written notice|notice period/.test(lower))  return 'Notice';
    return 'General';
  }

  /**
   * Runs annotation across all section groups (batch version).
   * Drop-in replacement for Harmonizer.annotateAll().
   *
   * @param {Array<Object>} sectionGroups - All section groups.
   * @param {Object} [existingAnnotations={}] - Pre-existing annotations to skip.
   * @param {Array<string>} [excelSmartTags=[]] - Client-defined smart tags.
   * @param {function} [onProgress] - Progress callback (current, total, groupName).
   * @returns {Object} Annotations map keyed by groupName.
   */
  function annotateAll(sectionGroups, existingAnnotations = {}, excelSmartTags = [], onProgress) {
    const annotations = { ...existingAnnotations };
    const total = sectionGroups.length;

    for (let i = 0; i < total; i++) {
      const group = sectionGroups[i];
      if (onProgress) onProgress(i + 1, total, group.groupName);

      // Skip already annotated groups without errors
      if (
        annotations[group.groupName] &&
        !annotations[group.groupName].error &&
        (
          annotations[group.groupName].smartTags.length > 0 ||
          annotations[group.groupName].cliCandidates.length > 0 ||
          annotations[group.groupName].assemblyLogic.length > 0
        )
      ) {
        continue;
      }

      try {
        const variants = group.sections.map(s => ({
          docName: s.docName,
          content: s.content,
          comments: s.comments || []
        }));
        const result = detect(group.groupName, variants, excelSmartTags);
        annotations[group.groupName] = result;
      } catch (err) {
        console.error(`SmartTagDetector failed for "${group.groupName}":`, err);
        annotations[group.groupName] = {
          smartTags: [],
          cliCandidates: [],
          assemblyLogic: [],
          error: err.message
        };
      }
    }

    return annotations;
  }

  return { detect, annotateAll, detectClauseType };
})();
