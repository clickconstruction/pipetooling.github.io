import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  LIEN_UNVOID_APPLIED,
  LIEN_UNVOID_WORDS,
  lienUnvoidAnswer,
  lienUnvoidConfirm,
  lienUnvoidDoneWords,
  lienUnvoidDrawn,
  lienUnvoidFacts,
  lienUnvoidKindWords,
  lienUnvoidProblem,
  lienVoidedRecords,
  type LienUnvoidRecord,
} from './lienFilingUnvoid'

/** Made-up rows. */
const record = (over: Partial<LienUnvoidRecord> = {}): LienUnvoidRecord => ({
  id: 'r1',
  kind: 'notice_53_056',
  by_hand: false,
  voided_at: '2026-11-24T20:00:00Z',
  applied_from: null,
  created_at: '2026-11-23T18:00:00Z',
  filed_at: null,
  months_covered: ['2026-08'],
  ...over,
})
const ZZ = { job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

describe('lienUnvoidDrawn', () => {
  it('is a dev on a ZZ test job, and nobody else', () => {
    expect(lienUnvoidDrawn('dev', ZZ)).toBe(true)
    expect(lienUnvoidDrawn('dev', { job_name: 'Larkfield Lot 9', customer_name: 'zz test customer' })).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) {
      expect(lienUnvoidDrawn(role, ZZ)).toBe(false)
    }
  })

  it('is never a real job, or no job', () => {
    expect(lienUnvoidDrawn('dev', REAL)).toBe(false)
    expect(lienUnvoidDrawn('dev', null)).toBe(false)
    expect(lienUnvoidDrawn('dev', undefined)).toBe(false)
  })
})

describe('lienVoidedRecords', () => {
  it('holds every kind once it is voided, newest void first, and no live record', () => {
    const rows = [
      record({ id: 'old', voided_at: '2026-11-20T10:00:00Z' }),
      record({ id: 'live', voided_at: null }),
      record({ id: 'aff', kind: 'affidavit', voided_at: '2026-11-25T10:00:00Z' }),
      record({ id: 'ret', kind: 'retainage_53_057', voided_at: '2026-11-22T10:00:00Z' }),
      record({ id: 'rel', kind: 'release_of_record', voided_at: '2026-11-21T10:00:00Z' }),
    ]
    expect(lienVoidedRecords(rows).map((r) => r.id)).toEqual(['aff', 'ret', 'rel', 'old'])
    expect(lienVoidedRecords([])).toEqual([])
  })
})

describe('lienUnvoidProblem', () => {
  it('lets a voided record through to the database', () => {
    expect(lienUnvoidProblem(record())).toBe('')
    expect(lienUnvoidProblem(record({ kind: 'affidavit' }))).toBe('')
  })

  it('refuses a record that is gone, a live record and a record that applied a paper already on record', () => {
    expect(lienUnvoidProblem(null)).toBe('The record is not there any more. Read the window again.')
    expect(lienUnvoidProblem(undefined)).toBe('The record is not there any more. Read the window again.')
    expect(lienUnvoidProblem(record({ voided_at: null }))).toBe('This record is not voided.')
    expect(lienUnvoidProblem(record({ applied_from: 'other' }))).toBe('This record applied a paper already on record. Undo was its take-back. It stays voided.')
    expect(LIEN_UNVOID_APPLIED).toBe('This record applied a paper already on record. Undo was its take-back. It stays voided.')
  })
})

describe('lienUnvoidKindWords', () => {
  it('names each kind as the Lien window does', () => {
    expect(lienUnvoidKindWords(record())).toBe('§ 53.056 notice')
    expect(lienUnvoidKindWords(record({ by_hand: true }))).toBe('§ 53.056 notice, recorded by hand')
    expect(lienUnvoidKindWords(record({ by_hand: true, applied_from: 'other' }))).toBe('§ 53.056 notice, applied from a paper on record')
    expect(lienUnvoidKindWords(record({ kind: 'retainage_53_057' }))).toBe('§ 53.057 retainage notice')
    expect(lienUnvoidKindWords(record({ kind: 'affidavit' }))).toBe('Lien affidavit')
    expect(lienUnvoidKindWords(record({ kind: 'release_of_record' }))).toBe('Release of record')
    expect(lienUnvoidKindWords(record({ kind: 'something_new' }))).toBe('Lien record')
  })
})

