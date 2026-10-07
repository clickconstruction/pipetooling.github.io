/**
 * Main's own tests for papers sent from a company window (the owner, 2026-10-04; the Board's B2-i):
 * the sends of one paper, the line on its row, Activity's words, the days to pick, the first send's
 * lines in the trade's language, the next step and its log line, run through the kernels on the test
 * data. The spike's own case: Kendall Air's master agreement went out Sep 29 and is not signed.
 */
import { describe, expect, it } from 'vitest'
import { firstSendLines, paperDayChoices, paperSendActivity, paperSendLog, paperSendsFor, paperSentWords, paperStep } from './paperSend'
import { initialGcState } from './schedule/testState'
import type { GcState, PaperSend } from './types'

const SENDS: PaperSend[] = [
  { id: 'ps-1', partnerId: 'kendall', paper: 'msa', on: '2026-09-28', by: '2026-10-05', note: 'Sign it before the job starts.', first: true },
  { id: 'ps-2', partnerId: 'kendall', paper: 'msa', on: '2026-10-02', by: '2026-10-09', note: '', first: false },
  { id: 'ps-3', partnerId: 'voltage', paper: 'insurance', on: '2026-10-01', by: '2026-10-08', note: '', first: false },
]
const withSends = (s: GcState): GcState => ({ ...s, paperSends: SENDS })

describe('send a paper', () => {
  it('finds the sends of one paper and says the newest on its row', () => {
    const s = withSends(initialGcState())
    expect(paperSendsFor(s, 'kendall', 'msa').map((x) => x.id)).toEqual(['ps-1', 'ps-2'])
    expect([paperSentWords(s, 'kendall', 'msa'), paperSentWords(s, 'voltage', 'insurance'), paperSentWords(initialGcState(), 'kendall', 'msa')]).toEqual([
      'Reminded today · sign by Fri Oct 9.',
      'Asked yesterday · send by Thu Oct 8.',
      null,
    ])
    expect(SENDS.map((x) => paperSendActivity(s, x))).toEqual([
      'We sent the master agreement to sign, by Mon Oct 5. "Sign it before the job starts."',
      'We reminded them to sign the master agreement, by Fri Oct 9.',
      'We asked for their insurance certificate, by Thu Oct 8.',
    ])
  })

  it('offers three days to pick from today', () => {
    expect(paperDayChoices('2026-10-02')).toEqual([
      { on: '2026-10-05', label: 'Mon Oct 5' },
      { on: '2026-10-09', label: 'Fri Oct 9 · a week' },
      { on: '2026-10-16', label: 'Fri Oct 16' },
    ])
  })

  it('the first send’s day and note ride in the trade’s email, in its language', () => {
    const s = withSends(initialGcState())
    expect(firstSendLines(s, 'kendall', 'msa', undefined, 'en')).toEqual(['Please sign it by Mon Oct 5.', 'Sign it before the job starts.'])
    expect(firstSendLines(s, 'kendall', 'msa', undefined, 'es')).toEqual(['Por favor fírmelo a más tardar el lun 5 oct.', 'Sign it before the job starts.'])
    expect(firstSendLines(initialGcState(), 'kendall', 'msa', undefined, 'en')).toEqual([])
  })

  it('a master agreement sent and not signed takes a reminder, and its log line says so', () => {
    const s = initialGcState()
    const kendall = s.partners.find((p) => p.id === 'kendall')!
    const step = paperStep(s, kendall, 'msa')!
    expect([step.mode, step.verb, step.history]).toEqual(['reminder', 'Remind them', 'First sent Sep 29, 3 days ago. This is the first reminder.'])
    expect(paperSendLog(kendall, step, '2026-10-09')).toBe('Reminded Kendall Air to sign the master agreement by Fri Oct 9.')
  })
})
