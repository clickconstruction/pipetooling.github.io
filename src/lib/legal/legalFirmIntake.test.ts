import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { EMPTY_LEGAL_FIRM_INTAKE, legalIntakeAnswerRows, legalIntakeHasAnswers, legalIntakeIntro, legalIntakeQuestions, legalIntakeSentWords, legalIntakeUnseen, LEGAL_INTAKE_TEXT_MAX, shapeLegalFirmIntake } from './legalFirmIntake'

describe('the firm’s answers (v2.4821)', () => {
  it('shapes whatever arrives: trims and caps the texts, drops a choice that is not ours, keeps the rules note only with changes', () => {
    expect(shapeLegalFirmIntake(null)).toEqual(EMPTY_LEGAL_FIRM_INTAKE)
    const long = 'x'.repeat(LEGAL_INTAKE_TEXT_MAX + 50)
    const s = shapeLegalFirmIntake({ needs: `  ${long}  `, fileWhere: ' Hays County, Precinct 2 ', efile: 'yes', constable: 'maybe', rules: 'signed', rulesNote: 'ignored', extra: 'x' })
    expect(s.needs).toHaveLength(LEGAL_INTAKE_TEXT_MAX)
    expect(s).toMatchObject({ fileWhere: 'Hays County, Precinct 2', efile: 'yes', constable: '', rules: 'signed', rulesNote: '' })
    expect(s).not.toHaveProperty('extra')
    expect(shapeLegalFirmIntake({ rules: 'changes', rulesNote: ' The month rule. ' })).toMatchObject({ rules: 'changes', rulesNote: 'The month rule.' })
    expect(legalIntakeHasAnswers(EMPTY_LEGAL_FIRM_INTAKE)).toBe(false)
    expect(legalIntakeHasAnswers({ ...EMPTY_LEGAL_FIRM_INTAKE, constable: 'depends' })).toBe(true)
  })

  it('reads each question with its answer for the office, a dash when unanswered', () => {
    const rows = legalIntakeAnswerRows({ ...EMPTY_LEGAL_FIRM_INTAKE, needs: 'The W-9.', efile: 'no', constable: 'depends', rules: 'changes', rulesNote: 'Holidays.' }, 'Acme')
    expect(rows.map((r) => [r.key, r.answer])).toEqual([
      ['needs', 'The W-9.'],
      ['fileWhere', '—'],
      ['efile', 'No'],
      ['constable', 'It depends'],
      ['rules', 'Changes needed'],
      ['rulesNote', 'Holidays.'],
    ])
    expect(rows[4]!.question).toBe('Have you read the Texas lien rules Acme follows?')
    expect(legalIntakeAnswerRows(EMPTY_LEGAL_FIRM_INTAKE, 'Acme').map((r) => r.key)).not.toContain('rulesNote')
  })

  it('words when and by whom, in the company’s day, and knows when the office has not read them', () => {
    expect(legalIntakeSentWords('2026-10-08T03:30:00Z', 'Ann Sample')).toBe('Sent Oct 7 by Ann Sample.')
    expect(legalIntakeSentWords('2026-10-07T15:00:00Z', ' ')).toBe('Sent Oct 7.')
    expect(legalIntakeSentWords(null, 'Ann')).toBe('')
    expect(legalIntakeUnseen({ intake_sent_at: null })).toBe(false)
    expect(legalIntakeUnseen({ intake_sent_at: '2026-10-07T15:00:00Z', intake_seen_at: null })).toBe(true)
    expect(legalIntakeUnseen({ intake_sent_at: '2026-10-07T15:00:00Z', intake_seen_at: '2026-10-07T14:00:00Z' })).toBe(true)
    expect(legalIntakeUnseen({ intake_sent_at: '2026-10-07T15:00:00Z', intake_seen_at: '2026-10-07T16:00:00Z' })).toBe(false)
  })

  it('every question and placeholder passes the plain-words rule', () => {
    const words = [legalIntakeIntro('Acme'), ...legalIntakeQuestions('Acme').flatMap((q) => [q.label, ...('placeholder' in q ? [q.placeholder] : [])])]
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})
