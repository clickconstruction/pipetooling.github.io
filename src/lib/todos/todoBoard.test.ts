import { describe, it, expect } from 'vitest'
import {
  parseFrontMatter,
  readTodoDoc,
  isParseError,
  isBoardGroup,
  slugForFile,
  sortDocs,
  versionsCited,
  versionNumber,
  indexHref,
  escapeCell,
  jsString,
  toPlainText,
  renderIndexBlock,
  spliceIndex,
  renderBoardItems,
  spliceBoardItems,
  parseStamp,
  writeStamp,
  openItemCount,
  renderViews,
  findDrift,
  renderFrontMatter,
  INDEX_BEGIN,
  INDEX_END,
  type TodoDoc,
  type TodoMeta,
} from './todoBoard'

const META: TodoMeta = {
  name: 'Put a GC on notice',
  group: 'close',
  status: 'built 2026-09-15 · left: the first real run on a TEST GC',
  summary: 'One modal that sends the § 53.056 notice to every owner on every job with a failing GC.',
  next: 'The first real run on a TEST GC, then delete the folder.',
  size: 'XS',
  blocker: 'A live run.',
  ver: 'v2.3469 · 3470',
  pointer: false,
}

const DOC: TodoDoc = { file: 'to-dos/gc-on-notice/README.md', slug: 'gc-on-notice', meta: META }
const POINTER: TodoDoc = {
  file: 'to-dos/owner-decisions-pending.md',
  slug: 'owner-decisions-pending',
  meta: { ...META, name: 'Owner decisions pending', group: 'gated', pointer: true, ver: 'standing' },
}

function fileWith(meta: TodoMeta, body = '# Title\n\nSome prose.\n'): string {
  return `${renderFrontMatter(meta)}\n\n${body}`
}

const README = ['# To-dos', '', 'Preamble stays.', '', INDEX_BEGIN, '', 'old table', '', INDEX_END, '', 'Footer stays.'].join(
  '\n',
)

const BOARD = [
  '<div class="stamp">',
  '  Validated against main <b>2026-09-16</b> at <b>v2.3487</b><br>',
  '  9 open items · picks are shared',
  '</div>',
  '<script>',
  '  const ITEMS = [',
  '    // stale contents',
  '    { slug: "gone", g: "ready", name: "Gone", file: "to-dos/gone.md",',
  '      sum: "x", next: "y", size: "S", blocker: "z", ver: "v2.1" }',
  '  ];',
  '  const after = 1;',
  '</script>',
].join('\n')

describe('parseFrontMatter', () => {
  it('reads flat fields and a > block', () => {
    const fm = parseFrontMatter(['---', 'name: Alpha', 'summary: >', '  one two', '  three', '---', '', '# Title'].join('\n'))
    expect(fm.found).toBe(true)
    expect(fm.fields.name).toBe('Alpha')
    expect(fm.fields.summary).toBe('one two three')
    expect(fm.body).toBe('# Title')
  })

  it('reports no front matter when the file does not open with a fence', () => {
    const fm = parseFrontMatter('# Title\n\nStatus: something')
    expect(fm.found).toBe(false)
    expect(fm.body).toContain('# Title')
  })

  it('reports none when the fence is never closed', () => {
    expect(parseFrontMatter('---\nname: x\n# Title').found).toBe(false)
  })

  it('strips surrounding quotes from a scalar', () => {
    expect(parseFrontMatter('---\nblocker: "None — yet"\n---\n').fields.blocker).toBe('None — yet')
  })

  it('round-trips everything renderFrontMatter writes, long values included', () => {
    const long: TodoMeta = { ...META, summary: `${'a long sentence about the work '.repeat(8)}end.` }
    const parsed = readTodoDoc('to-dos/x.md', fileWith(long))
    expect(isParseError(parsed)).toBe(false)
    if (isParseError(parsed)) return
    expect(parsed.meta.summary).toBe(long.summary.replace(/\s+/g, ' ').trim())
    expect(parsed.meta.name).toBe(long.name)
    expect(parsed.meta.blocker).toBe(long.blocker)
  })

  it('round-trips a scalar the writer had to JSON-quote (an inner quote and a colon)', () => {
    const tricky: TodoMeta = { ...META, name: 'Say "hi": the C:\\ path', blocker: 'none' }
    const parsed = readTodoDoc('to-dos/q.md', fileWith(tricky))
    expect(isParseError(parsed) ? null : parsed.meta.name).toBe(tricky.name)
  })

  it('round-trips a pointer flag', () => {
    const parsed = readTodoDoc('to-dos/p.md', fileWith(POINTER.meta))
    expect(isParseError(parsed) ? null : parsed.meta.pointer).toBe(true)
  })
})

