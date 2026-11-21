import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import {
  SHEET_FIELD_KEYS,
  SHEET_FIELD_NAMES,
  SHEET_JOB_BLANK,
  SHEET_NEW,
  SUB_NOT_USUAL,
  asksOutdated,
  coverPath,
  differsLine,
  fieldMark,
  fieldPath,
  freshKey,
  jobSheetMissing,
  layOver,
  mintKey,
  openPath,
  parseJobSheet,
  parseResolvedSheet,
  parseSheetDef,
  pathName,
  pruneJobSheet,
  sameJobsGetIt,
  sheetAsks,
  sheetDefProblems,
  sheetDiffers,
  sheetWords,
  startJobSheet,
  subtitleAsUsual,
  subtitleWith,
  usualFromJobExtra,
  usualFromJobField,
  usualHasCover,
  usualHeldWords,
  usualOffer,
  usualPublishPlan,
  usualWords,
  usualWordsOn,
  withJobCoverOff,
  withJobExtra,
  withJobExtraWords,
  withJobInsured,
  withJobInsuredAdded,
  withJobWords,
  withUsualCover,
  withUsualOpenLine,
  withUsualWords,
  withoutJobExtra,
  withoutJobInsured,
  withoutJobWords,
  withoutUsualCover,
  withoutUsualOpenLine,
  type JobSheet,
  type KeyMint,
  type SheetDef,
} from './sheet'

/** The first draft with made-up amounts typed in, as a usual that can be published. Not advice: the numbers are for the tests. */
const USUAL: SheetDef = {
  ...INSURANCE_SHEET_FIXTURE,
  cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })),
}

/** A made-up job run as the GC. */
const CEDAR = (): JobSheet => startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', insured: ['Pecan Ridge Holdings, Ltd.', 'Lone Oak Property Management, Inc.'] })

const asStored = (v: unknown): unknown => JSON.parse(JSON.stringify(v))

/** A key maker a test can read: 1, 2, 3. The app's own makes letters nobody was given before. */
const counting = (): KeyMint => {
  let n = 0
  return () => String(++n)
}

describe('reading a sheet out of the database', () => {
  it('reads the first draft back whole', () => {
    expect(parseSheetDef(asStored(INSURANCE_SHEET_FIXTURE))).toEqual({ ok: true, def: INSURANCE_SHEET_FIXTURE })
  })

  it('names every gap, and hands back no sheet', () => {
    expect(parseSheetDef(null)).toEqual({ ok: false, problems: ['The contents are not a sheet.'] })
    const parsed = parseSheetDef({ fields: { co: 'Acme Plumbing' }, open: [{ key: 'o1' }], cover: 'none' })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.problems).toContain('The sheet has no words for: The title.')
    expect(parsed.problems).toContain('Opening line 1 is not a line.')
    expect(parsed.problems).toContain('The sheet has no list of coverage lines.')
    expect(parsed.problems).not.toContain('The sheet has no words for: Your name at the top.')
  })

  it('reads a job’s part, and nothing from a value that is not one', () => {
    const job = withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9')
    expect(parseJobSheet(asStored(job))).toEqual(job)
    for (const bad of [null, [], {}, { ...job, insured: [1] }, { ...job, over: { a: 1 } }, { ...job, extra: [{ key: 'x1' }] }, { ...job, place: 4 }]) expect(parseJobSheet(bad)).toBeNull()
  })

  it('reads a resolved sheet back, and nothing from half of one', () => {
    const sheet = layOver(USUAL, CEDAR())
    expect(parseResolvedSheet(asStored(sheet))).toEqual(sheet)
    expect(parseResolvedSheet({ ...sheet, cover: [{ label: 'A' }] })).toBeNull()
    expect(parseResolvedSheet({ ...sheet, foot: undefined })).toBeNull()
    expect(parseResolvedSheet(null)).toBeNull()
  })
})

