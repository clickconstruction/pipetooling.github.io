import { describe, expect, it } from 'vitest'
import { clipNote, CREW_FOLDS_KEY, crewBlockLabel, crewFolds, crewQuietLine, crewSheetRows, keepCrewFolds, lastNoteWords, readCrewFolds, type CrewNoteSource } from './jobWindowCrewPhone'
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
    expect(crewFolds({ accounts: false, parts: false })).toEqual(['notes', 'plans'])
    expect(crewFolds({ accounts: true, parts: false })).toEqual(['notes', 'plans', 'accounts'])
    expect(crewFolds({ accounts: true, parts: true })).toEqual(['notes', 'plans', 'accounts', 'parts'])
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
