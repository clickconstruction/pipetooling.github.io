import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRIEF_DOC_SECTION_STEPS, getCaseBrief } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import { ALL_ROWS_MAX, newestFirst, readRowsByIds } from '../../../supabase/functions/_shared/devMcpComposites'
import { REPLY_MAX_CHARS, replyText } from '../../../supabase/functions/_shared/devMcpDoor'
import { PERSON_FILE_LINE_CHARS, briefPersonFileLine, getPersonFile, personFileFilter, type PersonFileBriefLine, type PersonFileReply } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { REPLY_FIT_CHARS, cutText, fitReply, outlineHeadings, replyChars, type FitStep, type Shortened } from '../../../supabase/functions/_shared/devMcpReplyFit'
import type { PersonTimelineLine } from '../people/personTimeline'
import { BIG_DOCUMENTS, BIG_ENTRIES, BIG_EVIDENCE, BIG_LONG_DOC_HEADINGS, BIG_MATTER, BIG_PERSON, BIG_RPC, BIG_TODAY, DEEP, bigCase, deepCase, pagingReader } from './bigCaseFixture'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const DEV = { role: 'dev', todayYmd: BIG_TODAY }
const reader = () => pagingReader({ rows: bigCase(), rpc: BIG_RPC })

/** The reply went through the door whole: under the cut, with no cut tail. */
function expectWholeThroughTheDoor(out: unknown) {
  const text = replyText(out)
  expect(text.length).toBeLessThan(REPLY_MAX_CHARS)
  expect(text).not.toContain('… cut at')
  expect(replyChars(out)).toBeLessThanOrEqual(REPLY_FIT_CHARS)
  expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(out)))
}

describe('the reply fit (v2.6935): a composite shortens itself in a fixed order and names what it shortened', () => {
  it('the budget sits under the door\'s cut, and a reply under it comes back untouched', () => {
    expect(REPLY_FIT_CHARS).toBeLessThan(REPLY_MAX_CHARS)
    const reply = { shortened: null as Shortened | null, list: ['a', 'b'] }
    const never: FitStep<typeof reply> = () => {
      throw new Error('a step ran on a reply that fits')
    }
    expect(fitReply(reply, [never])).toBe(reply)
  })

  it('runs the steps in order only while the reply is over, a later step on a block replaces its note, and the reason names both sizes', () => {
    const reply = { shortened: null as Shortened | null, list: Array.from({ length: 400 }, (_, i) => `row ${i}`), other: 'x'.repeat(300) }
    const ran: string[] = []
    const keep = (n: number): FitStep<typeof reply> => (r) => {
      ran.push(`list ${n}`)
      return { reply: { ...r, list: reply.list.slice(0, n) }, note: { block: 'list', kept: `the first ${n} of 400`, read_whole: 'read_rows' } }
    }
    const nothing: FitStep<typeof reply> = () => {
      ran.push('nothing')
      return null
    }
    const other: FitStep<typeof reply> = (r) => {
      ran.push('other')
      return { reply: { ...r, other: '' }, note: { block: 'other', kept: 'none', read_whole: 'ask again' } }
    }
    const out = fitReply(reply, [keep(200), nothing, keep(100), keep(20), other], 2600)
    expect(ran).toEqual(['list 200', 'nothing', 'list 100'])
    expect(out.list).toHaveLength(100)
    expect(out.other).toHaveLength(300)
    expect(out.shortened?.blocks).toEqual([{ block: 'list', kept: 'the first 100 of 400', read_whole: 'read_rows' }])
    expect(out.shortened?.why).toBe(`As asked this reply is ${replyChars(reply).toLocaleString('en-US')} characters, and the door cuts a reply at 80,000.`)
    expect(replyChars(out)).toBeLessThanOrEqual(2600)
    // What the ask itself shortened stays named, ahead of what the fit added.
    const asked = fitReply({ ...reply, shortened: { why: 'You asked for brief.', blocks: [{ block: 'lines', kept: 'short', read_whole: 'read_rows' }] } }, [keep(100)], 2800)
    expect(asked.shortened?.why.startsWith('You asked for brief. As asked this reply is ')).toBe(true)
    expect(asked.shortened?.blocks.map((b) => b.block)).toEqual(['lines', 'list'])
  })

  it('an outline keeps the shallowest levels whole, then the next level\'s first headings, in the document\'s order', () => {
    const h = (level: number, heading: string) => ({ level, heading })
    const doc = [h(1, 'Title'), h(2, 'A'), h(3, 'A.1'), h(3, 'A.2'), h(2, 'B'), h(3, 'B.1'), h(2, 'C'), h(3, 'C.1')]
    expect(outlineHeadings(doc, 8)).toEqual(doc)
    expect(outlineHeadings(doc, 4).map((x) => x.heading)).toEqual(['Title', 'A', 'B', 'C'])
    expect(outlineHeadings(doc, 6).map((x) => x.heading)).toEqual(['Title', 'A', 'A.1', 'A.2', 'B', 'C'])
    expect(outlineHeadings(doc, 2).map((x) => x.heading)).toEqual(['Title', 'A'])
    expect(outlineHeadings(doc, 0)).toEqual([])
    // One level: the first ones.
    expect(outlineHeadings([h(2, 'a'), h(2, 'b'), h(2, 'c')], 2).map((x) => x.heading)).toEqual(['a', 'b'])
  })

  it('a text is cut with an ellipsis and a count of what it left out, never through a surrogate pair', () => {
    expect(cutText('short', 10)).toEqual({ text: 'short', more: 0 })
    expect(cutText('one two three', 8)).toEqual({ text: 'one two…', more: 5 })
    expect(cutText('ab😀cd', 3)).toEqual({ text: 'ab…', more: 4 })
  })
})