describe('the standing sheet', () => {
  it('names every field for the list and for a screen reader', () => {
    for (const k of SHEET_FIELD_KEYS) expect(SHEET_FIELD_NAMES[k].trim()).not.toBe('')
  })

  it('cannot be published while an amount is still the placeholder', () => {
    const problems = sheetDefProblems(INSURANCE_SHEET_FIXTURE)
    expect(problems).toHaveLength(5)
    expect(problems[0]).toBe('Commercial general liability has no amount yet.')
    expect(sheetDefProblems(USUAL)).toEqual([])
  })

  it('says what else stops it: an empty field, a new line never typed over, no coverage', () => {
    expect(sheetDefProblems(withUsualWords(USUAL, fieldPath('title'), '  '))).toEqual(['The title has no words.'])
    expect(sheetDefProblems(withUsualOpenLine(USUAL))).toEqual(['Opening line 4 has no words yet.'])
    expect(sheetDefProblems(withUsualCover(USUAL))).toEqual(['A coverage line has no name yet.', 'A coverage line has no amount yet.'])
    expect(sheetDefProblems({ ...USUAL, cover: [] })).toEqual(['The sheet asks for no coverage.'])
  })

  it('types over a field, an opening line and a coverage line by path', () => {
    expect(withUsualWords(USUAL, fieldPath('foot'), 'A new foot line.').fields.foot).toBe('A new foot line.')
    expect(withUsualWords(USUAL, openPath('o2'), 'A new second line.').open[1]).toEqual({ key: 'o2', text: 'A new second line.' })
    expect(withUsualWords(USUAL, coverPath('auto', 'limit'), 'Made-up amount 7').cover[1]?.limit).toBe('Made-up amount 7')
    expect(withUsualWords(USUAL, 'cover.nope.limit', 'x')).toEqual(USUAL)
    expect(withUsualWords(USUAL, 'nothing.here', 'x')).toBe(USUAL)
  })

  it('adds and removes a line, each new line on a key of its own', () => {
    const mint = counting()
    const more = withUsualOpenLine(withUsualOpenLine(USUAL, mint), mint)
    expect(more.open.map((l) => l.key)).toEqual(['o1', 'o2', 'o3', 'o-1', 'o-2'])
    expect(withoutUsualOpenLine(more, 'o2').open.map((l) => l.key)).toEqual(['o1', 'o3', 'o-1', 'o-2'])
    const cover = withUsualCover(USUAL, { label: 'Pollution liability', limit: 'Made-up amount 6' }, mint)
    expect(cover.cover[5]).toEqual({ key: 'c-3', label: 'Pollution liability', limit: 'Made-up amount 6' })
    expect(withoutUsualCover(cover, 'umb').cover.map((c) => c.key)).toEqual(['cgl', 'auto', 'wc', 'el', 'c-3'])
  })
})

