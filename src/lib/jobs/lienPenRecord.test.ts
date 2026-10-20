import { describe, expect, it } from 'vitest'
import { penPageExtension, penPageFileProblem, penPagePath, penRecordProblems, penRecordedWords, penSignedAtIso, penWitnessHowWithPage } from './lienPenRecord'

describe('recording a pen signature (the pen train, PR 2)', () => {
  it('the day the office typed becomes noon in the app’s calendar, so it reads the same day everywhere', () => {
    expect(penSignedAtIso('2026-10-09')).toBe('2026-10-09T17:00:00.000Z') // CDT, UTC-5
    expect(penSignedAtIso('2026-12-09')).toBe('2026-12-09T18:00:00.000Z') // CST, UTC-6
    expect(penSignedAtIso('not a day')).toBeNull()
  })

  it('the signed page is an image or a PDF up to 15 MB, filed beside the drawn signatures', () => {
    expect(penPageFileProblem({ type: 'image/jpeg', size: 2_000_000 })).toBeNull()
    expect(penPageFileProblem({ type: 'application/pdf', size: 2_000_000 })).toBeNull()
    expect(penPageFileProblem({ type: 'text/plain', size: 10 })).toMatch(/image or a PDF/)
    expect(penPageFileProblem({ type: 'image/png', size: 16 * 1024 * 1024 })).toMatch(/over 15 MB/)
    expect(penPageExtension('image/jpeg')).toBe('jpg')
    expect(penPageExtension('application/pdf')).toBe('pdf')
    expect(penPageExtension('image/heic')).toBe('heic')
    expect(penPageExtension('application/octet-stream')).toBe('bin')
    expect(penPagePath('it1', 'u-1', 'image/png')).toBe('desk/it1/pen-u-1.png')
  })

  it('a photo makes the page the fact, whatever the office picked', () => {
    expect(penWitnessHowWithPage('watched', false)).toBe('watched')
    expect(penWitnessHowWithPage('told', true)).toBe('page')
  })

  it('the toast names the count, who signed when, and who wrote it down', () => {
    expect(penRecordedWords({ count: 3, leaderName: 'Robert Douglas', dayWords: 'October 9', how: 'watched', recorderName: 'Taunya' })).toBe('Recorded 3 pen signatures · Robert Douglas signed October 9 · written down by Taunya, who watched him sign.')
    expect(penRecordedWords({ count: 1, leaderName: '', dayWords: 'October 9', how: 'told', recorderName: null })).toBe('Recorded 1 pen signature · the leader signed October 9 · written down by the office, who was told by him that he had signed.')
  })

  it('refuses a day after today, a day before the print, no notices and no leader, in that order', () => {
    const ok = { ymd: '2026-10-09', todayYmd: '2026-10-12', printedYmd: '2026-10-09', ticked: 2, leaderName: 'Robert Douglas' }
    expect(penRecordProblems(ok)).toEqual([])
    expect(penRecordProblems({ ...ok, ymd: '2026-10-13' })).toEqual(['The day he signed cannot be after today.'])
    expect(penRecordProblems({ ...ok, ymd: '2026-10-08' })).toEqual(['The paper printed 2026-10-09. He cannot have signed it before that.'])
    expect(penRecordProblems({ ...ok, ymd: '' })).toEqual(['Type the day he signed.'])
    expect(penRecordProblems({ ...ok, ticked: 0, leaderName: ' ' })).toEqual(['The job has no leader to name. Set the job’s master first.', 'Tick at least one notice.'])
    expect(penRecordProblems({ ...ok, printedYmd: null, ymd: '2026-01-01' })).toEqual([])
  })
})
