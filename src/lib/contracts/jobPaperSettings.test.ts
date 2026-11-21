import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  JOB_SETTINGS_WORDS,
  SEAL_WORDS,
  cleanPicks,
  cleanTyped,
  paperSeal,
  picksChange,
  readKeptJobSettings,
  readRuleProblem,
  requireProblem,
  sealHolds,
  sealText,
  settingsChangePlan,
  type SettingsChange,
} from './jobPaperSettings'
import { parseSettingsDef, type SettingsDef } from './paperSettings'
import { plainWordsFailures } from '../plainWords'

/** Every word here is a made-up placeholder. No clause wording is in this file. */
const DEF = parseSettingsDef({
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [{ key: 'off', label: 'Off', out: true }, { key: 'standard', label: 'Standard' }, { key: 'strict', label: 'Strict' }] },
    { key: 'term', label: 'How long secrecy lasts', choices: [{ key: 'short', label: 'Short' }, { key: 'long', label: 'Long' }] },
  ],
  fields: [{ key: 'party', label: 'Protected party' }],
  levels: [],
}) as SettingsDef
const subtle = webcrypto.subtle as unknown as SubtleCrypto
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261120163000_settings_on_the_job.sql'), 'utf8')

describe('a paper is required with settings, or without', () => {
  it('takes settings on an entry built from them', () => {
    expect(requireProblem({ name: 'Sample NDA', def: DEF }, { settings: { photos: 'standard', term: 'short' } })).toBeNull()
  })
  it('refuses such an entry bare, and names a setting left unpicked', () => {
    expect(requireProblem({ name: 'Sample NDA', def: DEF }, null)).toBe('Sample NDA is built from settings. Require it with its settings.')
    expect(requireProblem({ name: 'Sample NDA', def: DEF }, { settings: 'standard' })).toBe('Sample NDA is built from settings. Require it with its settings.')
    expect(requireProblem({ name: 'Sample NDA', def: DEF }, { settings: { photos: 'standard' } })).toBe('Pick How long secrecy lasts.')
    expect(requireProblem({ name: 'Sample NDA', def: DEF }, { settings: { photos: 'loud', term: 'short' } })).toBe('Pick Photos and video.')
  })
  it('refuses settings on a plain entry, which is required as before with none', () => {
    expect(requireProblem({ name: 'Site rules', def: null }, { settings: { photos: 'off' } })).toBe('Site rules is not built from settings. It takes none.')
    expect(requireProblem({ name: 'Site rules', def: null }, null)).toBeNull()
    expect(requireProblem({ name: 'Site rules', def: null }, undefined)).toBeNull()
  })
  it('keeps a pick for each setting on the list and nothing else, and typed blanks trimmed', () => {
    expect(cleanPicks(DEF, { photos: 'strict', term: 'long', badges: 'on', n: 3 })).toEqual({ photos: 'strict', term: 'long' })
    expect(cleanPicks(DEF, 'strict')).toEqual({})
    expect(cleanTyped(DEF, { party: '  Ridgeway Sample Holdings ', nope: 'x' })).toEqual({ party: 'Ridgeway Sample Holdings' })
    expect(cleanTyped(DEF, { party: '   ' })).toBeNull()
    expect(cleanTyped(DEF, null)).toBeNull()
  })
})

