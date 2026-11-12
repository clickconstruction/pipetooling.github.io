/**
 * Small edits inside a section (v2.6949): `plan_person_doc` and `plan_matter_narrative` take `prepend_section` (new lines
 * straight under a heading, above the section's own) and `replace_text` (one exact run swapped inside a section), so a
 * line is added to a newest-first log or a sentence is changed without the section being sent again. The kernel applies
 * a call's ops to the text the server read and hands the grammar the whole result with the stamp it was read at; the
 * database refuses a write over a newer save, as it always has. Made-up documents and people only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DOC_OPS_MAX, SECTION_OP_WORDS_CAP, applyDocOps, docEditApplyReply, docEditPlanReply, docEditQuery, docEditStored, docHeadings, hasSmallEdits,
  prepareDocEdits, sectionOpsForRpc, withoutLeadingBlankLines, type DocEditPrepared, type DocEditStored, type DocEditTarget,
} from '../../../supabase/functions/_shared/devMcpDocEdits'
import { writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const WRITES = readFileSync('supabase/functions/_shared/devMcpWrites.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const OPS_MIGRATION = readFileSync('supabase/migrations/20261107100000_matter_narrative_ops.sql', 'utf8')
const DOC_MIGRATION = readFileSync('supabase/migrations/20261108193000_person_document_evidence.sql', 'utf8')

const PERSON = 'a1b2c3d4-0000-4000-8000-000000000091'
const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'
const MATTER = 'e1e2c3d4-0000-4000-8000-000000000033'
const STAMP = '2026-03-04T15:00:00.123456+00:00'
const HASH = 'ab'.repeat(32)

/** A made-up notes document: a preamble, a section with a subsection, and a newest-first log that is last. */
const LINES = [
  '# Notes on the training bay', // 1
  '', // 2
  'Kept by the office.', // 3
  '', // 4
  '## Where things are', // 5
  '', // 6
  'The bay opens on Monday. The hoist is booked for the week after.', // 7
  'The key is with the front desk.', // 8
  '', // 9
  '### Open questions', // 10
  '', // 11
  'Who signs for the hoist.', // 12
  '', // 13
  '## Log, newest first', // 14
  '', // 15
  '- 2026-03-04 The racks arrived.', // 16
  '- 2026-03-02 The floor was sealed.', // 17
]
const TEXT = LINES.join('\n')

const done = (text: string, ops: unknown, what?: string) => {
  const out = applyDocOps(text, ops, what)
  if (!out.ok) throw new Error(out.error)
  return out
}
const refusal = (text: string, ops: unknown, what?: string): string => {
  const out = applyDocOps(text, ops, what)
  if (out.ok) throw new Error('expected a refusal')
  return out.error
}

describe('the headings a section is cut on', () => {
  it('reads ATX headings as the database does: fences skipped, closing hashes, backticks and bold markers stripped', () => {
    const md = ['# One', '```', '## not a heading', '```', '## **Two** `code` ##', '~~~', '# nor this', '~~~', '####### seven is no heading', '### Three']
    expect(docHeadings(md.join('\n'))).toEqual([
      { line: 1, level: 1, heading: 'One' },
      { line: 5, level: 2, heading: 'Two code' },
      { line: 10, level: 3, heading: 'Three' },
    ])
    expect(docHeadings('')).toEqual([])
    expect(docHeadings(TEXT).map((h) => h.heading)).toEqual(['Notes on the training bay', 'Where things are', 'Open questions', 'Log, newest first'])
  })
})

