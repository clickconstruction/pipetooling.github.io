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
  toPlainText,
  openItemCount,
  renderBoardData,
  renderBoardModule,
  parseBoardModule,
  parseBoardValidated,
  findTodoProblems,
  renderFrontMatter,
  mockupState,
  parseMockupField,
  mockupsFor,
  artifactsCited,
  mockupLabel,
  dirForFile,
  parseOpinion,
  assignedNumbersInFragment,
  assignedNumbersInGitLog,
  nextTodoNumber,
  type TodoDoc,
  type TodoMeta,
} from './todoBoard'

const META: TodoMeta = {
  name: 'Put a GC on notice',
  number: 16,
  group: 'close',
  status: 'built 2026-09-15 · left: the first real run on a TEST GC',
  summary: 'One modal that sends the § 53.056 notice to every owner on every job with a failing GC.',
  next: 'The first real run on a TEST GC, then delete the folder.',
  size: 'XS',
  blocker: 'A live run.',
  ver: 'v2.3469 · 3470',
  opinion: '',
  pointer: false,
  mockupNotRequired: '',
}

const DOC: TodoDoc = {
  file: 'to-dos/gc-on-notice/README.md',
  slug: 'gc-on-notice',
  meta: META,
  mockups: ['to-dos/gc-on-notice/mockup.html'],
  artifacts: [{ label: 'the leader\'s card', url: 'https://claude.ai/artifact/AbC123' }],
}
const POINTER: TodoDoc = {
  file: 'to-dos/owner-decisions-pending.md',
  slug: 'owner-decisions-pending',
  meta: { ...META, name: 'Owner decisions pending', number: 5, group: 'gated', pointer: true, ver: 'standing' },
  mockups: [],
  artifacts: [],
}

