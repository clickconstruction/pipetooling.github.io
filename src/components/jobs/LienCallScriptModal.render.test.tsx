// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LienCallScriptModal from './LienCallScriptModal'
import type { CallLetterFacts } from '../../lib/jobs/lienOwnerCallScript'

afterEach(cleanup)

const letter: CallLetterFacts = { jobLabel: '273 · Dudley (Lennox)', property: '1204 Lennox Dr, Austin, TX', ownerName: 'Dudley Lennox', gcName: 'RMC- Dudley Mason', us: 'Click', instrument: 'notice_53_056', letterKind: 'residential', mailedOn: '2026-09-08', amount: '$17,585.00', months: 'April, June, July and August 2026', signer: 'Malachi Whites, Master Plumber', phone: '(512) 360-0599', affidavitBy: '2026-11-16' }

describe('LienCallScriptModal (v2.4731)', () => {
  it('opens with the letter in hand and counsel’s line; a chip shows the next line; Record the call hands to the sheet', () => {
    const onRecord = vi.fn()
    render(<LienCallScriptModal facts={letter} jobLabel="273 · Dudley (Lennox)" hasLetter us="Click" onRecord={onRecord} onFindJob={() => {}} onPractice={() => {}} onClose={() => {}} />)
    expect(screen.getByTestId('lien-call-script').getAttribute('data-has-job')).toBe('yes')
    expect(screen.getByTestId('lien-call-script-sub').textContent).toBe('273 · Dudley (Lennox) · GC RMC- Dudley Mason · § 53.056 notice mailed Sep 8')
    expect(screen.getByTestId('lien-call-script-letter').textContent).toContain('mailed Sep 8 · claims $17,585.00 · for April, June, July and August 2026 · affidavit by Nov 16')
    expect(screen.getByTestId('lien-call-script-open').textContent).toContain('Thanks for calling about the notice on 1204 Lennox Dr.')
    expect(screen.queryByTestId('lien-call-script-next')).toBeNull()
    fireEvent.click(document.querySelector('[data-lien-call-script-opening="owes"]') as HTMLElement)
    expect(screen.getByTestId('lien-call-script-next').textContent).toContain('hold back $17,585.00')
    expect(screen.getByTestId('lien-call-script-next').textContent).toContain('§ 53.081 · § 53.101')
    fireEvent.click(screen.getByTestId('lien-call-script-record'))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })
  it('with no job under the reader the words still read, Find the job is the one door to search, and nothing can be recorded', () => {
    const onFindJob = vi.fn()
    const onClose = vi.fn()
    render(<LienCallScriptModal facts={null} jobLabel={null} hasLetter={false} us="Click" onRecord={() => {}} onFindJob={onFindJob} onPractice={() => {}} onClose={onClose} />)
    expect(screen.getByTestId('lien-call-script').getAttribute('data-has-job')).toBe('no')
    expect(screen.getByTestId('lien-call-script-open').textContent).toContain('the notice on your property')
    expect(screen.queryByTestId('lien-call-script-record')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-call-script-find'))
    expect(onFindJob).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