describe('prepend_section: new lines straight under a heading', () => {
  it('puts a line on top of a newest-first log that is the last section, and adds nothing else', () => {
    const line = '- 2026-03-06 The hoist was fitted.'
    const out = done(TEXT, [{ op: 'prepend_section', heading: 'Log, newest first', markdown: line }])
    expect(out.after.split('\n')).toEqual([...LINES.slice(0, 15), line, ...LINES.slice(15)])
    expect(out.after.length).toBe(TEXT.length + line.length + 1)
    expect(out.changes).toEqual([{ op: 'prepend_section', heading: 'Log, newest first', level: 2, at_line: 16, added_lines: 1, added: line, above: '- 2026-03-04 The racks arrived.' }])
  })

  it('takes the heading as it is written, hashes, case and all, and several lines at once', () => {
    const md = '- 2026-03-06 The hoist was fitted.\n- 2026-03-05 The fitter came.'
    const out = done(TEXT, [{ op: 'prepend_section', heading: '## LOG, newest first', markdown: `\n${md}\n` }])
    expect(out.after.split('\n').slice(13, 19)).toEqual(['## Log, newest first', '', '- 2026-03-06 The hoist was fitted.', '- 2026-03-05 The fitter came.', '- 2026-03-04 The racks arrived.', '- 2026-03-02 The floor was sealed.'])
    expect(out.changes[0]).toMatchObject({ at_line: 16, added_lines: 2, added: md })
  })

  it('leaves a blank line under the new lines when the markdown ends with an empty line', () => {
    const out = done(TEXT, [{ op: 'prepend_section', heading: 'Where things are', markdown: 'The bay is open.\n\n' }])
    expect(out.after.split('\n').slice(4, 9)).toEqual(['## Where things are', '', 'The bay is open.', '', LINES[6]])
    expect(out.changes[0]).toMatchObject({ at_line: 7, added_lines: 2, added: 'The bay is open.', above: LINES[6] })
    // Without the empty line the new words sit on the old ones.
    const tight = done(TEXT, [{ op: 'prepend_section', heading: 'Where things are', markdown: 'The bay is open.\n' }])
    expect(tight.after.split('\n').slice(4, 8)).toEqual(['## Where things are', '', 'The bay is open.', LINES[6]])
  })

  it('keeps a section as it is framed: no blank line under the heading stays none', () => {
    const tight = '## Log\n- old\n\n## After\n\nwords'
    expect(done(tight, [{ op: 'prepend_section', heading: 'Log', markdown: '- new' }]).after).toBe('## Log\n- new\n- old\n\n## After\n\nwords')
  })

  it('fills a heading with nothing under it, in the middle and at the end', () => {
    expect(done('## Empty\n\n## After\n\nwords', [{ op: 'prepend_section', heading: 'Empty', markdown: 'First words.' }]).after).toBe('## Empty\n\nFirst words.\n\n## After\n\nwords')
    const last = done('## Before\n\nwords\n\n## Empty', [{ op: 'prepend_section', heading: 'Empty', markdown: 'First words.' }])
    expect(last.after).toBe('## Before\n\nwords\n\n## Empty\n\nFirst words.')
    expect(last.changes[0]).toMatchObject({ at_line: 7, added_lines: 1, above: null })
  })

  it('goes above a subsection when the section opens with one', () => {
    const md = '## Top\n\n### Inner\n\nwords'
    expect(done(md, [{ op: 'prepend_section', heading: 'Top', markdown: 'A line.\n\n' }]).after).toBe('## Top\n\nA line.\n\n### Inner\n\nwords')
  })

  it('needs words and a heading that is there once', () => {
    expect(refusal(TEXT, [{ op: 'prepend_section', heading: 'Log, newest first', markdown: ' \n' }])).toBe('op prepend_section needs words')
    expect(refusal(TEXT, [{ op: 'prepend_section', heading: 'Log, newest first' }])).toBe('op prepend_section needs markdown')
    expect(refusal(TEXT, [{ op: 'prepend_section', markdown: 'x' }])).toBe("op prepend_section needs heading (the section's heading text)")
    expect(refusal(TEXT, [{ op: 'prepend_section', heading: 'The log', markdown: 'x' }])).toBe('no heading "The log" in the document. Its headings: Notes on the training bay | Where things are | Open questions | Log, newest first')
    expect(refusal('## Log\n\na\n\n## Log\n\nb', [{ op: 'prepend_section', heading: 'Log', markdown: 'x' }], 'narrative')).toBe('the heading "Log" appears 2 times in the narrative; make it unique first')
  })
})