describe('a line’s key is never given out twice', () => {
  it('gives a new line a key of its own after a line was removed, so a job’s old change does not land on it', () => {
    // The usual gains a line, a job changes its amount and leaves another job's copy of it off, and the usual drops it.
    const withLine = withUsualCover(USUAL, { label: 'Pollution liability', limit: 'Made-up amount 6' })
    const oldKey = withLine.cover[5]!.key
    const changed = withJobWords(withLine, CEDAR(), coverPath(oldKey, 'limit'), 'Made-up amount 60')
    const leftOff = withJobCoverOff(CEDAR(), oldKey, true)
    const dropped = withoutUsualCover(withLine, oldKey)
    // A new line comes onto the usual. It is another line, on another key.
    const again = withUsualCover(dropped, { label: 'Riggers liability', limit: 'Made-up amount 7' })
    const newKey = again.cover[5]!.key
    expect(newKey).not.toBe(oldKey)
    // The first job reads the new line as the usual has it, and the second job still asks for it.
    expect(layOver(again, changed).cover[5]).toEqual({ label: 'Riggers liability', limit: 'Made-up amount 7' })
    expect(layOver(again, leftOff).cover.map((c) => c.label)).toContain('Riggers liability')
    expect(sheetDiffers(again, changed)).toEqual([])
    expect(sheetDiffers(again, leftOff)).toEqual([])
  })

  it('does the same for an opening line and for a line added on one job', () => {
    const more = withUsualOpenLine(USUAL)
    const oldKey = more.open[3]!.key
    const job = withJobWords(more, CEDAR(), openPath(oldKey), 'This job’s own fourth line.')
    const again = withUsualOpenLine(withoutUsualOpenLine(more, oldKey))
    expect(again.open[3]!.key).not.toBe(oldKey)
    expect(layOver(again, job).open[3]).toBe(SHEET_NEW.line)
    const added = withJobExtra(CEDAR())
    expect(withJobExtra(withoutJobExtra(added, added.extra[0]!.key)).extra[0]!.key).not.toBe(added.extra[0]!.key)
  })

  it('makes every key apart from the last, and makes the letters again while they match a key in use', () => {
    const made = new Set(Array.from({ length: 200 }, () => freshKey([], 'c')))
    expect(made.size).toBe(200)
    expect([...made].every((k) => /^c-[0-9a-f-]{32,36}$/.test(k))).toBe(true)
    expect(mintKey()).not.toBe(mintKey())
    const letters = ['a', 'a', 'b']
    expect(freshKey(['c-a'], 'c', () => letters.shift() as string)).toBe('c-b')
    // A key is one piece of a path, so it holds no dot.
    expect(freshKey([], 'o')).not.toContain('.')
  })

  it('lets go, at a publish, of a job’s change to a line the usual no longer has', () => {
    let job = withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9')
    job = withJobWords(USUAL, job, openPath('o2'), 'This job’s own second line.')
    job = withJobCoverOff(withJobCoverOff(job, 'auto', true), 'el', true)
    const dropped = withoutUsualCover(withoutUsualCover(withoutUsualOpenLine(USUAL, 'o2'), 'umb'), 'auto')
    const pruned = pruneJobSheet(dropped, job)
    // What still differs is kept: the line it leaves off that the usual still asks for.
    expect(pruned.over).toEqual({})
    expect(pruned.off).toEqual(['el'])
    expect(pruneJobSheet(dropped, pruned)).toBe(pruned)
    // The page reads the same before and after: a change to a line that is gone was never on it.
    expect(layOver(dropped, pruned)).toEqual(layOver(dropped, job))
    expect(pruneJobSheet(USUAL, job)).toBe(job)
  })
})

describe('a field: its own words when it has any, else the usual', () => {
  it('reads the usual until the job changes it, and marks which it is', () => {
    const path = coverPath('umb', 'limit')
    const job = CEDAR()
    expect(sheetWords(USUAL, job, path)).toBe('Made-up amount 5')
    expect(fieldMark(job, path)).toBe('usual')
    const own = withJobWords(USUAL, job, path, 'Made-up amount 9')
    expect(sheetWords(USUAL, own, path)).toBe('Made-up amount 9')
    expect(fieldMark(own, path)).toBe('own')
    expect(sheetWords(USUAL, null, path)).toBe('Made-up amount 5')
    expect(fieldMark(null, path)).toBe('usual')
  })

  it('keeps only what differs: words typed back to the usual are not kept', () => {
    const path = fieldPath('foot')
    const own = withJobWords(USUAL, CEDAR(), path, 'This job’s own foot line.')
    expect(Object.keys(own.over)).toEqual([path])
    expect(withJobWords(USUAL, own, path, USUAL.fields.foot).over).toEqual({})
    expect(withoutJobWords(own, path).over).toEqual({})
    const same = CEDAR()
    expect(withoutJobWords(same, path)).toBe(same)
  })

  it('says what a path is in words', () => {
    expect(pathName(USUAL, fieldPath('co'))).toBe('Your name at the top')
    expect(pathName(USUAL, openPath('o2'))).toBe('Opening line 2')
    expect(pathName(USUAL, coverPath('wc', 'limit'))).toBe("Workers' compensation, its amount")
    expect(pathName(USUAL, coverPath('wc', 'label'))).toBe("Workers' compensation, its name")
    expect(usualWords(USUAL, openPath('gone'))).toBeUndefined()
  })
})