function fileWith(meta: TodoMeta, body = '# Title\n\nSome prose.\n'): string {
  return `${renderFrontMatter(meta)}\n\n${body}`
}


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
    expect(isParseError(parsed) && parsed.problem).toContain('number, status, summary, next, size, blocker')
  })

  it('reads the number and refuses one that is not a whole number from 1 up', () => {
    const ok = readTodoDoc('to-dos/x.md', fileWith(META))
    expect(!isParseError(ok) && ok.meta.number).toBe(16)
    for (const bad of ['0', '1.5', '#16', 'sixteen']) {
      const parsed = readTodoDoc('to-dos/x.md', fileWith(META).replace('number: 16', `number: ${bad}`))
      expect(isParseError(parsed) && parsed.problem).toContain('not a whole number')
    }
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

describe('the number a to-do carries', () => {
  it('the next free number is one past the highest in use, never a refill', () => {
    expect(nextTodoNumber([])).toBe(1)
    expect(nextTodoNumber([DOC, { ...DOC, meta: { ...META, number: 3 } }])).toBe(17)
  })
  it('a retired top number is not refilled: the numbers the repo remembers count too', () => {
    // #41 was deleted from the folder in v2.3797; the folder's max is 40 but 41 was given out.
    expect(nextTodoNumber([{ meta: { ...META, number: 40 } }], [41, 12])).toBe(42)
    expect(nextTodoNumber([{ meta: { ...META, number: 40 } }], [39])).toBe(41)
    expect(nextTodoNumber([], [NaN, 2.5, 7])).toBe(8)
  })
  it('a fragment cites punch-list numbers, never PR or journey-map numbers', () => {
    const text = [
      'Punch list **#41**, PR 3 of 3 (PR 1 v2.3787).',
      '(punch list #34, retired) and the to-do #27 line; the to-do is PR #3448.',
      'Journey-map Tier-2 #41 (J30-1); Punch-list #9 was the pay-run view.',
    ].join('\n')
    expect(assignedNumbersInFragment(text)).toEqual([41, 34, 27, 9])
  })
  it('git history yields every number: line a to-do ever carried', () => {
    const patch = ['+number: 41', '-number: 23   # the handle', '+number:16', ' number: 5', '+numbers: 99', '+number: 3448'].join('\n')
    expect(assignedNumbersInGitLog(patch)).toEqual([41, 23, 16])
  })
  it('two to-dos with one number is an error that names both and the next free one', () => {
    const twin: TodoDoc = { ...DOC, file: 'to-dos/x.md', slug: 'x', meta: { ...META, name: 'X' } }
    const f = findTodoProblems({ docs: [DOC, twin], errors: [], knownVersions: new Set(['v2.3469', 'v2.3470']) })
    const dup = f.find((x) => x.kind === 'duplicate_number')
    expect(dup?.severity).toBe('error')
    expect(dup?.message).toContain('#16')
    expect(dup?.message).toContain('gc-on-notice')
    expect(dup?.message).toContain('#17')
  })
  it('round-trips through the front matter', () => {
    expect(renderFrontMatter(META)).toContain('\nnumber: 16\n')
    const back = readTodoDoc('to-dos/x.md', fileWith(META))
    expect(!isParseError(back) && back.meta.number).toBe(16)
  })
})

describe('the links a to-do carries', () => {
  const folder = [
    'to-dos/submittals/README.md',
    'to-dos/submittals/mockup.html',
    'to-dos/submittals/before-after-5b.html',
    'to-dos/submittals/notes.md',
  ]
  const top = [
    'to-dos/README.md',
    'to-dos/punch-list.html',
    'to-dos/job-summary-follow-ups.md',
    'to-dos/job-summary-follow-ups-earned-revenue.html',
    'to-dos/job-summary.html',
  ]

  it('a folder to-do owns every .html in its folder, sorted', () => {
    expect(mockupsFor('to-dos/submittals/README.md', folder)).toEqual([
      'to-dos/submittals/before-after-5b.html',
      'to-dos/submittals/mockup.html',
    ])
  })

  it('a flat to-do owns only the top-level pages named after it — never the board', () => {
    expect(mockupsFor('to-dos/job-summary-follow-ups.md', top)).toEqual([
      'to-dos/job-summary-follow-ups-earned-revenue.html',
    ])
    expect(mockupsFor('to-dos/next-up.md', top)).toEqual([])
  })

  it('labels a mock-up by its file, minus the to-do it belongs to', () => {
    const sub = { file: 'to-dos/submittals/README.md', slug: 'submittals' }
    expect(mockupLabel(sub, 'to-dos/submittals/mockup.html')).toBe('mockup')
    expect(mockupLabel(sub, 'to-dos/submittals/before-after-5b.html')).toBe('before-after-5b')
    const flat = { file: 'to-dos/job-summary-follow-ups.md', slug: 'job-summary-follow-ups' }
    expect(mockupLabel(flat, 'to-dos/job-summary-follow-ups-earned-revenue.html')).toBe('earned-revenue')
    expect(mockupLabel(flat, 'to-dos/job-summary-follow-ups.html')).toBe('mock-up')
  })

  it('reads the artifacts the prose links, a labelled link first, each URL once', () => {
    const body = [
      'Mock-up: [the leader card](https://claude.ai/artifact/AbC123) and the plain one',
      'https://claude.ai/code/artifact/0e926513-62bf-422b-9234-a1b8d94f9beb.',
      'Again: https://claude.ai/artifact/AbC123 — same page, not a second link.',
    ].join('\n')
    expect(artifactsCited(body)).toEqual([
      { label: 'the leader card', url: 'https://claude.ai/artifact/AbC123' },
      { label: 'artifact 2', url: 'https://claude.ai/code/artifact/0e926513-62bf-422b-9234-a1b8d94f9beb' },
    ])
    expect(artifactsCited('no links here')).toEqual([])
  })

  it('labels a bare URL from its line: the italic title, or the design canvas', () => {
    const body = [
      'Artifact: *Office Days* — https://claude.ai/artifact/6hhWGCLhYZWGNQLbPyj5f2 (Version 2).',
      '**Before / after** (also on the design canvas https://claude.ai/artifact/JHb3f7Tr7LVPfjMg6sdNLf): x',
      '`Step Three, Redrawn` — https://claude.ai/code/artifact/9c72e792-f8ea-43c9-8b92-6afca365c376 (map).',
      'A *title* far back, then forty words of prose about the form and its tiles and math. Mock-up: <https://claude.ai/artifact/A8LFiqPAd6jmpbvLSeEdbx>',
    ].join('\n')
    expect(artifactsCited(body).map((a) => a.label)).toEqual([
      'Office Days',
      'design canvas',
      'Step Three, Redrawn',
      'mock-up',
    ])
  })

  it('numbers two different pages that share one label on a to-do', () => {
    const body = [
      'also on the design canvas https://claude.ai/artifact/2tUmSFQPqNaedEhQbeJVaX',
      'also on the design canvas https://claude.ai/artifact/JHb3f7Tr7LVPfjMg6sdNLf',
    ].join('\n')
    expect(artifactsCited(body).map((a) => a.label)).toEqual(['design canvas 1', 'design canvas 2'])
  })

  it('readTodoDoc derives both from the file and its siblings', () => {
    const body = '# Title\n\nSee [the card](https://claude.ai/artifact/AbC123).\n'
    const parsed = readTodoDoc('to-dos/submittals/README.md', fileWith(META, body), folder)
    if (isParseError(parsed)) throw new Error(parsed.problem)
    expect(parsed.mockups).toEqual(['to-dos/submittals/before-after-5b.html', 'to-dos/submittals/mockup.html'])
    expect(parsed.artifacts).toEqual([{ label: 'the card', url: 'https://claude.ai/artifact/AbC123' }])
  })


  it('reads the mockup field: "not required — why" is the reason, anything else means a mock-up is expected', () => {
    expect(parseMockupField(undefined)).toBe('')
    expect(parseMockupField('not required — a live test, no screen changes')).toBe('a live test, no screen changes')
    expect(parseMockupField('Not required: a refactor')).toBe('a refactor')
    expect(parseMockupField('not required')).toBe('not required')
    expect(parseMockupField('coming Friday')).toBe('')
  })

  it('a to-do has a mock-up, waits for one, or needs none (pointers never wait)', () => {
    expect(mockupState(DOC)).toBe('has')
    expect(mockupState({ ...DOC, mockups: [] })).toBe('waiting')
    expect(mockupState({ ...DOC, mockups: [], meta: { ...META, mockupNotRequired: 'a live test' } })).toBe('not-required')
    expect(mockupState(POINTER)).toBe('not-required')
  })


  it('the front matter round-trips the mockup field', () => {
    const fm = parseFrontMatter(renderFrontMatter({ ...META, mockupNotRequired: 'a live test' }))
    expect(fm.fields.mockup).toBe('not required — a live test')
    expect(parseMockupField(fm.fields.mockup)).toBe('a live test')
  })

  it('knows a to-do\'s directory for both file shapes', () => {
    expect(dirForFile('to-dos/gc-on-notice/README.md')).toBe('to-dos/gc-on-notice')
    expect(dirForFile('to-dos/foo.md')).toBe('to-dos')
  })
})

describe('the board data', () => {
  it('renders one row per doc, grouped, plain text, with the links carried through', () => {
    const data = renderBoardData([POINTER, DOC], { date: '2026-09-17', version: 'v2.3500' })
    expect(data.validated).toEqual({ date: '2026-09-17', version: 'v2.3500' })
    expect(data.openItems).toBe(1)
    // sorted: close before gated
    expect(data.items.map((i) => i.slug)).toEqual(['gc-on-notice', 'owner-decisions-pending'])
    const row = data.items[0]!
    expect(row).toMatchObject({
      group: 'close',
      name: 'Put a GC on notice',
      file: 'to-dos/gc-on-notice/README.md',
      pointer: false,
      ver: 'v2.3469 · 3470',
      mockups: ['to-dos/gc-on-notice/mockup.html'],
      artifacts: [{ label: "the leader's card", url: 'https://claude.ai/artifact/AbC123' }],
      mockup: 'has',
      mockupNote: '',
    })
    expect(data.items[1]!.pointer).toBe(true)
    expect(data.items[1]!.mockup).toBe('not-required')
  })

  it('strips markdown for the page, which renders strings', () => {
    const md: TodoDoc = { ...DOC, meta: { ...META, summary: '**bold** and `code` and [a link](./x)' } }
    expect(renderBoardData([md], { date: 'd', version: 'v' }).items[0]!.summary).toBe('bold and code and a link')
  })

  it('writes a typed module that reads back, and reads the stamp off it', () => {
    const text = renderBoardModule(renderBoardData([DOC], { date: '2026-09-17', version: 'v2.3500' }))
    expect(text.startsWith('// virtual:punch-list')).toBe(true)
    expect(text).toContain('\nconst data = {')
    expect(text.endsWith('\nexport default data\n')).toBe(true)
    expect(parseBoardModule(text)?.items).toHaveLength(1)
    expect(parseBoardValidated(text)).toEqual({ date: '2026-09-17', version: 'v2.3500' })
  })

  it('reads no stamp off a file that is not there yet, or not the module', () => {
    expect(parseBoardValidated('')).toBeNull()
    expect(parseBoardValidated('<html></html>')).toBeNull()
    expect(parseBoardModule('{"items": []}')).toBeNull()
  })
})

describe('findTodoProblems', () => {
  const known = new Set(['v2.3469', 'v2.3470'])

  it('is quiet when every to-do parses, cites shipped versions and has its own slug', () => {
    expect(findTodoProblems({ docs: [DOC, POINTER], errors: [], knownVersions: known })).toEqual([])
  })

  it('passes a front-matter problem through', () => {
    const f = findTodoProblems({ docs: [DOC], errors: [{ file: 'to-dos/x.md', problem: 'no front matter.' }], knownVersions: known })
    const hit = f.find((x) => x.kind === 'front_matter')
    expect(hit?.severity).toBe('error')
    expect(hit?.message).toContain('to-dos/x.md')
  })

  it('flags a version that never shipped — the v2.3478 typo', () => {
    const bad: TodoDoc = { ...DOC, meta: { ...META, ver: 'v2.3478' } }
    const f = findTodoProblems({ docs: [bad], errors: [], knownVersions: known })
    expect(f.find((x) => x.kind === 'unknown_version')?.message).toContain('v2.3478')
  })

  it('flags two to-dos that would collide on one slug', () => {
    const twin: TodoDoc = { ...DOC, file: 'to-dos/gc-on-notice.md' }
    const f = findTodoProblems({ docs: [DOC, twin], errors: [], knownVersions: known })
    expect(f.find((x) => x.kind === 'duplicate_slug')?.message).toContain('gc-on-notice')
  })
})

describe('parseOpinion', () => {
  it('splits the verdict from the sentence, case-insensitively, on an em dash or a hyphen', () => {
    expect(parseOpinion('build — one script PR ends it')).toEqual({ verdict: 'build', note: 'one script PR ends it' })
    expect(parseOpinion('Your call - the attorney owns the wording')).toEqual({ verdict: 'your call', note: 'the attorney owns the wording' })
    expect(parseOpinion('DROP')).toEqual({ verdict: 'drop', note: '' })
  })

  it('keeps a parenthetical after the verdict as the head of the note', () => {
    expect(parseOpinion('build (PR 3) — the portal trace can wait')).toEqual({ verdict: 'build', note: '(PR 3) the portal trace can wait' })
  })

  it('an opinion with no verdict word is all note; an empty one is null', () => {
    expect(parseOpinion('worth a look when the Bids surface is quiet')).toEqual({ verdict: null, note: 'worth a look when the Bids surface is quiet' })
    expect(parseOpinion('   ')).toBeNull()
    expect(parseOpinion(undefined)).toBeNull()
    expect(parseOpinion(null)).toBeNull()
  })

  it('rides through the front matter round trip and onto the board row', () => {
    const md = ['---', 'name: X', 'number: 30', 'group: ready', 'status: s', 'summary: sum', 'next: n', 'size: S', 'blocker: None.', 'ver: —', 'opinion: later — nothing is wrong today', '---', ''].join('\n')
    const doc = readTodoDoc('to-dos/x.md', md)
    if (isParseError(doc)) throw new Error(doc.problem)
    expect(doc.meta.opinion).toBe('later — nothing is wrong today')
    expect(renderFrontMatter(doc.meta)).toContain('opinion: later — nothing is wrong today')
    expect(renderBoardData([doc], { date: '2026-09-17', version: 'v2.1' }).items[0]!.opinion).toBe('later — nothing is wrong today')
  })
})