describe('replace_text: one exact run swapped inside a section', () => {
  it('changes the run and nothing else', () => {
    const find = 'The hoist is booked for the week after.'
    const replace = 'The hoist is booked for the 20th.'
    const out = done(TEXT, [{ op: 'replace_text', heading: 'Where things are', find, replace }])
    expect(out.after).toBe(TEXT.replace(find, replace))
    expect(out.after.length).toBe(TEXT.length - find.length + replace.length)
    expect(out.changes).toEqual([{
      op: 'replace_text', heading: 'Where things are', level: 2, line: 7,
      removed_chars: find.length, added_chars: replace.length, removed: find, added: replace,
      reads: 'The bay opens on Monday. The hoist is booked for the 20th.',
    }])
  })

  it('works in the last section of the document, across a line break, and takes a run out', () => {
    const last = done(TEXT, [{ op: 'replace_text', heading: 'Log, newest first', find: 'sealed.', replace: 'sealed and cured.' }])
    expect(last.after).toBe(`${TEXT.slice(0, -'sealed.'.length)}sealed and cured.`)
    expect(last.changes[0]).toMatchObject({ line: 17, reads: '- 2026-03-02 The floor was sealed and cured.' })

    const across = done(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'the week after.\nThe key is', replace: 'Friday. The key is' }])
    expect(across.after.split('\n')[6]).toBe('The bay opens on Monday. The hoist is booked for Friday. The key is with the front desk.')
    expect(across.after.split('\n')).toHaveLength(LINES.length - 1)

    const gone = done(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: ' The hoist is booked for the week after.', replace: '' }])
    expect(gone.after.split('\n')[6]).toBe('The bay opens on Monday.')
    expect(gone.changes[0]).toMatchObject({ added: '', added_chars: 0, reads: 'The bay opens on Monday.' })
  })

  it('refuses a run that is not in the section, naming the count and where else it stands', () => {
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'The racks arrived.', replace: 'x' }])).toBe(
      'op replace_text: the words to find occur 0 times in the section "Where things are". They occur 1 time elsewhere in the document, first on line 16 under "Log, newest first". They must match to the letter, the space and the line break; read the section and copy the run from it.',
    )
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Log, newest first', find: 'the racks arrived', replace: 'x' }])).toBe(
      'op replace_text: the words to find occur 0 times in the section "Log, newest first". They must match to the letter, the space and the line break; read the section and copy the run from it.',
    )
    // The heading line is not in reach, so a heading is never rewritten by a swap.
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'Where things', replace: 'x' }])).toContain('occur 0 times in the section "Where things are"')
  })

  it('refuses a run that stands more than once in the section, naming the count and the lines', () => {
    // A section holds its subsections, so "hoist" under Open questions counts.
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'hoist', replace: 'lift' }])).toBe(
      'op replace_text: the words to find occur 2 times in the section "Where things are" (lines 7, 12); send a longer run that occurs once, so the plan changes one place.',
    )
    // Named by the subsection, the same word stands once.
    expect(done(TEXT, [{ op: 'replace_text', heading: 'Open questions', find: 'hoist', replace: 'lift' }]).after.split('\n')[11]).toBe('Who signs for the lift.')
    // A run that could be read two ways overlapping is two, never one.
    expect(refusal('## A\n\naaa', [{ op: 'replace_text', heading: 'A', find: 'aa', replace: 'b' }])).toContain('occur 2 times')
  })

  it('needs find and replace, and a change', () => {
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: '', replace: 'x' }])).toContain('needs find')
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'Monday' }])).toContain('needs replace')
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'Monday', replace: 'Monday' }])).toContain('changes nothing')
    expect(refusal(TEXT, [{ op: 'replace_text', find: 'Monday', replace: 'Tuesday' }])).toBe("op replace_text needs heading (the section's heading text)")
    expect(refusal(TEXT, [{ op: 'replace_text', heading: 'No such', find: 'Monday', replace: 'Tuesday' }])).toContain('no heading "No such" in the document')
  })

  it('shows a small edit whole, where a section op is capped', () => {
    const long = 'w'.repeat(SECTION_OP_WORDS_CAP + 1000)
    const small = done(TEXT, [{ op: 'replace_text', heading: 'Where things are', find: 'Monday', replace: long }, { op: 'prepend_section', heading: 'Log, newest first', markdown: long }])
    expect((small.changes[0] as { added: string }).added).toHaveLength(long.length)
    expect((small.changes[1] as { added: string }).added).toHaveLength(long.length)
    const section = done(TEXT, [{ op: 'replace_section', heading: 'Log, newest first', markdown: long }])
    expect((section.changes[0] as { added: string }).added).toHaveLength(SECTION_OP_WORDS_CAP)
  })
})