describe('what differs on a job', () => {
  it('lists the changed fields with the usual’s words, then what is left off, then what is added', () => {
    let job = withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9')
    job = withJobWords(USUAL, job, fieldPath('co'), 'Acme Plumbing of Cedar Park')
    job = withJobCoverOff(job, 'auto', true)
    job = withJobExtraWords(withJobExtra(job, counting()), 'x-1', 'label', 'Pollution liability')
    expect(sheetDiffers(USUAL, job)).toEqual([
      { kind: 'field', path: 'f.co', name: 'Your name at the top', usual: 'Acme Plumbing', words: 'Acme Plumbing of Cedar Park' },
      { kind: 'field', path: 'cover.umb.limit', name: 'Umbrella, its amount', usual: 'Made-up amount 5', words: 'Made-up amount 9' },
      { kind: 'off', coverKey: 'auto', name: 'Commercial auto liability' },
      { kind: 'extra', extraKey: 'x-1', name: 'Pollution liability' },
    ])
    expect(differsLine(4)).toBe('4 things differ on this job')
    expect(differsLine(1)).toBe('1 thing differs on this job')
    expect(differsLine(0)).toBe('This job is on your usual sheet')
  })

  it('leaves out a change to a line the usual no longer has', () => {
    const job = withJobWords(USUAL, CEDAR(), openPath('o2'), 'This job’s own second line.')
    expect(sheetDiffers(withoutUsualOpenLine(USUAL, 'o2'), job)).toEqual([])
  })

  it('puts a line back, and takes an added one off', () => {
    const off = withJobCoverOff(CEDAR(), 'umb', true)
    expect(off.off).toEqual(['umb'])
    expect(withJobCoverOff(off, 'umb', true).off).toEqual(['umb'])
    expect(withJobCoverOff(off, 'umb', false).off).toEqual([])
    const mint = counting()
    const added = withJobExtra(withJobExtra(CEDAR(), mint), mint)
    expect(added.extra.map((x) => x.key)).toEqual(['x-1', 'x-2'])
    expect(withoutJobExtra(added, 'x-1').extra.map((x) => x.key)).toEqual(['x-2'])
  })

  it('makes a job’s own words the usual: the standing sheet takes them, and the job keeps reading the same', () => {
    const path = coverPath('umb', 'limit')
    const job = withJobWords(USUAL, CEDAR(), path, 'Made-up amount 9')
    const made = usualFromJobField(USUAL, job, path)
    expect(usualWords(made, path)).toBe('Made-up amount 9')
    expect(layOver(made, job)).toEqual(layOver(USUAL, job))
    expect(usualFromJobField(USUAL, CEDAR(), path)).toBe(USUAL)
  })

  it('lets a job’s copy go once the usual reads the same, and no longer lists it', () => {
    const path = coverPath('umb', 'limit')
    const job = withJobWords(USUAL, CEDAR(), path, 'Made-up amount 9')
    const made = usualFromJobField(USUAL, job, path)
    expect(sheetDiffers(made, job)).toEqual([])
    expect(pruneJobSheet(made, job).over).toEqual({})
    expect(pruneJobSheet(USUAL, job)).toBe(job)
  })

  it('makes a line added for one job a usual line, once, and lets the job’s copy go', () => {
    const job = withJobExtraWords(withJobExtraWords(withJobExtra(CEDAR(), counting()), 'x-1', 'label', 'Pollution liability'), 'x-1', 'limit', 'Made-up amount 6')
    const made = usualFromJobExtra(USUAL, job, 'x-1', counting())
    expect(made.cover[made.cover.length - 1]).toEqual({ key: 'c-1', label: 'Pollution liability', limit: 'Made-up amount 6' })
    expect(usualHasCover(made, { label: 'Pollution liability', limit: 'Made-up amount 6' })).toBe(true)
    expect(usualFromJobExtra(made, job, 'x-1')).toBe(made)
    expect(usualFromJobExtra(USUAL, job, 'nope')).toBe(USUAL)
    const pruned = pruneJobSheet(made, job)
    expect(pruned.extra).toEqual([])
    expect(layOver(made, pruned).cover).toEqual(layOver(USUAL, job).cover)
  })
})