describe('the lock at the first signature', () => {
  const base: SettingsChange = {
    def: DEF,
    from: { picks: { photos: 'standard', term: 'short' }, typed: null, bookRevision: 4 },
    to: { picks: { photos: 'standard', term: 'short' }, typed: null, bookRevision: 4 },
    signed: 0,
  }
  const to = (picks: Record<string, string>, more: Partial<SettingsChange['to']> = {}) => ({ ...base.to, picks, ...more })

  it('says nothing changed for the same picks, blanks and Book revision, signed or not', () => {
    expect(settingsChangePlan(base)).toEqual({ kind: 'nothing', change: 'same', words: 'Nothing changed.' })
    expect(settingsChangePlan({ ...base, signed: 3 }).kind).toBe('nothing')
    expect(settingsChangePlan({ ...base, to: to({ photos: 'standard', term: 'short', badges: 'on' }, { typed: { party: ' ' } }) }).kind).toBe('nothing')
  })
  it('changes the row in place until someone signs, whichever way the change goes', () => {
    expect(settingsChangePlan({ ...base, to: to({ photos: 'off', term: 'short' }) })).toEqual({ kind: 'saved', change: 'looser' })
    expect(settingsChangePlan({ ...base, to: to({ photos: 'strict', term: 'short' }) })).toEqual({ kind: 'saved', change: 'stricter' })
    expect(settingsChangePlan({ ...base, to: to({ photos: 'off', term: 'long' }) })).toEqual({ kind: 'saved', change: 'mixed' })
  })
  it('after a signature, a stricter change makes the next row and says who signs again', () => {
    expect(settingsChangePlan({ ...base, signed: 2, to: to({ photos: 'strict', term: 'long' }) })).toEqual({ kind: 'revised', change: 'stricter', signAgain: 2 })
  })
  it('after a signature, a looser or a mixed change is refused, with the way to a looser paper', () => {
    expect(settingsChangePlan({ ...base, signed: 1, to: to({ photos: 'off', term: 'short' }) })).toEqual({ kind: 'refused', change: 'looser', words: JOB_SETTINGS_WORDS.stricterOnly })
    expect(settingsChangePlan({ ...base, signed: 1, to: to({ photos: 'strict', term: 'short' }), from: { ...base.from, picks: { photos: 'standard', term: 'long' } } }).kind).toBe('refused')
  })
  it('after a signature, the same picks with new typed words or at a newer Book revision make the next row too', () => {
    expect(settingsChangePlan({ ...base, signed: 1, to: to(base.from.picks, { typed: { party: 'Ridgeway Sample Group' } }) })).toEqual({ kind: 'revised', change: 'same', signAgain: 1 })
    expect(settingsChangePlan({ ...base, signed: 1, to: to(base.from.picks, { bookRevision: 5 }) })).toEqual({ kind: 'revised', change: 'same', signAgain: 1 })
  })
  it('refuses picks that cannot put a paper together before anything else', () => {
    expect(settingsChangePlan({ ...base, to: to({ photos: 'strict' }) })).toMatchObject({ kind: 'refused', words: 'Pick How long secrecy lasts.' })
  })
  it('reads which way a change goes by each choice’s place in its list', () => {
    expect(picksChange(DEF, { photos: 'off', term: 'short' }, { photos: 'standard', term: 'short' })).toBe('stricter')
    expect(picksChange(DEF, { photos: 'strict', term: 'long' }, { photos: 'standard', term: 'long' })).toBe('looser')
    expect(picksChange(DEF, null, { photos: 'off', term: 'short' })).toBe('same')
    expect(picksChange(DEF, { photos: 'standard', term: 'short' }, null)).toBe('mixed')
  })
})

describe('the read-revision rule', () => {
  const read = { name: 'Sample NDA', revision: 4, readRevision: 4 }
  const unread = { name: 'Sample NDA', revision: 5, readRevision: 4 }
  const never = { name: 'Sample NDA', revision: 5, readRevision: null }
  it('lets any job take the revision an attorney read', () => {
    expect(readRuleProblem(read, { job_name: 'Cedar Bluff Lofts' })).toBeNull()
  })
  it('lets only a ZZ Test job take a revision nobody has read', () => {
    expect(readRuleProblem(unread, { job_name: 'Cedar Bluff Lofts' })).toBe('Sample NDA has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.')
    expect(readRuleProblem(never, { job_name: 'Cedar Bluff Lofts', customer_name: 'Ridgeway Sample Holdings' })).toBe(JOB_SETTINGS_WORDS.unread('Sample NDA'))
    expect(readRuleProblem(unread, { job_name: ' zz Test walk' })).toBeNull()
    expect(readRuleProblem(never, { job_name: 'Walk', customer_name: 'ZZ Test customer' })).toBeNull()
  })
  it('takes no paper with no clause published, on any job', () => {
    expect(readRuleProblem({ name: 'Sample NDA', revision: 0, readRevision: null }, { job_name: 'ZZ Test walk' })).toBe('Sample NDA has no clause yet. Write it in Contracts and clauses first.')
  })
})

