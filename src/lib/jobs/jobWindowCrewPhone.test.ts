import { describe, expect, it } from 'vitest'
import { clipNote, CREW_FOLDS_KEY, CREW_WORK_FOLDS, crewBlockLabel, crewFolds, crewMaterialsWords, crewQuietLine, crewSheetRows, crewStageCard, keepCrewFolds, lastNoteWords, ourLeadWords, readCrewFolds, showsOurLead, type CrewNoteSource } from './jobWindowCrewPhone'
import type { StageProgressRow } from '../reports/stageProgressReport'
import type { JobWindowSheetDoors } from './jobWindowPhone'

describe('crewQuietLine', () => {
  it('reads the number, then the customer, and leaves out a part with nothing in it', () => {
    expect(crewQuietLine({ number: '1042', customer: 'Ridgeway Builders' })).toEqual(['1042', 'Ridgeway Builders'])
    expect(crewQuietLine({ number: ' ', customer: 'Ridgeway Builders' })).toEqual(['Ridgeway Builders'])
    expect(crewQuietLine({ number: null, customer: undefined })).toEqual([])
  })
})

describe('crewBlockLabel', () => {
  it('says Next on site for today and ahead, Was scheduled once the day has passed', () => {
    expect(crewBlockLabel('2026-11-15', '2026-11-15')).toBe('Next on site')
    expect(crewBlockLabel('2026-11-20', '2026-11-15')).toBe('Next on site')
    expect(crewBlockLabel('2026-11-14', '2026-11-15')).toBe('Was scheduled')
  })
})

describe('lastNoteWords', () => {
  const now = '2026-11-15T18:00:00Z'
  const note = (body: string, author: string | null, at: string): CrewNoteSource => ({ kind: 'note', body, author, at })

  it('reads the newest note with who wrote it and when', () => {
    const words = lastNoteWords([note('Rough in passed.', 'Luis Ortega', '2026-11-10T15:00:00Z'), note('Trim caps ordered.', 'Dana Reyes', '2026-11-14T15:00:00Z')], now)
    expect(words).toEqual({ value: 'Trim caps ordered.', sub: 'Dana Reyes, yesterday' })
  })

  it('reads a report by its name, and a note with no author as Someone', () => {
    expect(lastNoteWords([{ kind: 'report', template: 'Status Report', author: 'Luis Ortega', at: '2026-11-14T15:00:00Z' }], now)).toEqual({ value: 'Status Report', sub: 'Luis Ortega, yesterday' })
    expect(lastNoteWords([note('Gate code is on the box.', null, '2026-11-14T15:00:00Z')], now)?.sub).toBe('Someone, yesterday')
  })

  it('is null with nothing written, or with a note that holds no words', () => {
    expect(lastNoteWords([], now)).toBeNull()
    expect(lastNoteWords([note('   ', 'Luis Ortega', '2026-11-14T15:00:00Z')], now)).toBeNull()
  })
})

describe('clipNote', () => {
  it('keeps a short note whole and folds its line breaks', () => {
    expect(clipNote('Gate code\nis on the box.')).toBe('Gate code is on the box.')
  })
  it('cuts a long note at a word and ends it in …', () => {
    const long = 'The homeowner asked for the old water heater to be hauled off and for the pad to be poured again before the trim set starts next week.'
    const cut = clipNote(long)
    expect(cut.length).toBeLessThanOrEqual(91)
    expect(cut.endsWith('…')).toBe(true)
    expect(long.startsWith(cut.slice(0, -1))).toBe(true)
    expect(cut.slice(0, -1).endsWith(' ')).toBe(false)
  })
})

describe('crewSheetRows', () => {
  const doors: JobWindowSheetDoors = { share: true, calendar: false, nextBlock: null, account: false, accountQuiet: null, money: false, paid: false, task: true, taskReady: true, change: false }
  it('names the doors open to this viewer and never the ? card', () => {
    expect(crewSheetRows(doors).map((r) => r.label)).toEqual(['Share the job', 'Send as a task'])
  })
  it('is empty when no door is open, so the ⋯ is not drawn', () => {
    expect(crewSheetRows({ ...doors, share: false, task: false })).toEqual([])
  })
})

describe('crewFolds', () => {
  it('gives everyone Notes and Plans, Job accounts once a house is listed, Parts cost to the roles that read it', () => {
    expect(crewFolds({ accounts: false, parts: false })).toEqual(['notes'])
    expect(crewFolds({ accounts: true, parts: false })).toEqual(['notes', 'accounts'])
    expect(crewFolds({ accounts: true, parts: true })).toEqual(['notes', 'accounts', 'parts'])
    // Plans moved up into Today's work, beside Materials on site.
    expect(CREW_WORK_FOLDS).toEqual(['plans', 'materials'])
  })
})

