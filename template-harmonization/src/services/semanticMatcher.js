import { VectorStore } from './vectorStore';

/**
 * SemanticMatcher — Deterministic vector cosine similarity scoring.
 *
 * Replaces AIEngine.scoreSimilarity() and AIEngine.verifySemanticEquivalence().
 * Evaluates the similarity between clause variants purely using their pre-computed
 * embeddings.
 */
export const SemanticMatcher = (() => {

  // Similarity thresholds
  const THRESHOLDS = {
    EXACT_MATCH: 0.95,
    HARMONIZATION_CANDIDATE: 0.88,
    RELATED: 0.75,
    DIFFERENT: 0.00
  };

  /**
   * Evaluates pairwise similarity scores between variants of a specific section group.
   * Pulls pre-computed embeddings from the VectorStore.
   *
   * @param {string} groupName - The canonical group name.
   * @param {Array<{docName: string, content: string}>} variants - Clause texts.
   * @returns {Array<Object>} List of pairwise similarity scores.
   */
  function scoreVariants(groupName, variants) {
    if (variants.length < 2) return [];

    const indexedClauses = VectorStore.getIndex();
    const scores = [];

    for (let x = 0; x < variants.length; x++) {
      for (let y = x + 1; y < variants.length; y++) {
        const docA = variants[x].docName;
        const docB = variants[y].docName;

        // Try to find the exact pre-computed embeddings for this group/doc combo
        // We use a loose heading match because the exact heading might have been normalized
        const cX = indexedClauses.find(c => c.docName === docA && compareHeadings(c.heading, groupName));
        const cY = indexedClauses.find(c => c.docName === docB && compareHeadings(c.heading, groupName));

        let sim = 0.5; // fallback neutral score if embeddings not found
        if (cX && cY && cX.embedding && cY.embedding) {
          sim = VectorStore.cosineSimilarity(cX.embedding, cY.embedding);
        } else {
          // If we can't find embeddings (shouldn't happen in normal flow), fallback to Jaccard
          sim = jaccardFallback(variants[x].content, variants[y].content);
        }

        const pctScore = Math.max(0, Math.min(100, Math.round(sim * 100)));
        const verified = sim >= THRESHOLDS.RELATED;
        
        // Generate a deterministic reason based on the score threshold
        let reason = 'Clauses show moderate semantic similarity.';
        if (sim >= THRESHOLDS.EXACT_MATCH) reason = 'Clauses are nearly identical (≥95% semantic match).';
        else if (sim >= THRESHOLDS.HARMONIZATION_CANDIDATE) reason = 'Clauses are highly similar candidates for harmonization.';
        else if (sim < THRESHOLDS.RELATED) reason = 'Clauses are substantially different.';

        scores.push({
          docA,
          docB,
          score: pctScore,
          verified,
          reason,
          summary: `[Vector Search] ${reason} (Similarity: ${pctScore}%)`
        });
      }
    }
    
    // Sort highest score first
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Loosely compares two headings by removing punctuation and extra spaces.
   */
  function compareHeadings(h1, h2) {
    const norm = (h) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm(h1) === norm(h2);
  }

  /**
   * Fallback lexical similarity if embeddings are entirely missing.
   */
  function jaccardFallback(textA, textB) {
    const wordsOf = t => new Set(
      (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
    );
    const setA = wordsOf(textA);
    const setB = wordsOf(textB);
    const inter = new Set([...setA].filter(w => setB.has(w)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }

  return { scoreVariants, THRESHOLDS };
})();