describe('lienUnvoidFacts', () => {
  it('reads a notice as what it is, its months, the day it was recorded and the day it was voided', () => {
    expect(lienUnvoidFacts(record({ months_covered: ['2026-08', '2026-09'] }))).toEqual([
      { label: 'Record', value: '§ 53.056 notice' },
      { label: 'Covers', value: '2026-08, 2026-09' },
      { label: 'Recorded', value: 'Mon, Nov 23' },
      { label: 'Voided', value: 'Tue, Nov 24' },
    ])
  })

  it('reads an affidavit with the day the clerk filed it, and no months', () => {
    expect(lienUnvoidFacts(record({ kind: 'affidavit', filed_at: '2026-11-16', months_covered: ['2026-08'] }))).toEqual([
      { label: 'Record', value: 'Lien affidavit' },
      { label: 'Filed', value: 'Mon, Nov 16' },
      { label: 'Recorded', value: 'Mon, Nov 23' },
      { label: 'Voided', value: 'Tue, Nov 24' },
    ])
  })

  it('leaves out a fact with no value', () => {
    expect(lienUnvoidFacts(record({ kind: 'release_of_record', months_covered: [], created_at: 'not a day', filed_at: '2026-11-16' }))).toEqual([
      { label: 'Record', value: 'Release of record' },
      { label: 'Voided', value: 'Tue, Nov 24' },
    ])
  })

  it('reads a day in the company’s time zone, never the instant’s first ten characters', () => {
    // 03:30 UTC on Nov 25 is the evening of Nov 24 in the company's zone.
    expect(lienUnvoidFacts(record({ voided_at: '2026-11-25T03:30:00Z' })).find((f) => f.label === 'Voided')?.value).toBe('Tue, Nov 24')
  })
})

describe('lienUnvoidConfirm', () => {
  it('names the act on its button and says what comes back for a record whose void moves a paper', () => {
    for (const kind of ['notice_53_056', 'affidavit']) {
      expect(lienUnvoidConfirm({ kind })).toEqual({
        title: 'Put this record back?',
        message: 'The record stands live on this job again. A paper its void put back on the Lien desk goes to sent again, tied to this record. A paper its void set aside stands again.',
        confirmLabel: 'Put the record back',
      })
    }
  })

  it('says nothing of a paper for a record whose void moves none', () => {
    for (const kind of ['retainage_53_057', 'release_of_record']) {
      expect(lienUnvoidConfirm({ kind }).message).toBe('The record stands live on this job again.')
      expect(lienUnvoidConfirm({ kind }).confirmLabel).toBe('Put the record back')
    }
  })
})

describe('lienUnvoidAnswer', () => {
  it('reads the two counts off an ok answer', () => {
    expect(lienUnvoidAnswer({ ok: true, job_id: 'j1', kind: 'notice_53_056', papers_restored: 1, papers_unset_aside: 0 })).toEqual({ restored: 1, unsetAside: 0 })
    expect(lienUnvoidAnswer({ ok: true, papers_restored: '2', papers_unset_aside: '1' })).toEqual({ restored: 2, unsetAside: 1 })
  })

  it('is null for anything that is not an ok answer with both counts', () => {
    for (const bad of [null, undefined, '', 'ok', [], [{ ok: true }], {}, { ok: false, papers_restored: 1, papers_unset_aside: 0 }, { ok: true }, { ok: true, papers_restored: 1 }, { ok: true, papers_restored: -1, papers_unset_aside: 0 }, { ok: true, papers_restored: 'many', papers_unset_aside: 0 }]) {
      expect(lienUnvoidAnswer(bad)).toBeNull()
    }
  })
})

describe('lienUnvoidDoneWords', () => {
  it('says the record is back, and what became of its papers', () => {
    expect(lienUnvoidDoneWords({ restored: 0, unsetAside: 0 })).toBe('The record is back.')
    expect(lienUnvoidDoneWords({ restored: 1, unsetAside: 0 })).toBe('The record is back. Its paper on the Lien desk is sent again, tied to it.')
    expect(lienUnvoidDoneWords({ restored: 2, unsetAside: 0 })).toBe('The record is back. Its 2 papers on the Lien desk are sent again, tied to it.')
    expect(lienUnvoidDoneWords({ restored: 0, unsetAside: 1 })).toBe('The record is back. The paper its void set aside stands again.')
    expect(lienUnvoidDoneWords({ restored: 1, unsetAside: 3 })).toBe('The record is back. Its paper on the Lien desk is sent again, tied to it. The 3 papers its void set aside stand again.')
  })
})

describe('the words a person reads', () => {
  it('follow the plain-words rules, every sentence', () => {
    const words = [
      LIEN_UNVOID_WORDS.lede,
      LIEN_UNVOID_WORDS.notDone,
      LIEN_UNVOID_WORDS.noAnswer,
      LIEN_UNVOID_APPLIED,
      lienUnvoidProblem(null),
      lienUnvoidProblem(record({ voided_at: null })),
      lienUnvoidConfirm({ kind: 'notice_53_056' }).title,
      lienUnvoidConfirm({ kind: 'notice_53_056' }).message,
      lienUnvoidConfirm({ kind: 'release_of_record' }).message,
      lienUnvoidDoneWords({ restored: 2, unsetAside: 2 }),
      lienUnvoidDoneWords({ restored: 1, unsetAside: 1 }),
      // The database's own refusals, shown as they stand.
      'Only a developer can put a voided record back.',
      'Only a record on a test job can be put back. This job is a real one.',
      'The paper this record sent has moved on since the void. The record stays voided.',
      'This record was voided before the app kept what a void does to its desk paper. It stays voided.',
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })

  it('name the press and its busy word', () => {
    expect(LIEN_UNVOID_WORDS.heading).toBe('Voided records')
    expect(LIEN_UNVOID_WORDS.press).toBe('Put back…')
    expect(LIEN_UNVOID_WORDS.busy).toBe('Putting back…')
  })
})