describe('get_case_brief on a large case (v2.6935): 60 documents, one with 400 headings, 250 entries', () => {
  it('answers under the door\'s cut with every block there, the small ones first, and names the block it shortened', async () => {
    const out = await getCaseBrief(reader(), { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expectWholeThroughTheDoor(out)
    expect(Object.keys(out)).toEqual(['person', 'read_as', 'shortened', 'held', 'counts', 'agent_notes', 'summary', 'entries', 'matter', 'themes', 'developments', 'read_next', 'narrative', 'evidence', 'documents'])
    expect(out.held).toEqual([])
    // Whole, this brief is past the cut: the documents' section indexes fill it by themselves.
    expect(out.shortened?.why).toMatch(/^As asked this reply is 1\d\d,\d{3} characters, and the door cuts a reply at 80,000\.$/)
    expect(out.shortened?.blocks.map((b) => b.block)).toEqual(['documents.sections'])
    const note = out.shortened!.blocks[0]!
    const max = Number(/^at most (\d+) headings a document/.exec(note.kept)?.[1])
    expect(BRIEF_DOC_SECTION_STEPS).toContain(max)
    expect(note.kept).toContain(`of ${BIG_DOCUMENTS - 1} documents have more`)
    expect(note.read_whole).toContain('get_person_document { person, doc_id }')
    // Every document is listed (the notes apart), each with its whole count and at most `max` headings.
    expect(out.counts).toEqual({ entries: BIG_ENTRIES, evidence: BIG_EVIDENCE, documents: BIG_DOCUMENTS - 1 })
    expect(out.documents).toHaveLength(BIG_DOCUMENTS - 1)
    for (const d of out.documents) expect(d.sections.length).toBe(Math.min(max, d.section_count))
    const long = out.documents.find((d) => d.id === 'd-07')!
    expect(long.section_count).toBe(BIG_LONG_DOC_HEADINGS)
    // The outline: the title, then the second-level headings, not the first lines of the text.
    expect(long.sections[0]).toMatchObject({ line: 1 })
    expect(long.sections.map((s) => s.heading.split(' ')[0])).toEqual(['Paper', '1.', '11.'].slice(0, max))
    // The blocks that never arrived before: the entries, the evidence index, the matter, the themes, the developments.
    expect(out.entries).toMatchObject({ count: BIG_ENTRIES, at_cap: false, first: '2025-09-01', last: '2026-10-29' })
    expect(out.entries.newest).toHaveLength(10)
    expect(out.entries.newest[0]).toMatchObject({ id: 'e-249', ymd: '2026-10-29' })
    expect(out.entries.newest.every((e) => e.first_line.length > 0)).toBe(true)
    expect(Object.values(out.entries.by_source).reduce((a, b) => a + b, 0)).toBe(BIG_ENTRIES)
    expect(out.evidence).toHaveLength(BIG_EVIDENCE)
    expect(out.matter?.steps).toHaveLength(12)
    expect(out.matter?.narrative.sections).toHaveLength(out.matter!.narrative.section_count)
    expect(out.themes).toHaveLength(5)
    expect(out.developments.map((d) => d.name).sort()).toEqual(['Mill Creek', 'Quail Ridge'])
    expect(out.narrative?.sections).toHaveLength(45)
    expect(out.agent_notes).toMatchObject({ doc_id: 'd-00', more: true })
    expect(out.read_next).toContain('section_count')
  })

  it('counts the entries a page at a time: 250, not the 200 one read answers', async () => {
    const r = reader()
    const out = await getCaseBrief(r, { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.entries.count).toBe(BIG_ENTRIES)
    // Two pages of the light read, then the newest ten's words.
    expect(r.asked.filter((a) => a === 'rows:person_file_entries')).toHaveLength(3)
  })

  it('a case too long for the documents\' step alone goes on down the steps, each block named, and still fits', async () => {
    const data = bigCase()
    const more = (n: number) => Array.from({ length: n }, (_, i) => i)
    // 190 documents of 30 headings, 190 evidence records, a summary of 20,000 characters.
    const rows = {
      ...data,
      person_document_index: more(190).map((i) => ({ ...data.person_document_index[8]!, id: `d-${i}`, title: `Paper ${i}`, evidence_id: null })),
      person_file_evidence: more(190).map((i) => ({ ...data.person_file_evidence[0]!, id: `r-${i}` })),
      person_files: data.person_files.map((d) => (d.kind === 'summary' ? { ...d, content: 'word '.repeat(4000) } : d)),
    }
    const out = await getCaseBrief(pagingReader({ rows, rpc: BIG_RPC }), { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expectWholeThroughTheDoor(out)
    const blocks = out.shortened!.blocks.map((b) => b.block)
    // The steps' own order: the documents' headings, the narrative's outline, the evidence index, the documents list.
    expect(blocks).toEqual(['documents.sections', 'narrative.sections', 'evidence', 'documents'])
    expect(out.shortened!.blocks[0]!.kept).toContain('no headings')
    expect(out.counts).toMatchObject({ evidence: 190, documents: 190 })
    expect(out.documents.length).toBeLessThan(190)
    expect(out.documents.every((d) => d.sections.length === 0 && d.section_count > 0)).toBe(true)
    for (const b of out.shortened!.blocks) expect(b.read_whole.length).toBeGreaterThan(10)
  })
})

type Line = PersonTimelineLine | PersonFileBriefLine
const isBrief = (l: Line): l is PersonFileBriefLine => 'row' in l
const linesOf = (out: PersonFileReply): Line[] => [...out.ahead, ...out.months.flatMap((m) => m.lines)]
async function file(ask: Record<string, unknown>, r = reader()): Promise<PersonFileReply> {
  const out = await getPersonFile(r, { person: BIG_PERSON, ...ask }, DEV)
  if ('refused' in out) throw new Error(String(out.refused))
  return out as PersonFileReply
}
const FILE_KEYS = ['person', 'read_as', 'shortened', 'next_until', 'source', 'facts', 'chips', 'signed_papers', 'signed_papers_note', 'hours_statements', 'hours_statements_note', 'counts', 'lanes', 'sources', 'held', 'at_cap', 'filter', 'ahead', 'months', 'evidence', 'files_before_records', 'docs', 'documents', 'documents_note']

describe('get_person_file on a large file (v2.6935): 250 entries, 80 evidence records, a long narrative', () => {
  it('reads every entry a page at a time: the chip says 250 and no table is at the cap', async () => {
    const r = reader()
    const out = await file({}, r)
    expect(r.asked.filter((a) => a === 'rows:person_file_entries')).toHaveLength(2)
    expect(out.facts.entries).toBe(BIG_ENTRIES)
    expect(out.chips.find((c) => c.key === 'entries')?.label).toBe(`${BIG_ENTRIES} HR entries`)
    expect(out.counts.bySource.file).toBe(BIG_ENTRIES)
    expect(out.at_cap).toBeNull()
  })

  it('asked plainly, it still answers under the cut with every block there, and names each block it shortened', async () => {
    const out = await file({})
    expectWholeThroughTheDoor(out)
    expect(Object.keys(out)).toEqual(FILE_KEYS)
    expect(out.shortened?.why).toMatch(/^As asked this reply is [\d,]+ characters, and the door cuts a reply at 80,000\.$/)
    expect(out.shortened?.blocks.map((b) => b.block)).toEqual(['docs', 'evidence', 'documents', 'files_before_records', 'ahead and months', 'months'])
    for (const b of out.shortened!.blocks) expect(b.read_whole).toMatch(/read_rows|get_person_document|get_case_brief|get_person_file/)
    // The docs keep their sizes and the verb that reads them; the lines are short; the counts are the whole file's.
    expect(out.docs).toMatchObject({ narrative: { content: null, read: expect.stringContaining('get_person_document') }, summary: { content: null } })
    expect(linesOf(out).every(isBrief)).toBe(true)
    expect(out.counts.total).toBeGreaterThan(BIG_ENTRIES)
    expect(out.counts.shown).toBe(linesOf(out).length)
    expect(out.counts.shown).toBeLessThan(out.counts.total)
    expect(out.next_until).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(out.shortened!.blocks.find((b) => b.block === 'months')!.read_whole).toContain(`until: "${out.next_until}"`)
  })

  it('brief answers each line short with the row behind it, and reading on by next_until reaches every line once', async () => {
    const whole = await getPersonFile(pagingReader({ rows: { ...bigCase(), person_file_evidence: [], person_document_index: [], person_file_attachments: [], person_files: [] }, rpc: BIG_RPC }), { person: BIG_PERSON, source: 'file', since: '2026-10-01' }, DEV)
    if ('refused' in whole) throw new Error(String(whole.refused))
    // A short stretch of a file with nothing else on it is whole: nothing shortened, each line as the kernel wrote it.
    expect(whole.shortened).toBeNull()
    expect(whole.next_until).toBeNull()
    const full = linesOf(whole as PersonFileReply)[0] as PersonTimelineLine
    expect(full.key).toBe('entry:e-249')
    const short = briefPersonFileLine(full, 40)
    expect(short).toEqual({ ymd: full.ymd, lane: full.lane, source: 'file', kindWords: full.kindWords, what: `${full.what.slice(0, 40).trimEnd()}…`, more: full.what.length - 40, byName: 'HR agent', row: 'person_file_entries:e-249' })
    expect(Object.keys(short)).not.toContain('key')

    const seen = new Map<string, number>()
    let until: string | undefined
    let total = 0
    for (let page = 0; page < 12; page++) {
      const out = await file({ brief: true, ...(until ? { until } : {}) })
      expectWholeThroughTheDoor(out)
      expect(Object.keys(out)).toEqual(FILE_KEYS)
      expect(out.shortened?.why.startsWith('You asked for brief.')).toBe(true)
      expect(out.shortened?.blocks[0]?.block).toBe('ahead and months')
      total = out.counts.total
      for (const l of linesOf(out)) {
        if (!isBrief(l)) throw new Error('a whole line under brief')
        expect(l.what.length).toBeLessThanOrEqual(PERSON_FILE_LINE_CHARS + 1)
        // An employment line has no row of its own id per line; the day and the kind tell two apart.
        const k = `${l.row}|${l.ymd}|${l.kindWords}`
        seen.set(k, (seen.get(k) ?? 0) + 1)
      }
      if (!out.next_until) break
      expect(until === undefined || out.next_until < until).toBe(true)
      until = out.next_until
    }
    expect(seen.size).toBe(total)
    expect([...seen.values()].every((n) => n === 1)).toBe(true)
    expect([...seen.keys()].filter((k) => k.startsWith('person_file_entries:'))).toHaveLength(BIG_ENTRIES)
  })

  it('the six weeks that were cut before now fit: since with docs: false, the stretch\'s lines all there', async () => {
    const out = await file({ since: '2026-10-01', docs: false })
    expectWholeThroughTheDoor(out)
    expect(out.docs).toBe('left out (docs: false)')
    expect(out.filter).toEqual({ lane: null, source: null, since: '2026-10-01', until: null })
    expect(out.next_until).toBeNull()
    expect(out.counts.shown).toBe(linesOf(out).length)
    expect(linesOf(out).every((l) => l.ymd >= '2026-10-01')).toBe(true)
    expect(out.shortened?.blocks.length).toBeGreaterThan(0)
    expect(out.shortened?.blocks.map((b) => b.block)).not.toContain('months')
  })

  it('line_chars asks for brief at that length, docs: true keeps the text under brief, and until narrows as since does', async () => {
    const sixty = await file({ line_chars: 60, source: 'file', since: '2026-10-01' })
    expect(sixty.shortened?.why.startsWith('You asked for brief, 60 characters a line.')).toBe(true)
    const lines = linesOf(sixty)
    expect(lines.length).toBeGreaterThan(5)
    expect(lines.every((l) => isBrief(l) && l.what.length <= 61 && (l.more ?? 0) > 0)).toBe(true)
    const stretch = await file({ since: '2026-01-01', until: '2026-01-31', source: 'file', docs: false })
    expect(linesOf(stretch).map((l) => l.ymd).every((d) => d >= '2026-01-01' && d <= '2026-01-31')).toBe(true)
    expect(stretch.filter).toEqual({ lane: null, source: 'file', since: '2026-01-01', until: '2026-01-31' })
    const small = { ...bigCase(), person_file_entries: bigCase().person_file_entries.slice(0, 3), person_file_evidence: [], person_file_attachments: [], person_document_index: [], person_files: [{ id: 'pf', person_id: BIG_PERSON, kind: 'summary', content: '## Pay\nWeekly.', updated_at: '2026-11-01T00:00:00Z', covered_through: null, author_label: 'HR agent' }] }
    const sizes = (await getPersonFile(pagingReader({ rows: small, rpc: BIG_RPC }), { person: BIG_PERSON, brief: true }, DEV)) as PersonFileReply
    expect(sizes.docs).toEqual({ summary: { kind: 'summary', content: null, chars: 14, updated_at: '2026-11-01T00:00:00Z', covered_through: null, author_label: 'HR agent', read: 'get_person_document { person, kind: "summary" } reads it a section at a time' }, narrative: null })
    expect(sizes.shortened?.blocks.map((b) => b.block)).toEqual(['ahead and months', 'docs'])
    const kept = (await getPersonFile(pagingReader({ rows: small, rpc: BIG_RPC }), { person: BIG_PERSON, brief: true, docs: true }, DEV)) as PersonFileReply
    expect(kept.docs).toMatchObject({ summary: { content: '## Pay\nWeekly.' } })
    expect(kept.shortened?.blocks.map((b) => b.block)).toEqual(['ahead and months'])
  })

  it('a wrong until or line_chars is refused in words', () => {
    expect(personFileFilter({ person: BIG_PERSON, until: 'last week' })).toEqual({ ok: false, refused: 'until must be a day, YYYY-MM-DD.' })
    expect(personFileFilter({ person: BIG_PERSON, since: '2026-06-01', until: '2026-05-01' })).toEqual({ ok: false, refused: expect.stringContaining('is after until') })
    expect(personFileFilter({ person: BIG_PERSON, line_chars: 10 })).toEqual({ ok: false, refused: expect.stringContaining('line_chars must be a whole number from 40 to 2000') })
    expect(personFileFilter({ person: BIG_PERSON, line_chars: 'many' })).toEqual({ ok: false, refused: expect.stringContaining('line_chars') })
    expect(personFileFilter({ person: BIG_PERSON })).toMatchObject({ ok: true, brief: false, lineChars: PERSON_FILE_LINE_CHARS, until: null, docs: true, docsAsked: false })
    expect(personFileFilter({ person: BIG_PERSON, line_chars: 300 })).toMatchObject({ ok: true, brief: true, lineChars: 300 })
  })
})

describe('every list past 200 rows (v2.6939): each source of both verbs is read a page at a time', () => {
  const deep = () => pagingReader({ rows: deepCase(), rpc: BIG_RPC })
  const times = (r: { asked: string[] }, what: string) => r.asked.filter((a) => a === what).length

  it('newestFirst puts paged rows back newest first, a row with no day first, and ties in the order they came', () => {
    const rows = [{ id: 'a', on: '2026-01-02' }, { id: 'b', on: null }, { id: 'c', on: '2026-03-01' }, { id: 'd', on: '2026-01-02' }]
    expect(newestFirst(rows, 'on').map((r) => r.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('readRowsByIds reads a long list of ids a hundred at a time and answers every row', async () => {
    const r = deep()
    const ids = Array.from({ length: DEEP.jobs }, (_, i) => `j-${String(i).padStart(3, '0')}`)
    const rows = await readRowsByIds(r, 'jobs_ledger', 'id,job_name', ids)
    expect(rows).toHaveLength(DEEP.jobs)
    expect(new Set(rows.map((x) => x.id)).size).toBe(DEEP.jobs)
    expect(times(r, 'rows:jobs_ledger')).toBe(3)
    expect(await readRowsByIds(r, 'jobs_ledger', 'id,job_name', [])).toEqual([])
  })

  it('the brief counts every record, document, theme mark, step and job, and still fits the door', async () => {
    const r = deep()
    const out = await getCaseBrief(r, { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expectWholeThroughTheDoor(out)
    expect(out.held).toEqual([])
    expect(out.counts).toEqual({ entries: BIG_ENTRIES, evidence: DEEP.evidence, documents: DEEP.documents - 1 })
    // 430 marks on five themes: one read answered 200 of them, and each theme read 40.
    expect(out.themes.map((t) => t.marked)).toEqual([86, 86, 86, 86, 86])
    // The lists that were shortened say their whole size, and keep their newest rows.
    const kept = Object.fromEntries(out.shortened!.blocks.map((b) => [b.block, b.kept]))
    expect(kept.evidence).toContain(`of ${DEEP.evidence} records`)
    expect(kept.documents).toContain(`of ${DEEP.documents - 1} documents`)
    expect(kept['matter.steps and matter.documents']).toContain(`of ${DEEP.steps} steps`)
    expect(kept['matter.steps and matter.documents']).toContain(`of ${DEEP.matterDocuments} documents`)
    expect(out.evidence[0]!.id).toBe(`r-${DEEP.evidence - 1}`)
    expect(out.matter!.steps[out.matter!.steps.length - 1]!.id).toBe(`m-${DEEP.steps - 1}`)
    expect(out.matter!.documents[0]!.id).toBe(`md-${DEEP.matterDocuments - 1}`)
    // 240 jobs off the schedule, read by id a hundred at a time: the development lists them all.
    expect(out.developments.map((d) => [d.name, d.jobs.length])).toEqual([['Quail Ridge', DEEP.jobs]])
    expect(times(r, 'rows:person_file_evidence')).toBe(2)
    expect(times(r, 'rows:legal_theme_marks')).toBe(3)
    expect(times(r, 'rows:jobs_ledger')).toBe(3)
  })

  it('the file counts every record, report and license, and the oldest record still has both its files', async () => {
    const r = deep()
    const out = await file({ brief: true }, r)
    expectWholeThroughTheDoor(out)
    expect(out.at_cap).toBeNull()
    expect(out.facts).toMatchObject({ entries: BIG_ENTRIES, evidence: DEEP.evidence, reportsPending: DEEP.reports, licensesLive: DEEP.licenses })
    expect(out.counts.bySource).toMatchObject({ evidence: DEEP.evidence, report: DEEP.reports })
    expect(out.shortened!.blocks.find((b) => b.block === 'evidence')!.kept).toContain(`of ${DEEP.evidence} records`)
    expect(out.shortened!.blocks.find((b) => b.block === 'documents')!.kept).toContain(`of ${DEEP.documents} documents`)
    expect(out.evidence[0]).toMatchObject({ id: `r-${DEEP.evidence - 1}`, files: 2 })
    expect(times(r, 'rows:person_file_attachments')).toBe(3)
    // 460 files, two on every record. One read of the newest 200 left the older records with none.
    const oldest = await file({ source: 'evidence', until: '2025-10-31', brief: true, docs: false }, deep())
    const lines = linesOf(oldest).filter(isBrief)
    expect(lines).toHaveLength(31)
    expect(lines.every((l) => l.files === 2)).toBe(true)
    expect(lines[lines.length - 1]!.row).toBe('person_file_evidence:r-000')
  })

  it('a list of exactly 200 rows is whole, not called short: the second page comes back empty', async () => {
    const base = bigCase()
    const r = pagingReader({ rows: { ...base, person_licenses: Array.from({ length: 200 }, (_, i) => ({ ...base.person_licenses[0]!, id: `l-${String(i).padStart(3, '0')}` })) }, rpc: BIG_RPC })
    const out = await file({ brief: true }, r)
    expect(out.at_cap).toBeNull()
    expect(out.facts.licensesLive).toBe(200)
    expect(times(r, 'rows:person_licenses')).toBe(2)
  })

  it('a list past the paged read\'s own stop is named: at_cap on the file, held on the brief', async () => {
    const base = bigCase()
    const many = ALL_ROWS_MAX + 1
    const licenses = Array.from({ length: many }, (_, i) => ({ ...base.person_licenses[0]!, id: `l-${String(i).padStart(5, '0')}` }))
    const out = await file({ brief: true }, pagingReader({ rows: { ...base, person_licenses: licenses }, rpc: BIG_RPC }))
    expect(out.at_cap?.tables).toEqual(['person_licenses'])
    expect(out.at_cap?.note).toContain(`a read stops at ${ALL_ROWS_MAX} rows`)
    expect(out.facts.licensesLive).toBe(ALL_ROWS_MAX)
    const marks = Array.from({ length: many }, (_, i) => ({ id: `mk-${String(i).padStart(5, '0')}`, person_id: BIG_PERSON, theme_id: 't-0', proposed: false, removed_at: null }))
    const brief = await getCaseBrief(pagingReader({ rows: { ...base, legal_theme_marks: marks }, rpc: BIG_RPC }), { person: BIG_PERSON }, DEV)
    if ('refused' in brief) throw new Error(brief.refused)
    expect(brief.held).toEqual([{ source: 'themes', reason: `more than ${ALL_ROWS_MAX} rows of legal_theme_marks: the read stopped there` }])
    expect(brief.themes[0]).toMatchObject({ id: 't-0', marked: ALL_ROWS_MAX })
    expect(BIG_MATTER).toBe(brief.matter!.id)
  })
})

describe('the server and the docs carry the fit (v2.6935) and the paged sources (v2.6939 / 0.66.0)', () => {
  it('get_person_file takes until, brief and line_chars; both verbs say shortened; the README rows say how to read on', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.79.0'")
    expect(SERVER).toContain('until: args.until, docs: args.docs, brief: args.brief, line_chars: args.line_chars')
    for (const arg of ['until:', 'brief:', 'line_chars:']) expect(SERVER.slice(SERVER.indexOf("name: 'get_person_file'"), SERVER.indexOf("name: 'get_hours_statement'"))).toContain(arg)
    expect(SERVER.slice(SERVER.indexOf("name: 'get_case_brief'"), SERVER.indexOf("name: 'get_document_history'"))).toContain('shortened')
    expect(README).toContain('`get_person_file(person, lane?, source?, since?, until?, docs?, brief?, line_chars?)`')
    const row = (verb: string) => README.split('\n').find((l) => l.startsWith(`| \`${verb}(`)) ?? ''
    expect(row('get_case_brief')).toContain('`shortened`')
    expect(row('get_person_file')).toContain('`next_until`')
    expect(row('get_person_file')).toContain('`shortened`')
    // v2.6939: both rows say every source is paged, and what at_cap and held name now.
    expect(row('get_person_file')).toContain('`at_cap` names a source only past 5,000 rows')
    expect(row('get_case_brief')).toContain('a list past 5,000 rows named in `held`')
    expect(SERVER).toContain('readRowsByIds')
  })
})