describe('the line under the title, made the usual', () => {
  const SUB = fieldPath('sub')
  /** A second made-up job, so the usual is read on a job that did not write the line. */
  const ELM = (): JobSheet => startJobSheet({ name: 'Elm Street Lofts', place: '12 Sample Avenue, Austin, TX 78701', insured: ['Elm Street Partners, LLC'] })

  it('goes to the usual with the job’s name as a blank, so no job reads a name twice', () => {
    const cedar = withJobWords(USUAL, CEDAR(), SUB, 'For every trade working on Cedar Park Medical Office')
    const made = usualFromJobField(USUAL, cedar, SUB)
    // The usual holds the words before the name, never the name.
    expect(made.fields.sub).toBe('For every trade working on')
    expect(made.fields.sub).not.toContain('Cedar Park')
    // The job that wrote it reads the same before the usual is published, and after its copy is let go.
    expect(layOver(made, cedar).subtitle).toBe('For every trade working on Cedar Park Medical Office')
    const pruned = pruneJobSheet(made, cedar)
    expect(pruned.over).toEqual({})
    expect(layOver(made, pruned).subtitle).toBe('For every trade working on Cedar Park Medical Office')
    // Another job reads the same line with its own name, once.
    expect(layOver(made, ELM()).subtitle).toBe('For every trade working on Elm Street Lofts')
  })

  it('keeps the blank where the job’s name was, when the name is not at the end', () => {
    const cedar = withJobWords(USUAL, CEDAR(), SUB, 'On Cedar Park Medical Office, for every trade')
    const made = usualFromJobField(USUAL, cedar, SUB)
    expect(made.fields.sub).toBe(`On ${SHEET_JOB_BLANK}, for every trade`)
    expect(layOver(made, pruneJobSheet(made, cedar)).subtitle).toBe('On Cedar Park Medical Office, for every trade')
    expect(layOver(made, ELM()).subtitle).toBe('On Elm Street Lofts, for every trade')
    expect(sheetDiffers(made, cedar)).toEqual([])
  })

  it('reads a usual line with the name at its end or in its blank, and round-trips a job’s line', () => {
    expect(subtitleWith('For subcontractors on', 'Elm Street Lofts')).toBe('For subcontractors on Elm Street Lofts')
    expect(subtitleWith(`${SHEET_JOB_BLANK}: what each trade carries`, 'Elm Street Lofts')).toBe('Elm Street Lofts: what each trade carries')
    for (const line of ['For subs on Elm Street Lofts', 'Elm Street Lofts', 'Elm Street Lofts, and again Elm Street Lofts', 'Two  spaces before  Elm Street Lofts']) {
      const usual = subtitleAsUsual(line, 'Elm Street Lofts')
      expect(usual).not.toBeNull()
      expect(usual).not.toContain('Elm Street')
      expect(subtitleWith(usual as string, 'Elm Street Lofts')).toBe(line)
    }
    expect(subtitleAsUsual('For every trade on the job', 'Elm Street Lofts')).toBeNull()
    expect(subtitleAsUsual('Anything', '')).toBeNull()
  })

  it('holds a line that does not say the job’s name, with the reason, and leaves the usual as it was', () => {
    const cedar = withJobWords(USUAL, CEDAR(), SUB, 'For every trade at the medical office')
    expect(usualOffer(USUAL, cedar, SUB)).toEqual({ kind: 'held', why: SUB_NOT_USUAL })
    expect(usualFromJobField(USUAL, cedar, SUB)).toBe(USUAL)
    expect(plainWordsFailures(SUB_NOT_USUAL)).toEqual([])
  })

  it('offers the press until the usual reads the same on this job, then says it is in the usual', () => {
    const cedar = withJobWords(USUAL, CEDAR(), SUB, 'For every trade working on Cedar Park Medical Office')
    expect(usualOffer(USUAL, cedar, SUB)).toEqual({ kind: 'offer' })
    expect(usualOffer(usualFromJobField(USUAL, cedar, SUB), cedar, SUB)).toEqual({ kind: 'in-usual' })
    const amount = withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9')
    expect(usualOffer(USUAL, amount, coverPath('umb', 'limit'))).toEqual({ kind: 'offer' })
  })

  it('does not keep a line typed back to what the usual reads on this job', () => {
    const cedar = withJobWords(USUAL, CEDAR(), SUB, 'For every trade working on Cedar Park Medical Office')
    expect(usualWordsOn(USUAL, cedar, SUB)).toBe('For subcontractors on Cedar Park Medical Office')
    expect(sheetDiffers(USUAL, cedar).map((d) => (d.kind === 'field' ? d.usual : ''))).toEqual(['For subcontractors on Cedar Park Medical Office'])
    expect(withJobWords(USUAL, cedar, SUB, 'For subcontractors on Cedar Park Medical Office').over).toEqual({})
  })
})

