/**
 * Messages, cut 8: the SQL seed block for `customer_page_words`, every sentence of ours on the customer's page from
 * `customerPageWordRows()` (`pageWords.ts`), as one upsert that fills a key the table lacks and follows the code for a
 * sentence the office never edited (`edited_at IS NULL`). An edited sentence stays the office's.
 *
 * `scripts/customer-page-words-sql.ts` prints the block or writes it into a migration between the two markers. A
 * change to the customer page's words ships with a new migration holding a fresh block: `customerPageWords.test.ts`
 * reads the newest migration's block and fails when it and the code differ. Never edit a block by hand. Pure.
 */

import { customerPageWordRows } from './pageWords'

export const SEED_BEGIN = '-- customer_page_words seed: begin (written by scripts/customer-page-words-sql.ts; never edit by hand)'
export const SEED_END = '-- customer_page_words seed: end'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

export function customerPageWordsSeed(): string {
  const rows = customerPageWordRows().map((r) => `  (${q(r.key)}, ${q(r.en)}, ${q(r.es)})`)
  return [
    SEED_BEGIN,
    'INSERT INTO public.customer_page_words (key, en, es) VALUES',
    rows.join(',\n'),
    'ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, es = EXCLUDED.es',
    '  WHERE public.customer_page_words.edited_at IS NULL;',
    SEED_END,
  ].join('\n')
}

/** The rows of a seed block, read back from SQL: `('key', 'en', 'es')` tuples with doubled quotes. */
export function seedRowsOf(block: string): { key: string; en: string; es: string }[] {
  const s = "'((?:[^']|'')*)'"
  const tuple = new RegExp(`^\\s*\\(${s}, ${s}, ${s}\\),?$`, 'gm')
  const un = (t: string) => t.replace(/''/g, "'")
  return [...block.matchAll(tuple)].map((m) => ({ key: un(m[1] ?? ''), en: un(m[2] ?? ''), es: un(m[3] ?? '') }))
}

/** The block between the markers in a migration's text, or null when it has none. */
export function seedBlockOf(sql: string): string | null {
  const from = sql.indexOf(SEED_BEGIN)
  const to = sql.indexOf(SEED_END)
  return from >= 0 && to > from ? sql.slice(from, to + SEED_END.length) : null
}
