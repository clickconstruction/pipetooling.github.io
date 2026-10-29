import { describe, expect, it } from 'vitest'
import { CLOCK_OUT_NOTE_FILLED_LINE, CLOCK_OUT_REVIEW_TITLE, clockOutDayReports, clockOutNoteFromReports, clockOutReportLine } from './clockOutNote'

const status = (over: Partial<Parameters<typeof clockOutReportLine>[0]> = {}) => ({
  jobLabel: 'PLUM 512 · Whitfield water heater',
  templateName: 'Status Report',
  fieldValues: { 'How complete is the job?': '45', 'What is the status of the job?': 'Heater set and strapped.', 'What needs to be done to get to the next stage?': 'Inspection Friday.' },
  createdAt: '2026-10-29T15:40:00.000Z',
  ...over,
})

describe('clockOutNote', () => {
  it('names the review and the line under a filled note', () => {
    expect(CLOCK_OUT_REVIEW_TITLE).toBe('Clock out')
    expect(CLOCK_OUT_NOTE_FILLED_LINE).toBe("Filled from today's reports. Edit it if you like.")
  })

  it('writes one line a report: the job, the stage moves or the percent, what got done', () => {
    expect(clockOutReportLine(status())).toBe('PLUM 512 · Whitfield water heater: 45% done. Heater set and strapped.')
    expect(
      clockOutReportLine(status({ fieldValues: { 'How complete is the job?': '38', 'Stage progress': 'Rough In 35% → 50% · job 32% → 38%', 'What is the status of the job?': 'Drain lines set in bath 2.' } })),
    ).toBe('PLUM 512 · Whitfield water heater: Rough In 35% → 50% · job 32% → 38%. Drain lines set in bath 2.')
  })

  it('names the kind of a report that is not a status, and finds the words in another field', () => {
    expect(clockOutReportLine(status({ templateName: 'Walk Report', fieldValues: { 'What did you see?': 'Slab cracked by the north wall.' } }))).toBe('PLUM 512 · Whitfield water heater · walk: Slab cracked by the north wall.')
    expect(clockOutReportLine(status({ templateName: 'Turnaway Report', fieldValues: { Reason: 'Not home.' } }))).toBe('PLUM 512 · Whitfield water heater · turnaway: Not home.')
    expect(clockOutReportLine(status({ jobLabel: null, templateName: null, fieldValues: { Notes: 'Shop day.' } }))).toBe('A job: Shop day.')
  })

  it('skips a signature and a bare number as the words, and says report filed with neither', () => {
    expect(clockOutReportLine(status({ fieldValues: { 'How complete is the job?': '100', Signature: 'data:image/png;base64,AAAA' } }))).toBe('PLUM 512 · Whitfield water heater: 100% done')
    expect(clockOutReportLine(status({ fieldValues: { Signature: 'data:image/png;base64,AAAA' } }))).toBe('PLUM 512 · Whitfield water heater: report filed')
    expect(clockOutReportLine(status({ fieldValues: null }))).toBe('PLUM 512 · Whitfield water heater: report filed')
  })

  it('cuts long words on a word with an ellipsis', () => {
    const long = 'Set the heater, strapped it, ran the flue, pressure tested the gas line, relit the pilot, cleaned up the garage and walked the homeowner through the shutoff and the relief valve twice.'
    const line = clockOutReportLine(status({ fieldValues: { 'What is the status of the job?': long } }))
    expect(line.length).toBeLessThan(200)
    expect(line.endsWith('…')).toBe(true)
    expect(line).not.toContain('relief valve twice')
  })

  it('joins the day’s reports in the order filed, a line said twice said once, and is empty with none', () => {
    const a = status({ createdAt: '2026-10-29T13:00:00.000Z', jobLabel: 'PLUM 498 · Baker St heater', fieldValues: { 'How complete is the job?': '100', 'What is the status of the job?': 'Done.' } })
    const b = status({ createdAt: '2026-10-29T15:40:00.000Z' })
    expect(clockOutNoteFromReports([b, a])).toBe('PLUM 498 · Baker St heater: 100% done. Done.\nPLUM 512 · Whitfield water heater: 45% done. Heater set and strapped.')
    expect(clockOutNoteFromReports([b, b])).toBe('PLUM 512 · Whitfield water heater: 45% done. Heater set and strapped.')
    expect(clockOutNoteFromReports([])).toBe('')
  })

  it('keeps the reports filed on the session’s day, oldest first', () => {
    const rows = [
      { createdAt: '2026-10-30T02:30:00.000Z', id: 'late' }, // 21:30 on 10-29 in the app's calendar
      { createdAt: '2026-10-29T13:00:00.000Z', id: 'early' },
      { createdAt: '2026-10-28T20:00:00.000Z', id: 'yesterday' },
      { createdAt: '2026-10-30T13:00:00.000Z', id: 'tomorrow' },
    ]
    expect(clockOutDayReports(rows, '2026-10-29').map((r) => r.id)).toEqual(['early', 'late'])
  })
})
