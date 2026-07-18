export const VectorStore = (() => {
  let index = []; // array of { id, text, docName, heading, embedding, metadata }

  /**
   * Adds or updates a clause inside the vector index.
   *
   * @param {Object} clause - Clause entry object.
   * @param {string} clause.id - Clause unique identifier.
   * @param {string} clause.text - Raw text.
   * @param {string} clause.docName - Source document file name.
   * @param {string} clause.heading - Header context.
   * @param {Array<number>} clause.embedding - Float array embedding representation.
   * @param {Object} [clause.metadata={}] - Extra metadata key-values (clauseType, governingLaw, severity).
   */
  function addClause({ id, text, docName, heading, embedding, metadata = {} }) {
    index = index.filter(item => item.id !== id);
    index.push({ id, text, docName, heading, embedding, metadata });
  }

  /**
   * Resets the entire indexed database vector array.
   */
  function clear() {
    index = [];
  }

  /**
   * Returns total clauses count currently indexed.
   *
   * @returns {number} Clause count.
   */
  function getCount() {
    return index.length;
  }

  /**
   * Returns a copy of the active vector index array.
   *
   * @returns {Array<Object>} Clauses index.
   */
  function getIndex() {
    return [...index];
  }

  /**
   * Computes the cosine similarity metric between two float vectors.
   *
   * @param {Array<number>} vecA - First vector.
   * @param {Array<number>} vecB - Second vector.
   * @returns {number} Score between -1 and 1.
   */
  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Queries the database using an embedding vector and optionally re-ranks matches based on metadata criteria.
   * (Step 10: Metadata Re-ranking)
   *
   * @param {Array<number>} queryEmbedding - Search input vector.
   * @param {number} [threshold=0.4] - Min similarity threshold.
   * @param {number} [limit=20] - Max matches to return.
   * @param {Object} [boostCriteria={}] - Metadata matching criteria to boost ranking scores.
   * @param {string} [boostCriteria.clauseType] - Target clause type category.
   * @param {string} [boostCriteria.governingLaw] - Target governing law standard.
   * @returns {Array<Object>} Search matches sorted by boosted similarity score descending.
   */
  function search(queryEmbedding, threshold = 0.4, limit = 20, boostCriteria = {}) {
    if (!queryEmbedding || index.length === 0) return [];

    return index
      .map(item => {
        const rawScore = cosineSimilarity(queryEmbedding, item.embedding);
        let boostedScore = rawScore;

        // Apply metadata boosts (Max boost up to +0.25)
        if (boostCriteria && item.metadata) {
          // 1. Boost matching clauseType category (+0.15)
          if (boostCriteria.clauseType && item.metadata.clauseType === boostCriteria.clauseType) {
            boostedScore += 0.15;
          }
          // 2. Boost matching governingLaw (+0.10)
          if (boostCriteria.governingLaw && item.metadata.governingLaw === boostCriteria.governingLaw) {
            boostedScore += 0.10;
          }
          // Clamp score to 1.0 maximum
          if (boostedScore > 1.0) boostedScore = 1.0;
        }

        return {
          id: item.id,
          text: item.text,
          docName: item.docName,
          heading: item.heading,
          metadata: item.metadata,
          rawScore: rawScore,
          similarityScore: boostedScore
        };
      })
      .filter(item => item.similarityScore >= threshold)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  return {
    addClause,
    clear,
    getCount,
    getIndex,
    cosineSimilarity,
    search
  };
})();