describe('a call of several ops', () => {
  it('applies them in order, each against the text the one before it left, and keeps the limit', () => {
    const out = done(TEXT, [
      { op: 'prepend_section', heading: 'Log, newest first', markdown: '- 2026-03-06 The hoist was fitted.' },
      { op: 'replace_text', heading: 'Log, newest first', find: 'The hoist was fitted.', replace: 'The hoist was fitted and tested.' },
      { op: 'replace_text', heading: 'Where things are', find: 'for the week after', replace: 'for the 20th' },
      { op: 'append', markdown: '## Next\n\nThe sign-off.' },
    ])
    expect(out.changes.map((c) => c.op)).toEqual(['prepend_section', 'replace_text', 'replace_text', 'append'])
    expect(out.after.split('\n').slice(13)).toEqual(['## Log, newest first', '', '- 2026-03-06 The hoist was fitted and tested.', '- 2026-03-04 The racks arrived.', '- 2026-03-02 The floor was sealed.', '', '## Next', '', 'The sign-off.'])
    expect(out.after.split('\n')[6]).toBe('The bay opens on Monday. The hoist is booked for the 20th.')

    expect(DOC_OPS_MAX).toBe(20)
    expect(refusal(TEXT, Array.from({ length: 21 }, () => ({ op: 'append', markdown: 'x' })))).toBe('at most 20 ops a call')
    expect(refusal(TEXT, [])).toBe('ops must be a list of at least one op')
    expect(refusal(TEXT, 'nope')).toBe('ops must be a list of at least one op')
    expect(refusal(TEXT, [{ op: 'rewrite', markdown: 'x' }])).toBe('op must be replace_section, insert_after, append, prepend_section or replace_text (got "rewrite")')
    // One op that fails stops the call: nothing is half applied.
    expect(applyDocOps(TEXT, [{ op: 'append', markdown: 'x' }, { op: 'replace_text', heading: 'Where things are', find: 'not there', replace: 'y' }]).ok).toBe(false)
  })
})