describe('the page a sub reads', () => {
  it('lays the standing sheet over the job: its name, its place and who must be named', () => {
    const sheet = layOver(USUAL, CEDAR())
    expect(sheet.co).toBe('Acme Plumbing')
    expect(sheet.subtitle).toBe('For subcontractors on Cedar Park Medical Office')
    expect(sheet.insured).toEqual(['Pecan Ridge Holdings, Ltd.', 'Lone Oak Property Management, Inc.'])
    expect(sheet.place).toBe('410 Sample Street, Cedar Park, TX 78613')
    expect(sheet.open).toHaveLength(3)
    expect(sheet.cover.map((c) => c.label)).toEqual(['Commercial general liability', 'Commercial auto liability', "Workers' compensation", "Employer's liability", 'Umbrella'])
  })

  it('takes the job’s own words, leaves off what the job leaves off and adds what it adds', () => {
    let job = withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9')
    job = withJobWords(USUAL, job, fieldPath('sub'), 'For every trade at the Cedar Park job')
    job = withJobCoverOff(job, 'auto', true)
    job = withJobExtraWords(withJobExtraWords(withJobExtra(job, counting()), 'x-1', 'label', 'Pollution liability'), 'x-1', 'limit', 'Made-up amount 6')
    const sheet = layOver(USUAL, job)
    expect(sheet.subtitle).toBe('For every trade at the Cedar Park job')
    expect(sheet.cover).toEqual([
      { label: 'Commercial general liability', limit: 'Made-up amount 1' },
      { label: "Workers' compensation", limit: 'Made-up amount 3' },
      { label: "Employer's liability", limit: 'Made-up amount 4' },
      { label: 'Umbrella', limit: 'Made-up amount 9' },
      { label: 'Pollution liability', limit: 'Made-up amount 6' },
    ])
  })

  it('changes a name, adds one and takes one off', () => {
    const job = withJobInsured(CEDAR(), 1, 'Lone Oak Property Management, LLC')
    expect(job.insured[1]).toBe('Lone Oak Property Management, LLC')
    expect(withJobInsuredAdded(job).insured).toHaveLength(3)
    expect(withoutJobInsured(job, 0).insured).toEqual(['Lone Oak Property Management, LLC'])
  })

  it('starts a job’s sheet from the job, trimmed, with nothing changed', () => {
    expect(startJobSheet({ name: ' Mesa Verde Retail Shell ', place: ' 77 Placeholder Parkway ', insured: [' Mesa Verde Partners, LLC ', ' '] })).toEqual({ name: 'Mesa Verde Retail Shell', place: '77 Placeholder Parkway', insured: ['Mesa Verde Partners, LLC'], over: {}, off: [], extra: [] })
  })
})