describe('readTodoDoc', () => {
  it('builds a doc with the slug derived from the path', () => {
    const parsed = readTodoDoc('to-dos/gc-on-notice/README.md', fileWith(META))
    expect(isParseError(parsed)).toBe(false)
    if (isParseError(parsed)) return
    expect(parsed.slug).toBe('gc-on-notice')
    expect(parsed.meta.group).toBe('close')
  })

  it('names a file with no front matter', () => {
    const parsed = readTodoDoc('to-dos/x.md', '# Title\n\nStatus: not started\n')
    expect(isParseError(parsed) && parsed.problem).toContain('no front matter')
  })

  it('names every missing required field at once', () => {
    const parsed = readTodoDoc('to-dos/x.md', '---\nname: Alpha\ngroup: ready\n---\n')
    expect(isParseError(parsed) && parsed.problem).toContain('status, summary, next, size, blocker')
  })

  it('rejects a group that is not one of the five', () => {
    const parsed = readTodoDoc('to-dos/x.md', fileWith({ ...META, group: 'urgent' as TodoMeta['group'] }))
    expect(isParseError(parsed) && parsed.problem).toContain('is not one of')
  })

  it('knows the five valid groups', () => {
    expect(isBoardGroup('ready')).toBe(true)
    expect(isBoardGroup('residual')).toBe(true)
    expect(isBoardGroup('nope')).toBe(false)
  })
})

describe('small helpers', () => {
  it('derives slugs from both file shapes', () => {
    expect(slugForFile('to-dos/gc-on-notice/README.md')).toBe('gc-on-notice')
    expect(slugForFile('to-dos/takeoffs-retire-old.md')).toBe('takeoffs-retire-old')
  })
  it('links relative to to-dos/README.md', () => {
    expect(indexHref('to-dos/gc-on-notice/README.md')).toBe('./gc-on-notice/README.md')
  })
  it('escapes a pipe so it cannot split a table cell', () => {
    expect(escapeCell('a | b')).toBe('a \\| b')
    expect(escapeCell('a\nb')).toBe('a b')
  })
  it('escapes quotes and backslashes for a JS literal', () => {
    expect(jsString('a "q" c:\\p')).toBe('a \\"q\\" c:\\\\p')
  })
  it('strips markdown for the HTML board, which cannot render it', () => {
    expect(toPlainText('**Job accounts**: chips on the won row')).toBe('Job accounts: chips on the won row')
    expect(toPlainText('see `code` and [a link](x.md)')).toBe('see code and a link')
    expect(toPlainText('a \\| b')).toBe('a | b')
    expect(toPlainText('the *emphasised* word')).toBe('the emphasised word')
    // A lone asterisk between numbers is multiplication, not emphasis.
    expect(toPlainText('multiply 3 * 4 * 5')).toBe('multiply 3 * 4 * 5')
  })
  it('finds each cited version once', () => {
    expect(versionsCited('v2.3469 · v2.3470 · v2.3469')).toEqual(['v2.3469', 'v2.3470'])
    expect(versionsCited('no versions here')).toEqual([])
  })
  it('orders versions numerically', () => {
    expect(versionNumber('v2.999')).toBeLessThan(versionNumber('v2.1000'))
    expect(versionNumber('nonsense')).toBe(0)
  })
  it('counts open items, excluding pointers', () => {
    expect(openItemCount([DOC, POINTER])).toBe(1)
  })
  it('sorts by group order, then by name', () => {
    const ready: TodoDoc = { ...DOC, slug: 'z', meta: { ...META, group: 'ready', name: 'Zebra' } }
    const alsoClose: TodoDoc = { ...DOC, slug: 'a', meta: { ...META, name: 'Aardvark' } }
    expect(sortDocs([DOC, ready, alsoClose]).map((d) => d.meta.name)).toEqual([
      'Zebra',
      'Aardvark',
      'Put a GC on notice',
    ])
  })
})

describe('the index view', () => {
  it('renders a table per group, with counts and the name as link text', () => {
    const out = renderIndexBlock([DOC, POINTER])
    expect(out).toContain('### Close out (1)')
    expect(out).toContain('### Needs an owner decision (1)')
    expect(out).toContain('[Put a GC on notice](./gc-on-notice/README.md)')
    expect(out).toContain('| To-do | Status | Summary | Next |')
  })

  it('leaves out a group with no rows', () => {
    expect(renderIndexBlock([DOC])).not.toContain('Residuals')
  })

  it('splices between the markers and keeps the prose around them', () => {
    const out = spliceIndex(README, 'NEW BLOCK')
    expect(out).toContain('Preamble stays.')
    expect(out).toContain('Footer stays.')
    expect(out).toContain('NEW BLOCK')
    expect(out).not.toContain('old table')
  })

  it('refuses to splice a README with no markers', () => {
    expect(() => spliceIndex('# no markers', 'x')).toThrow(/markers/)
  })
})

