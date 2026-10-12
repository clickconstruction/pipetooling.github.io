// The customer page's words in the database follow the code: customer_page_words is seeded from pageWords.ts by the
// newest migration that holds a seed block (scripts/customer-page-words-sql.ts writes it). A word changed in the code
// without a fresh block fails here.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerPageWordsSeed, seedBlockOf, seedRowsOf } from './customerPageWordsSeed'
import { customerPageWordRows, PORTAL_WORD_KEYS } from './pageWords'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')

function newestSeed(): { file: string; rows: ReturnType<typeof seedRowsOf> } {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => seedBlockOf(readFileSync(resolve(MIGRATIONS, f), 'utf8')) !== null)
  const file = files[files.length - 1]
  if (!file) throw new Error('no migration seeds customer_page_words')
  return { file, rows: seedRowsOf(seedBlockOf(readFileSync(resolve(MIGRATIONS, file), 'utf8')) ?? '') }
}

const blanks = (t: string) => [...new Set([...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join()

describe("the customer page's words in the database", () => {
  it('seeds exactly the sentences the code has, in both languages (regenerate the block if this fails)', () => {
    const { file, rows } = newestSeed()
    expect(rows, `${file}: run npx vite-node scripts/customer-page-words-sql.ts -- --write in a new migration`).toEqual(customerPageWordRows())
  })

  it('reads its own block back, quotes and all', () => {
    expect(seedRowsOf(customerPageWordsSeed())).toEqual(customerPageWordRows())
    expect(seedRowsOf("  ('readCopy', 'It''s here', 'Está aquí'),")).toEqual([{ key: 'readCopy', en: "It's here", es: 'Está aquí' }])
  })

  it("holds every sentence to the table's own rules: the key's shape, the length, the same blanks in both languages", () => {
    const wrong = customerPageWordRows().filter(
      (r) =>
        !/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/.test(r.key) ||
        r.en.trim().length < 1 ||
        r.en.trim().length > 400 ||
        r.es.trim().length < 1 ||
        r.es.trim().length > 400 ||
        blanks(r.en) !== blanks(r.es),
    )
    expect(wrong).toEqual([])
  })

  it("leaves out the trade partner's own page, and carries each paper a customer meets", () => {
    const keys = customerPageWordRows().map((r) => r.key)
    expect(keys).not.toContain('pageTitle')
    expect(keys).not.toContain('waiverWhy')
    expect(keys).toContain('nothingToday')
    expect(keys).toContain('paper.contract.button')
    expect(keys).not.toContain('paper.coi.why')
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter((k) => !k.startsWith('paper.')).length).toBe(PORTAL_WORD_KEYS.length - 6)
  })
})