describe('the three section ops, cut and joined as the database joins them', () => {
  it('replace_section sets one blank line under the heading and one before the next heading', () => {
    const out = done(TEXT, [{ op: 'replace_section', heading: 'Where things are', markdown: 'All moved.\n' }])
    expect(out.after.split('\n').slice(4, 9)).toEqual(['## Where things are', '', 'All moved.', '', '## Log, newest first'])
    expect(out.changes[0]).toMatchObject({ op: 'replace_section', heading: 'Where things are', level: 2, from_line: 6, to_line: 13, removed_lines: 8, added_lines: 1, added: 'All moved.' })
    // The last section takes no blank line after it; '' empties a section.
    expect(done(TEXT, [{ op: 'replace_section', heading: 'Log, newest first', markdown: '- none' }]).after).toBe(`${LINES.slice(0, 14).join('\n')}\n\n- none`)
    expect(done(TEXT, [{ op: 'replace_section', heading: 'Where things are', markdown: '' }]).after.split('\n').slice(4, 7)).toEqual(['## Where things are', '', '## Log, newest first'])
  })

  it('writes a section back exactly when it is sent as it was read, the blank line under its heading included', () => {
    // The lines under the heading as a section read hands them over: the blank line first, the blank line last.
    const asRead = LINES.slice(5, 13).join('\n')
    expect(asRead.startsWith('\n')).toBe(true)
    expect(done(TEXT, [{ op: 'replace_section', heading: 'Where things are', markdown: asRead }]).after).toBe(TEXT)
    const changed = asRead.replace('the week after', 'the 20th')
    expect(done(TEXT, [{ op: 'replace_section', heading: 'Where things are', markdown: changed }]).after).toBe(TEXT.replace('the week after', 'the 20th'))
  })

  it('insert_after and append add their own blank line above the new lines', () => {
    const after = done(TEXT, [{ op: 'insert_after', heading: 'Where things are', markdown: '## Between\n\nwords' }])
    expect(after.after.split('\n').slice(11, 18)).toEqual(['Who signs for the hoist.', '', '## Between', '', 'words', '', '## Log, newest first'])
    expect(after.changes[0]).toMatchObject({ op: 'insert_after', at_line: 14, added_lines: 3 })
    const end = done(TEXT, [{ op: 'append', markdown: '## Next\n\nwords\n\n' }])
    expect(end.after).toBe(`${TEXT}\n\n## Next\n\nwords`)
    expect(end.changes[0]).toMatchObject({ op: 'append', at_line: 18, added_lines: 3 })
    expect(done('', [{ op: 'append', markdown: 'first' }]).after).toBe('first')
    expect(refusal(TEXT, [{ op: 'append', markdown: '\n' }])).toBe('op append needs words')
  })

  it('stands on the same lines of SQL the port was read from', () => {
    for (const sql of [OPS_MIGRATION, DOC_MIGRATION]) {
      expect(sql).toContain("|| CASE WHEN v_md = '' THEN ARRAY[]::text[] ELSE ARRAY[''] || v_new_lines END")
      expect(sql).toContain("|| CASE WHEN v_end < v_n THEN ARRAY[''] ELSE ARRAY[]::text[] END")
      expect(sql).toContain("|| CASE WHEN v_end > 0 AND v_lines[v_end] <> '' THEN ARRAY[''] ELSE ARRAY[]::text[] END")
      expect(sql).toContain("v_md := rtrim(v_op->>'markdown', E'\\n');")
      expect(sql).toContain('WHERE h.line_no > v_start AND h.level <= v_level;')
      // The database knows the three section ops alone: a small edit never reaches it as an op.
      expect(sql).toContain("NOT IN ('replace_section', 'insert_after', 'append') THEN")
    }
  })
})