describe('the board view', () => {
  it('renders one entry per doc, grouped, with a pointer flag where set', () => {
    const items = renderBoardItems([DOC, POINTER])
    expect(items).toContain('// Close out')
    expect(items).toContain('{ slug: "gc-on-notice", g: "close", name: "Put a GC on notice"')
    expect(items).toContain('pointer: true')
    expect(items).toContain('blocker: "A live run.", ver: "v2.3469 · 3470" },')
  })

  it('escapes a quote in a summary so the array stays valid JS', () => {
    const quoted: TodoDoc = { ...DOC, meta: { ...META, summary: 'it does a thing "well"' } }
    const items = renderBoardItems([quoted])
    expect(items).toContain('\\"well\\"')
    expect(() => JSON.parse(`[{"x": "${jsString('a "b"')}"}]`)).not.toThrow()
  })

  it('replaces the ITEMS array and leaves the rest of the page alone', () => {
    const out = spliceBoardItems(BOARD, renderBoardItems([DOC]))
    expect(out).toContain('const after = 1;')
    expect(out).toContain('Validated against main')
    expect(out).toContain('gc-on-notice')
    expect(out).not.toContain('slug: "gone"')
    expect(out).toContain('  ];')
  })

  it('throws when the page has no ITEMS array', () => {
    expect(() => spliceBoardItems('<html></html>', 'x')).toThrow(/ITEMS/)
  })
})

describe('the stamp', () => {
  it('round-trips', () => {
    expect(parseStamp(BOARD)).toEqual({ date: '2026-09-16', version: 'v2.3487', openItems: 9 })
    const next = writeStamp(BOARD, { date: '2026-09-20', version: 'v2.3500', openItems: 30 })
    expect(parseStamp(next)).toEqual({ date: '2026-09-20', version: 'v2.3500', openItems: 30 })
  })
  it('is null when the header is missing', () => {
    expect(parseStamp('<div>none</div>')).toBeNull()
  })
})

describe('renderViews', () => {
  const base = { docs: [DOC, POINTER], readme: README, board: BOARD, today: '2026-09-17', newestVersion: 'v2.3500' }

  it('renders both views and stamps the board with the open-item count', () => {
    const out = renderViews(base)
    expect(out.readme).toContain('[Put a GC on notice]')
    expect(out.board).toContain('slug: "gc-on-notice"')
    expect(parseStamp(out.board)).toEqual({ date: '2026-09-17', version: 'v2.3500', openItems: 1 })
  })

  it('is idempotent — rendering its own output changes nothing', () => {
    const once = renderViews(base)
    const twice = renderViews({ ...base, readme: once.readme, board: once.board })
    expect(twice.readme).toBe(once.readme)
    expect(twice.board).toBe(once.board)
  })
})

describe('findDrift', () => {
  const known = new Set(['v2.3469', 'v2.3470'])
  const rendered = renderViews({
    docs: [DOC],
    readme: README,
    board: BOARD,
    today: '2026-09-16',
    newestVersion: 'v2.3487',
  })

  it('is quiet when both views match what the sources render', () => {
    expect(
      findDrift({ docs: [DOC], errors: [], readme: rendered.readme, board: rendered.board, rendered, knownVersions: known }),
    ).toEqual([])
  })

  it('flags a stale index as fixable', () => {
    const f = findDrift({ docs: [DOC], errors: [], readme: README, board: rendered.board, rendered, knownVersions: known })
    const hit = f.find((x) => x.kind === 'index_out_of_date')
    expect(hit?.fixable).toBe(true)
    expect(hit?.severity).toBe('error')
  })

  it('flags a stale board as fixable', () => {
    const f = findDrift({ docs: [DOC], errors: [], readme: rendered.readme, board: BOARD, rendered, knownVersions: known })
    expect(f.find((x) => x.kind === 'board_out_of_date')?.fixable).toBe(true)
  })

  it('passes a front-matter problem through, and does not claim it is fixable', () => {
    const f = findDrift({
      docs: [DOC],
      errors: [{ file: 'to-dos/x.md', problem: 'no front matter.' }],
      readme: rendered.readme,
      board: rendered.board,
      rendered,
      knownVersions: known,
    })
    const hit = f.find((x) => x.kind === 'front_matter')
    expect(hit?.fixable).toBe(false)
    expect(hit?.message).toContain('to-dos/x.md')
  })

  it('flags a version that never shipped — the v2.3478 typo', () => {
    const bad: TodoDoc = { ...DOC, meta: { ...META, ver: 'v2.3478' } }
    const r = renderViews({ docs: [bad], readme: README, board: BOARD, today: '2026-09-16', newestVersion: 'v2.3487' })
    const f = findDrift({ docs: [bad], errors: [], readme: r.readme, board: r.board, rendered: r, knownVersions: known })
    expect(f.find((x) => x.kind === 'unknown_version')?.message).toContain('v2.3478')
  })

  it('flags two to-dos that would collide on one slug', () => {
    const twin: TodoDoc = { ...DOC, file: 'to-dos/gc-on-notice.md' }
    const docs = [DOC, twin]
    const r = renderViews({ docs, readme: README, board: BOARD, today: '2026-09-16', newestVersion: 'v2.3487' })
    const f = findDrift({ docs, errors: [], readme: r.readme, board: r.board, rendered: r, knownVersions: known })
    expect(f.find((x) => x.kind === 'duplicate_slug')?.message).toContain('gc-on-notice')
  })
})
