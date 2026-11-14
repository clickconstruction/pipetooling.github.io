// @vitest-environment jsdom
/**
 * Render-smoke tests for the estimator's pay terms on a job draft (punch list #323, the owner's
 * call of 2026-11-13): one line of small words until pressed, the calendar's own choices in
 * place with whose the terms are, one line again after Done, and nothing kept after Leave it
 * out. Every name is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../utils/dateUtils', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-13' }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import DraftPayTermsPart from './DraftPayTermsPart'
import type { DraftPayTerms } from '../../lib/jobs/draftPayTerms'

installDomShims()

const TERMS: DraftPayTerms = { scope: 'job', calendar: { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: '' } }

describe('DraftPayTermsPart', () => {
  it('starts as one small line with the press, and no field', () => {
    renderWithProviders(<DraftPayTermsPart gcName="Larkfield Construction" value={null} onChange={vi.fn()} />)
    expect(screen.getByTestId('draft-pay-terms-line').textContent).toBe('+ Add their pay termsif they pay on a set day of the month')
    expect(screen.queryByLabelText('Bills must be in by')).toBeNull()
  })

  it('opens in place on this job, says the dates back, and hands the terms over on Done', () => {
    const onChange = vi.fn()
    renderWithProviders(<DraftPayTermsPart gcName="Larkfield Construction" value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add their pay terms' }))
    expect(screen.getByRole('radio', { name: 'Only this job' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Every job Larkfield Construction pays' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.change(screen.getByLabelText('Bills must be in by'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Clause number'), { target: { value: ' § 5.2 ' } })
    expect(screen.getByTestId('draft-pay-terms-preview').textContent).toBe('A bill in by Nov 25 is due Dec 10.A bill in on Nov 26 is due Jan 10.')
    // An estimator reads no payment: the part never draws the record.
    expect(screen.queryByText(/Their record against this/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onChange).toHaveBeenCalledWith(TERMS)
    expect(screen.queryByLabelText('Bills must be in by')).toBeNull()
  })

  it('reads as one line once it holds terms, and Change opens them again', () => {
    renderWithProviders(<DraftPayTermsPart gcName="Larkfield Construction" value={{ ...TERMS, scope: 'payer' }} onChange={vi.fn()} />)
    expect(screen.getByTestId('draft-pay-terms-line').textContent).toBe('In by the 25th, paid the 10thevery job they payChange')
    fireEvent.click(screen.getByRole('button', { name: 'Change their pay terms' }))
    expect(screen.getByRole('radio', { name: 'Every job Larkfield Construction pays' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Bills must be in by') as HTMLSelectElement).value).toBe('25')
  })

  it('Leave it out hands back nothing', () => {
    const onChange = vi.fn()
    renderWithProviders(<DraftPayTermsPart gcName="Larkfield Construction" value={TERMS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change their pay terms' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave it out' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
