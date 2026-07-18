export const RuleEngine = (() => {
  /**
   * Evaluates a clause and its extracted metadata against legal compliance rules.
   *
   * @param {string} text - Raw clause text.
   * @param {Object} metadata - Extracted metadata parameters.
   * @returns {Array<Object>} List of compliance results: { ruleName, status: 'pass'|'fail'|'warning', message }.
   */
  function validate(text, metadata = {}) {
    const results = [];
    const lowerText = text.toLowerCase();

    // Rule 1: Limitation of Liability Cap Checks
    if (metadata.clauseType === 'Limitation of Liability' || lowerText.includes('liability')) {
      if (metadata.liabilityCap === 'Unlimited' || lowerText.includes('unlimited liability')) {
        results.push({
          ruleName: 'Liability Cap Restriction',
          status: 'fail',
          message: 'Clause allows unlimited liability. Standard playbook requires a 1x or 2x fees cap.'
        });
      } else if (metadata.liabilityCap === 'N/A' || (!lowerText.includes('cap') && !lowerText.includes('limit'))) {
        results.push({
          ruleName: 'Liability Cap Presence',
          status: 'warning',
          message: 'No clear limitation cap detected. Verify if clause has exposure limitations.'
        });
      } else {
        results.push({
          ruleName: 'Liability Cap Restriction',
          status: 'pass',
          message: `Liability cap standard (${metadata.liabilityCap || 'capped'}) satisfies guidelines.`
        });
      }
    }

    // Rule 2: Indemnity Scope Mutual Checks
    if (metadata.clauseType === 'Indemnity' || lowerText.includes('indemnify') || lowerText.includes('indemnity')) {
      if (metadata.indemnityScope === 'Unilateral' || metadata.indemnityScope === 'Provider' || (lowerText.includes('indemnify') && !lowerText.includes('mutual'))) {
        results.push({
          ruleName: 'Indemnity Reciprocity',
          status: 'warning',
          message: 'Indemnity is unilateral/non-reciprocal. Mutual indemnity is preferred.'
        });
      } else {
        results.push({
          ruleName: 'Indemnity Reciprocity',
          status: 'pass',
          message: 'Indemnity obligations are reciprocal and balanced.'
        });
      }
    }

    // Rule 3: Preferred Governing Law
    if (metadata.clauseType === 'Governing Law' || lowerText.includes('governing law') || lowerText.includes('jurisdiction')) {
      const preferred = ['Delaware', 'New York'];
      const law = metadata.governingLaw || 'N/A';
      if (law !== 'N/A' && !preferred.includes(law)) {
        results.push({
          ruleName: 'Governing Jurisdiction Standard',
          status: 'warning',
          message: `Governing law set to ${law}. Playbook recommends Delaware or New York.`
        });
      } else if (preferred.includes(law)) {
        results.push({
          ruleName: 'Governing Jurisdiction Standard',
          status: 'pass',
          message: `Governing law (${law}) complies with playbook guidelines.`
        });
      }
    }

    return results;
  }

  return { validate };
})();