describe('a section op on its way to the database', () => {
  it('drops the empty lines at the head of its markdown, which the op would double', () => {
    expect(withoutLeadingBlankLines('\n\n  \nwords\n\nmore\n')).toBe('words\n\nmore\n')
    expect(withoutLeadingBlankLines('  indented stays')).toBe('  indented stays')
    expect(withoutLeadingBlankLines('')).toBe('')
    const ops = [{ op: 'replace_section', heading: 'Pay', markdown: '\nPaid weekly.' }, { op: 'append', markdown: 'As it was.' }, { op: 'other', markdown: '\nkept' }, 'not an op']
    const out = sectionOpsForRpc(ops)
    expect(out[0]).toEqual({ op: 'replace_section', heading: 'Pay', markdown: 'Paid weekly.' })
    expect(out[1]).toBe(ops[1])
    expect(out[2]).toBe(ops[2])
    expect(out[3]).toBe('not an op')
  })

  it('travels through writeRpcBody cut, and a small edit that was not worked out is refused there', () => {
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [{ op: 'replace_section', heading: 'Pay', markdown: '\n\nPaid weekly.' }] } })).toMatchObject({
      ok: true, body: { p: { ops: [{ op: 'replace_section', heading: 'Pay', markdown: 'Paid weekly.' }] } },
    })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, ops: [{ op: 'insert_after', heading: 'The claim', markdown: '\nWhat is owed.' }] } })).toMatchObject({
      ok: true, body: { p: { ops: [{ op: 'insert_after', heading: 'The claim', markdown: 'What is owed.' }] } },
    })
    const small = [{ op: 'replace_text', heading: 'Pay', find: 'weekly', replace: 'monthly' }]
    expect(hasSmallEdits(small)).toBe(true)
    expect(hasSmallEdits([{ op: 'append', markdown: 'x' }])).toBe(false)
    expect(hasSmallEdits('nope')).toBe(false)
    const refusedDoc = writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: small } })
    expect(refusedDoc).toMatchObject({ ok: false, error: expect.stringContaining('{ op: prepend_section, heading, markdown } | { op: replace_text, heading, find, replace }') })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, ops: small } })).toMatchObject({ ok: false, error: expect.stringContaining('{ op: replace_text, heading, find, replace }') })
  })
})