describe('what is missing before a job’s sheet can be published', () => {
  it('is nothing for a filled job on a published usual', () => {
    expect(jobSheetMissing(CEDAR(), { def: USUAL, revision: 1 })).toEqual([])
  })

  it('needs the usual published first', () => {
    expect(jobSheetMissing(CEDAR(), { def: USUAL, revision: 0 })).toEqual(['Publish your usual sheet first.'])
  })

  it('needs the job’s name, its place and a name to insure', () => {
    const empty = startJobSheet({ name: '', place: '', insured: [] })
    expect(jobSheetMissing(empty, { def: USUAL, revision: 1 })).toEqual(['The job has no name on the sheet.', 'The sheet does not say where the work is.', 'Nobody is named as additional insured.'])
    expect(jobSheetMissing(withJobInsuredAdded(CEDAR()), { def: USUAL, revision: 1 })).toEqual(['A name to insure has no words yet.'])
  })

  it('needs an added line named and given an amount, and a changed field to have words', () => {
    expect(jobSheetMissing(withJobExtra(CEDAR()), { def: USUAL, revision: 1 })).toEqual(['An added coverage line has no name yet.', 'An added coverage line has no amount yet.'])
    expect(jobSheetMissing(withJobWords(USUAL, CEDAR(), fieldPath('title'), ' '), { def: USUAL, revision: 1 })).toEqual(['The title has no words.'])
  })

  it('needs the job to ask for something', () => {
    const none = USUAL.cover.reduce((job, c) => withJobCoverOff(job, c.key, true), CEDAR())
    expect(jobSheetMissing(none, { def: USUAL, revision: 1 })).toEqual(['This job asks for no coverage.'])
  })
})

describe('the asks: what a certificate is checked against', () => {
  it('is each name, the place, the holder and each coverage with its amount', () => {
    expect(sheetAsks(layOver(USUAL, CEDAR()))).toEqual([
      'It names Pecan Ridge Holdings, Ltd. as additional insured.',
      'It names Lone Oak Property Management, Inc. as additional insured.',
      'It is for work at 410 Sample Street, Cedar Park, TX 78613.',
      'The certificate holder is Acme Plumbing.',
      'Commercial general liability: Made-up amount 1.',
      'Commercial auto liability: Made-up amount 2.',
      "Workers' compensation: Made-up amount 3.",
      "Employer's liability: Made-up amount 4.",
      'Umbrella: Made-up amount 5.',
    ])
  })

  it('leaves a certificate good after a change to the foot line or an opening line', () => {
    const checked = sheetAsks(layOver(USUAL, CEDAR()))
    expect(asksOutdated(checked, sheetAsks(layOver(withUsualWords(USUAL, fieldPath('foot'), 'A new foot line.'), CEDAR())))).toBe(false)
    expect(asksOutdated(checked, sheetAsks(layOver(USUAL, withJobWords(USUAL, CEDAR(), openPath('o1'), 'A new first line.'))))).toBe(false)
  })

  it('outdates a certificate after a change to an amount, a name, the place or the holder', () => {
    const checked = sheetAsks(layOver(USUAL, CEDAR()))
    const changed = (job: JobSheet, def: SheetDef = USUAL) => asksOutdated(checked, sheetAsks(layOver(def, job)))
    expect(changed(withJobWords(USUAL, CEDAR(), coverPath('umb', 'limit'), 'Made-up amount 9'))).toBe(true)
    expect(changed(withJobInsured(CEDAR(), 0, 'Pecan Ridge Holdings, LLC'))).toBe(true)
    expect(changed({ ...CEDAR(), place: '412 Sample Street, Cedar Park, TX 78613' })).toBe(true)
    expect(changed(CEDAR(), withUsualWords(USUAL, fieldPath('hName'), 'Acme Plumbing, LLC'))).toBe(true)
    expect(changed(withJobCoverOff(CEDAR(), 'umb', true))).toBe(true)
  })
})

