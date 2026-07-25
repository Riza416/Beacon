// Helpers for PostgREST ilike search filters. PostgREST's `.or()` syntax uses
// commas and parentheses as structure and `%`/`_` as pattern wildcards, so raw
// user input must be stripped before it's embedded in a filter string.

/** Strip characters that would break out of a PostgREST or() ilike pattern. */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%_\\'"]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * PostgREST `.or()` filter matching `term` against title OR summary.
 * Returns null when the term is empty after sanitizing.
 */
export function titleSummaryOrFilter(raw: string): string | null {
  const term = sanitizeSearchTerm(raw);
  if (term.length === 0) return null;
  return `title.ilike.%${term}%,summary.ilike.%${term}%`;
}

/**
 * Significant words for similarity matching: 4+ chars, deduped, max 4. Used by
 * the duplicate-detection lookup on the new-request form.
 */
export function significantWords(raw: string): string[] {
  const words = sanitizeSearchTerm(raw)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 4);
  return [...new Set(words)].slice(0, 4);
}

/** PostgREST `.or()` filter matching ANY significant word in title/summary. */
export function similarityOrFilter(raw: string): string | null {
  const words = significantWords(raw);
  if (words.length === 0) return null;
  return words
    .flatMap((w) => [`title.ilike.%${w}%`, `summary.ilike.%${w}%`])
    .join(",");
}