describe('a call made ready for the grammar', () => {
  const stored = (over: Partial<DocEditStored> = {}): DocEditStored => ({ exists: true, text: TEXT, updatedAt: STAMP, ...over })
  const reads: DocEditTarget[] = []
  const reader = (answer: DocEditStored | { error: string }) => (target: DocEditTarget) => {
    reads.push(target)
    return Promise.resolve(answer)
  }
  const prepend = { op: 'prepend_section', heading: 'Log, newest first', markdown: '- 2026-03-06 The hoist was fitted.' }
  const swap = { op: 'replace_text', heading: 'Where things are', find: 'for the week after', replace: 'for the 20th' }
  const ready = (p: Awaited<ReturnType<typeof prepareDocEdits>>): DocEditPrepared => {
    if (!p || !p.ok) throw new Error(p ? p.error : 'not prepared')
    return p
  }

  it('leaves a call with no small edit, another verb or a shape the grammar refuses as it came, and reads nothing', async () => {
    reads.length = 0
    const never = reader({ error: 'must not be read' })
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [{ op: 'append', markdown: 'x' }] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, markdown: 'x' } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, markdown: 'x', ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: 'nope', doc_id: DOC, ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: 'nope', ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, kind: 'history', ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', doc_id: DOC, ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: Array.from({ length: 21 }, () => swap) } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_matter_narrative', { narrative: { matter_id: 'nope', ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_hr_entry', { doc: { person_id: PERSON, doc_id: DOC, ops: [swap] } }, never)).toBeNull()
    expect(await prepareDocEdits('plan_person_doc', {}, never)).toBeNull()
    expect(reads).toHaveLength(0)
  })

  it('reads a named document once and hands the grammar the whole text with the stamp it was read at', async () => {
    reads.length = 0
    const args = { doc: { person_id: PERSON, doc_id: DOC, ops: [prepend, swap], counsel_only: true }, plan_hash: HASH }
    const p = ready(await prepareDocEdits('apply_person_doc', args, reader(stored())))
    expect(reads).toEqual([{ table: 'person_documents', personId: PERSON, docId: DOC, what: 'document' }])
    const after = done(TEXT, [prepend, swap]).after
    expect(p.args).toEqual({ doc: { person_id: PERSON, doc_id: DOC, counsel_only: true, markdown: after, expect_updated_at: STAMP }, plan_hash: HASH })
    expect(p.changes.map((c) => c.op)).toEqual(['prepend_section', 'replace_text'])
    expect(p.readAt).toBe(STAMP)
    // The grammar takes it as a whole text, with the stamp, and nothing of the ops.
    expect(writeRpcBody('apply_person_doc', p.args)).toMatchObject({ ok: true, step: 'apply', body: { p: { person_id: PERSON, doc_id: DOC, markdown: after, expect_updated_at: STAMP, counsel_only: true } } })
  })

  it('edits the summary, the narrative and a matter narrative the same way', async () => {
    reads.length = 0
    const summary = ready(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', ops: [swap] } }, reader(stored())))
    expect(summary.target).toEqual({ table: 'person_files', personId: PERSON, kind: 'summary', what: 'summary' })
    const matter = ready(await prepareDocEdits('plan_matter_narrative', { narrative: { matter_id: MATTER, ops: [swap] } }, reader(stored())))
    expect(matter.target).toEqual({ table: 'legal_matters', matterId: MATTER, what: 'narrative' })
    expect(matter.args).toEqual({ narrative: { matter_id: MATTER, markdown: TEXT.replace('for the week after', 'for the 20th'), expect_updated_at: STAMP } })
    expect(writeRpcBody('plan_matter_narrative', matter.args)).toMatchObject({ ok: true, body: { p: { matter_id: MATTER, expect_updated_at: STAMP } } })
  })

  it('keeps the stamp the caller loaded, and refuses when the document was saved since', async () => {
    const same = ready(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [swap], expect_updated_at: '2026-03-04T15:00:00.123Z' } }, reader(stored())))
    expect((same.args.doc as { expect_updated_at: string }).expect_updated_at).toBe('2026-03-04T15:00:00.123Z')
    const stale = await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [swap], expect_updated_at: '2026-03-04T14:00:00Z' } }, reader(stored()))
    expect(stale).toEqual({ ok: false, error: `plan_person_doc: the document was saved at ${STAMP}, after the version you loaded (2026-03-04T14:00:00Z). Read it again and edit from that.` })
  })

  it('refuses in words: a new title, a text that is not there, a read that failed, an op that cannot land', async () => {
    const never = reader({ error: 'must not be read' })
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, title: 'New notes', ops: [prepend] } }, never)).toMatchObject({ ok: false, error: expect.stringContaining('a new title has no section yet') })
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [swap] } }, reader(stored({ exists: false, text: '', updatedAt: null })))).toEqual({ ok: false, error: 'plan_person_doc: no document with that doc_id on that person, so there is no section to edit.' })
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, kind: 'narrative', ops: [swap] } }, reader(stored({ exists: false, text: '', updatedAt: null })))).toEqual({ ok: false, error: 'plan_person_doc: no narrative on that person yet, so there is no section to edit.' })
    expect(await prepareDocEdits('apply_matter_narrative', { narrative: { matter_id: MATTER, ops: [swap] } }, reader({ error: 'permission denied' }))).toEqual({ ok: false, error: 'apply_matter_narrative: the narrative could not be read for the edit: permission denied' })
    expect(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [{ ...swap, find: 'hoist' }] } }, reader(stored()))).toEqual({
      ok: false, error: 'plan_person_doc: op replace_text: the words to find occur 2 times in the section "Where things are" (lines 7, 12); send a longer run that occurs once, so the plan changes one place.',
    })
  })

  it('reads each kind of text with one GET, and takes no row as a text that is not there', () => {
    expect(docEditQuery({ table: 'person_documents', personId: PERSON, docId: DOC, what: 'document' })).toEqual({ table: 'person_documents', query: `select=content,updated_at&id=eq.${DOC}&person_id=eq.${PERSON}&limit=1` })
    expect(docEditQuery({ table: 'person_files', personId: PERSON, kind: 'narrative', what: 'narrative' })).toEqual({ table: 'person_files', query: `select=content,updated_at&person_id=eq.${PERSON}&kind=eq.narrative&limit=1` })
    expect(docEditQuery({ table: 'legal_matters', matterId: MATTER, what: 'narrative' })).toEqual({ table: 'legal_matters', query: `select=narrative_md,narrative_updated_at&id=eq.${MATTER}&limit=1` })
    const doc: DocEditTarget = { table: 'person_documents', personId: PERSON, docId: DOC, what: 'document' }
    expect(docEditStored(doc, [{ content: TEXT, updated_at: STAMP }])).toEqual({ exists: true, text: TEXT, updatedAt: STAMP })
    expect(docEditStored(doc, [])).toEqual({ exists: false, text: '', updatedAt: null })
    expect(docEditStored(doc, { message: 'not rows' })).toEqual({ exists: false, text: '', updatedAt: null })
    expect(docEditStored({ table: 'legal_matters', matterId: MATTER, what: 'narrative' }, [{ narrative_md: null, narrative_updated_at: null }])).toEqual({ exists: true, text: '', updatedAt: null })
  })

  it("shows the plan's changes as each op's own, and counts the ops an apply landed", async () => {
    const p = ready(await prepareDocEdits('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [prepend, swap] } }, reader(stored())))
    const planned = docEditPlanReply({ plan_hash: 'h', changes: [{ op: 'rewrite', removed_lines: 17, added_lines: 18 }], sections: [] }, p)
    expect(planned.plan_hash).toBe('h')
    expect(planned.changes).toBe(p.changes)
    expect(String(planned.worked_out)).toBe(`On the server, from the document as it stood at ${STAMP}: each change above is all that moves. A save by anyone before the apply refuses it; plan again from the fresh text.`)
    expect(docEditApplyReply({ ok: true, matter_id: MATTER, chars: 10, changes: 1 }, p)).toEqual({ ok: true, matter_id: MATTER, chars: 10, changes: 2 })
    expect(docEditApplyReply({ ok: true, chars: 10, revision_archived: true }, p)).toEqual({ ok: true, chars: 10, revision_archived: true })
    expect(docEditApplyReply('text', p)).toBe('text')
  })
})