describe('the usual’s publish', () => {
  it('goes to a job with a published sheet and nothing of its own waiting, as its next revision', () => {
    expect(
      usualPublishPlan([
        { id: 'cedar', name: 'Cedar Park Medical Office', revision: 2, changed: false },
        { id: 'mesa', name: 'Mesa Verde Retail Shell', revision: 0, changed: false },
        { id: 'pike', name: 'Pike Street Clinic', revision: 1, changed: true },
      ]),
    ).toEqual([
      { id: 'cedar', name: 'Cedar Park Medical Office', gets: true, asRevision: 3 },
      { id: 'mesa', name: 'Mesa Verde Retail Shell', gets: false, why: 'no-sheet' },
      { id: 'pike', name: 'Pike Street Clinic', gets: false, why: 'own-changes' },
    ])
  })

  it('says why a job is held', () => {
    expect(usualHeldWords('no-sheet')).toBe('Held. It has no sheet yet.')
    expect(usualHeldWords('own-changes')).toBe('Held. It has changes of its own waiting.')
    expect(usualHeldWords('moved')).toBe('Held. It changed somewhere else. Choose on its panel first.')
    for (const why of ['no-sheet', 'own-changes', 'moved'] as const) expect(plainWordsFailures(usualHeldWords(why))).toEqual([])
  })

  it('tells when two plans send the usual to the same jobs, whatever the order and whatever the held ones are held for', () => {
    const cedar = { id: 'cedar', name: 'Cedar Park Medical Office', gets: true as const, asRevision: 3 }
    const mesa = { id: 'mesa', name: 'Mesa Verde Retail Shell', gets: true as const, asRevision: 2 }
    const held = (why: 'no-sheet' | 'own-changes') => ({ id: 'pike', name: 'Pike Street Clinic', gets: false as const, why })
    expect(sameJobsGetIt([cedar, mesa, held('no-sheet')], [mesa, { ...cedar, asRevision: 4 }, held('own-changes')])).toBe(true)
    expect(sameJobsGetIt([cedar, mesa], [cedar])).toBe(false)
    expect(sameJobsGetIt([cedar], [cedar, mesa])).toBe(false)
    expect(sameJobsGetIt([cedar, held('no-sheet')], [{ id: 'cedar', name: cedar.name, gets: false, why: 'own-changes' }, { id: 'pike', name: 'Pike Street Clinic', gets: true, asRevision: 1 }])).toBe(false)
    expect(sameJobsGetIt([], [])).toBe(true)
  })

  it('holds a job the page has words of its own for, though its sheet as read has none waiting', () => {
    expect(
      usualPublishPlan([
        { id: 'cedar', name: 'Cedar Park Medical Office', revision: 2, changed: false, here: 'own-changes' },
        { id: 'mesa', name: 'Mesa Verde Retail Shell', revision: 1, changed: false, here: 'moved' },
        { id: 'pike', name: 'Pike Street Clinic', revision: 1, changed: true, here: 'moved' },
        { id: 'oak', name: 'Oak Hollow Offices', revision: 0, changed: false, here: 'moved' },
        { id: 'elm', name: 'Elm Street Lofts', revision: 4, changed: false, here: null },
      ]),
    ).toEqual([
      { id: 'cedar', name: 'Cedar Park Medical Office', gets: false, why: 'own-changes' },
      { id: 'mesa', name: 'Mesa Verde Retail Shell', gets: false, why: 'moved' },
      { id: 'pike', name: 'Pike Street Clinic', gets: false, why: 'moved' },
      { id: 'oak', name: 'Oak Hollow Offices', gets: false, why: 'no-sheet' },
      { id: 'elm', name: 'Elm Street Lofts', gets: true, asRevision: 5 },
    ])
  })
})

describe('the words', () => {
  it('reads in plain words: the first draft, the field names and the words a new line starts on', () => {
    const texts: string[] = [...Object.values(SHEET_FIELD_NAMES), ...Object.values(SHEET_NEW), ...INSURANCE_SHEET_FIXTURE.open.map((l) => l.text), ...INSURANCE_SHEET_FIXTURE.cover.map((c) => c.label), INSURANCE_SHEET_FIXTURE.fields.lead, INSURANCE_SHEET_FIXTURE.fields.foot, differsLine(2), usualHeldWords('no-sheet'), usualHeldWords('own-changes')]
    texts.push(...sheetAsks(layOver(USUAL, CEDAR())), ...jobSheetMissing(startJobSheet({ name: '', place: '', insured: [] }), { def: USUAL, revision: 0 }), ...sheetDefProblems(INSURANCE_SHEET_FIXTURE))
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('sets no amount in the first draft: every one is the placeholder', () => {
    expect(INSURANCE_SHEET_FIXTURE.cover.every((c) => c.limit === SHEET_NEW.coverLimit)).toBe(true)
    expect(JSON.stringify(INSURANCE_SHEET_FIXTURE)).not.toMatch(/\$|\d{3},\d{3}/)
  })
})
