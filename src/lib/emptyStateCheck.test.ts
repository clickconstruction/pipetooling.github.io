import { describe, expect, it } from 'vitest'
import { BARE_EMPTY_SENTENCE, bareEmptyOnChangedLines, bareEmptySentences } from './emptyStateCheck'

const tsx = (body: string) => `import { EmptyState } from './EmptyState'\nexport function Page({ q, rows }: { q: string; rows: string[] }) {\n  return (\n${body}\n  )\n}\n`

describe('BARE_EMPTY_SENTENCE', () => {
  it('matches one sentence that opens on No, Nothing, None or Nobody', () => {
    for (const s of ['No bills', 'Nothing here.', 'None yet.', 'Nobody matches.', 'No bids match your search.', 'No sessions awaiting approval']) {
      expect(BARE_EMPTY_SENTENCE.test(s), s).toBe(true)
    }
  })
  it('lets a second sentence, a different first word or a long line through', () => {
    for (const s of ['No bids yet. New Bid adds the first.', 'Not yet.', 'Notes', 'Nobody on Subs yet. New Prospect adds the first company.', `No ${'x'.repeat(90)}.`, 'Loading…']) {
      expect(BARE_EMPTY_SENTENCE.test(s), s).toBe(false)
    }
  })
})

describe('bareEmptySentences', () => {
  it('finds a JSX text child, on its own line, with its whitespace collapsed', () => {
    const found = bareEmptySentences(tsx(`    <div>\n      <p>\n        No bills\n      </p>\n      <p>Nothing\n        here.</p>\n    </div>`), 'Page.tsx')
    expect(found).toEqual([
      { line: 6, text: 'No bills' },
      { line: 8, text: 'Nothing here.' },
    ])
  })

  it('finds a string literal child and every literal branch of a conditional, nested or in parentheses', () => {
    const found = bareEmptySentences(
      tsx(`    <p>{q ? 'No bids match your search.' : rows.length === 0 ? 'No bids yet.' : ('None of these bids is marked.')}</p>`),
      'Page.tsx',
    )
    expect(found.map((f) => f.text)).toEqual(['No bids match your search.', 'No bids yet.', 'None of these bids is marked.'])
    expect(bareEmptySentences(tsx("    <p>{'Nobody matches.'}</p>"), 'Page.tsx')).toEqual([{ line: 4, text: 'Nobody matches.' }])
    expect(bareEmptySentences(tsx('    <p>{`Nothing waiting.`}</p>'), 'Page.tsx')).toHaveLength(1)
  })

  it('leaves alone what sits inside an EmptyState, and a prop string anywhere', () => {
    const inside = tsx(`    <div>\n      <EmptyState main="No bids yet." next={{ label: 'New Bid', to: '/bids' }} />\n      <EmptyState main={q ? 'No bids match.' : 'No bids yet.'}>No bids yet.</EmptyState>\n      <input placeholder="No search text" title="Nothing here" />\n    </div>`)
    expect(bareEmptySentences(inside, 'Page.tsx')).toEqual([])
  })

  it('leaves alone a sentence that names the press, an identifier, a single word, an option and a cell fallback', () => {
    const fine = tsx(
      `    <table>\n      <tbody>\n        <tr>\n          <td>No house</td>\n          <td>{q ? 'No reading yet.' : q}</td>\n        </tr>\n      </tbody>\n    </table>`,
    )
    expect(bareEmptySentences(fine, 'Page.tsx')).toEqual([])
    const more = tsx(`    <div>\n      <p>No bids yet. Click New Bid to add one.</p>\n      <p>{NO_MARKED}</p>\n      <button type="button">No</button>\n      <select><option value="">None</option><option>None of them</option></select>\n    </div>`)
    expect(bareEmptySentences(more, 'Page.tsx')).toEqual([])
  })

  it('reads an empty row that spans the table, the legacy shape', () => {
    const row = tsx(`    <table>\n      <tbody>\n        <tr>\n          <td colSpan={5}>\n            {rows.length === 0 ? 'No sessions in this date range' : 'No sessions for selected people'}\n          </td>\n        </tr>\n      </tbody>\n    </table>`)
    expect(bareEmptySentences(row, 'Page.tsx').map((f) => f.text)).toEqual(['No sessions in this date range', 'No sessions for selected people'])
  })
})

describe('bareEmptyOnChangedLines', () => {
  it('splits the findings by the lines a change wrote', () => {
    const found = [
      { line: 3, text: 'No bills' },
      { line: 9, text: 'Nothing here.' },
    ]
    expect(bareEmptyOnChangedLines(found, new Set([9, 10]))).toEqual({ onChanged: [{ line: 9, text: 'Nothing here.' }], elsewhere: 1 })
  })
})