describe('the server and the docs', () => {
  it('works a small edit out before the body is built, as the dev, and shows its changes in the plan', () => {
    expect(SERVER).toContain("import { docEditApplyReply, docEditPlanReply, docEditQuery, docEditStored, prepareDocEdits, type DocEditPrepared } from '../_shared/devMcpDocEdits.ts'")
    expect(SERVER).toContain("if (!driveDoc && (name === 'plan_person_doc' || name === 'apply_person_doc' || name === 'plan_matter_narrative' || name === 'apply_matter_narrative')) {")
    expect(SERVER).toContain('const r = await restGet(sessionForEdit, q.table, q.query)')
    expect(SERVER).toContain('if (prepared && !prepared.ok) return refused(prepared.error)')
    expect(SERVER).toContain('driveDoc ? driveDoc.args : docEdit ? docEdit.args : args)')
    expect(SERVER).toContain('docEdit ? docEditPlanReply(planned, docEdit) : planned')
    expect(SERVER).toContain("if (docEdit && built.step === 'apply') reply = docEditApplyReply(reply, docEdit)")
    expect(SERVER).toContain("const SERVER_VERSION = '0.73.0'")
    expect(WRITES).toContain('if (ops && hasSmallEdits(ops)) return { ok: false, error: shape }')
    expect(WRITES).toContain('if (ops) p.ops = sectionOpsForRpc(ops)')
  })

  it('names both ops on both planners, and in the docs', () => {
    expect(SERVER.split("{ op: 'prepend_section', heading, markdown } | { op: 'replace_text', heading, find, replace }] (at most 20)")).toHaveLength(3)
    expect(SERVER).toContain('prepend_section { heading, markdown } puts new lines straight under a heading')
    expect(SERVER).toContain('refused, naming the count, when the run is absent or occurs more than once there')
    expect(SERVER).toContain('since 0.69.0 a line set under a heading or one run of text swapped inside a section')
    expect(README).toContain('`prepend_section`')
    expect(README).toContain('`replace_text`')
    expect(README).toContain('v2.6949 / 0.69.0')
    expect(HR).toContain('`prepend_section`')
    expect(HR).toContain('`replace_text`')
    expect(EDGE).toContain('devMcpDocEdits.ts')
  })
})