describe('the seal', () => {
  const paper = {
    paperId: 'paper-1',
    revision: 3,
    lang: 'en',
    settings: { term: 'short', photos: 'standard' },
    fields: { party: 'Ridgeway Sample Holdings' },
    clauses: [{ id: 'c1', v: 1, n: 1, text: 'Fixed placeholder one.' }],
    exhibit: [],
    exhibitFor: [],
  }
  it('writes each piece as its length in bytes, a colon, the piece and a comma', () => {
    expect(sealText({ paperId: 'p', lang: 'es', settings: { a: 'x' }, fields: {}, clauses: [{ id: 'c', v: 2, n: 1, text: 'año' }], exhibit: [], exhibitFor: ['Sitework'] })).toBe(
      '13:paper-seal-v1,1:p,2:es,10:settings 1,1:a,1:x,8:fields 0,9:clauses 1,1:c,1:2,1:1,4:año,9:exhibit 0,12:exhibitFor 1,8:Sitework,',
    )
  })
  it('is stable for the same settings and clause versions: key order, the revision and the heading do not move it', async () => {
    const again = { title: 'Sample NDA (job J900)', between: null, revision: 9, exhibitFor: [], exhibit: [], clauses: [{ text: 'Fixed placeholder one.', n: 1, v: 1, id: 'c1' }], fields: { party: 'Ridgeway Sample Holdings' }, settings: { photos: 'standard', term: 'short' }, lang: 'en', paperId: 'paper-1' }
    expect(await paperSeal(again, subtle)).toBe(await paperSeal(paper, subtle))
  })
  it('changes when a pick, a typed blank, a clause’s version, its words or the language changes', async () => {
    const seal = await paperSeal(paper, subtle)
    const others = [
      { ...paper, settings: { ...paper.settings, photos: 'strict' } },
      { ...paper, fields: { party: 'Ridgeway Sample Group' } },
      { ...paper, clauses: [{ ...paper.clauses[0], v: 2 }] },
      { ...paper, clauses: [{ ...paper.clauses[0], text: 'Fixed placeholder one, reworded.' }] },
      { ...paper, lang: 'es' },
    ]
    const seals = await Promise.all(others.map((o) => paperSeal(o, subtle)))
    expect(new Set([seal, ...seals]).size).toBe(others.length + 1)
    expect(seal).toMatch(/^[0-9a-f]{64}$/)
  })
  it('reads what a signed copy keeps, and says whether its words still match its seal', async () => {
    const sha256 = await paperSeal(paper, subtle)
    const kept = { ...paper, title: 'Sample NDA (job J900)', between: null, jobPaperId: 'row-1', settingsRevision: 2, said: [{ key: 'photos', label: 'Photos and video', choice: 'Standard', says: 'Placeholder line.', out: false }], sha256 }
    expect(readKeptJobSettings(kept)).toEqual({ picks: { term: 'short', photos: 'standard' }, typed: { party: 'Ridgeway Sample Holdings' }, said: kept.said, sha256, jobPaperId: 'row-1', settingsRevision: 2 })
    expect(await sealHolds(kept, subtle)).toBe(true)
    expect(await sealHolds({ ...kept, clauses: [{ ...paper.clauses[0], text: 'Another placeholder.' }] }, subtle)).toBe(false)
  })
  it('reads no settings on a copy that kept none: a plain paper, a clause paper signed before this, nothing at all', async () => {
    expect(readKeptJobSettings(null)).toBeNull()
    expect(readKeptJobSettings({ paperId: 'doc-msa', revision: 3, lang: 'en', clauses: [], exhibit: [], exhibitFor: [], title: 'MSA' })).toBeNull()
    expect(await sealHolds({ paperId: 'doc-msa', revision: 3, lang: 'en', clauses: [], exhibit: [], exhibitFor: [], title: 'MSA' }, subtle)).toBeNull()
  })
})

describe('the words', () => {
  it('are the database’s own', () => {
    for (const words of [JOB_SETTINGS_WORDS.nothingChanged, JOB_SETTINGS_WORDS.stricterOnly]) expect(MIGRATION).toContain(words)
    expect(MIGRATION).toContain("'% is built from settings. Require it with its settings.'")
    expect(MIGRATION).toContain("'% is not built from settings. It takes none.'")
    expect(MIGRATION).toContain("' has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.'")
    expect(MIGRATION).toContain("' has no clause yet. Write it in Contracts and clauses first.'")
  })
  it('read plainly', () => {
    for (const words of [JOB_SETTINGS_WORDS.needsSettings('Sample NDA'), JOB_SETTINGS_WORDS.takesNone('Site rules'), JOB_SETTINGS_WORDS.stricterOnly, JOB_SETTINGS_WORDS.unread('Sample NDA'), JOB_SETTINGS_WORDS.noClause('Sample NDA'), SEAL_WORDS.holds, SEAL_WORDS.broken]) {
      expect(plainWordsFailures(words)).toEqual([])
    }
  })
})