describe('the folds this phone keeps open', () => {
  it('keeps and reads them back, and forgets what it does not know', () => {
    const box: Record<string, string> = {}
    const storage = { getItem: (k: string) => box[k] ?? null, setItem: (k: string, v: string) => void (box[k] = v) }
    expect(readCrewFolds(storage)).toEqual(new Set())
    keepCrewFolds(new Set(['notes', 'parts']), storage)
    expect(readCrewFolds(storage)).toEqual(new Set(['notes', 'parts']))
    box[CREW_FOLDS_KEY] = JSON.stringify(['notes', 'money', 7])
    expect(readCrewFolds(storage)).toEqual(new Set(['notes']))
    box[CREW_FOLDS_KEY] = 'not json'
    expect(readCrewFolds(storage)).toEqual(new Set())
  })
})

const stage = (name: string, progressPct: number | null, over: Partial<StageProgressRow> = {}): StageProgressRow => ({ fixtureId: name, name, kind: 'order', sequenceOrder: 0, weightPct: 0, progressPct, drawPaid: false, ...over })

describe('crewStageCard', () => {
  it('draws no card for a job with fewer than two stages', () => {
    expect(crewStageCard(null)).toBeNull()
    expect(crewStageCard([])).toBeNull()
    expect(crewStageCard([stage('Bid price', 40, { weightPct: 100 })])).toBeNull()
  })

  it('names the first stage in order not yet done, and says where each stands', () => {
    const card = crewStageCard([stage('Rough In', 100, { weightPct: 40 }), stage('Top Out', 100, { weightPct: 30 }), stage('Trim Set', null, { weightPct: 30 })])
    expect(card).toEqual({ title: 'Trim Set', line: 'Rough In done · Top Out done · Trim Set open', pct: 70, allDone: false })
  })

  it('reads a stage under way by its number, and one behind it as not started', () => {
    const card = crewStageCard([stage('Rough In', 50, { weightPct: 40 }), stage('Top Out', null, { weightPct: 30 }), stage('Trim Set', null, { weightPct: 30 })])
    expect(card?.title).toBe('Rough In')
    expect(card?.line).toBe('Rough In 50% · Top Out not started · Trim Set not started')
    expect(card?.pct).toBe(20)
  })

  it('counts a paid draw as done', () => {
    const card = crewStageCard([stage('Rough In', null, { weightPct: 50, drawPaid: true }), stage('Top Out', null, { weightPct: 50 })])
    expect(card?.title).toBe('Top Out')
    expect(card?.line).toBe('Rough In done · Top Out open')
    expect(card?.pct).toBe(50)
  })

  it('counts the done ones on a long job instead of naming each', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].map((n, i) => stage(n, i < 2 ? 100 : null, { weightPct: 20 }))
    expect(crewStageCard(rows)?.line).toBe('2 of 5 done · C open')
  })

  it('says so when every stage is done', () => {
    expect(crewStageCard([stage('Rough In', 100, { weightPct: 50 }), stage('Trim Set', 100, { weightPct: 50 })])).toEqual({ title: 'Every stage is done', line: '2 of 2 done', pct: 100, allDone: true })
  })
})

describe('crewMaterialsWords', () => {
  it('says nothing before the read lands, then what is on the site', () => {
    expect(crewMaterialsWords({ loaded: false, containers: 0, lines: 0 })).toBe('')
    expect(crewMaterialsWords({ loaded: true, containers: 0, lines: 0 })).toBe('nothing yet')
    expect(crewMaterialsWords({ loaded: true, containers: 1, lines: 1 })).toBe('1 container · 1 line')
    expect(crewMaterialsWords({ loaded: true, containers: 3, lines: 14 })).toBe('3 containers · 14 lines')
  })
})

describe('who a sub calls', () => {
  it('is our lead for a sub alone', () => {
    expect(showsOurLead('subcontractor')).toBe(true)
    for (const role of ['helpers', 'superintendent', 'estimator', 'master_technician', null]) expect(showsOurLead(role)).toBe(false)
  })

  it('is the lead with their own number', () => {
    expect(ourLeadWords({ name: 'Dana Reyes', phone: '512 555 0100' }, '512 555 0199')).toEqual({ name: 'Dana Reyes', note: 'runs this job', phone: '512 555 0100' })
  })

  it('is the office’s number under the lead’s name when the lead has none on file', () => {
    expect(ourLeadWords({ name: 'Dana Reyes', phone: null }, '512 555 0199')).toEqual({ name: 'Dana Reyes', note: "runs this job · this is the office's number", phone: '512 555 0199' })
    expect(ourLeadWords({ name: 'Dana Reyes', phone: ' ' }, null)).toEqual({ name: 'Dana Reyes', note: 'runs this job', phone: '' })
  })

  it('is the office when the job has no lead on its team', () => {
    expect(ourLeadWords(null, '512 555 0199')).toEqual({ name: 'The office', note: 'no one of ours is on this job yet', phone: '512 555 0199' })
    expect(ourLeadWords(null, null).phone).toBe('')
  })
})
