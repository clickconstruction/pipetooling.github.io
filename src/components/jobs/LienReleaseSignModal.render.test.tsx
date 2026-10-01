// @vitest-environment jsdom
/**
 * The signing pad is drawn inside the Release of Lien window's backdrop. A click outside the pad
 * closes the pad only — before v2.4338 it carried on to the window behind and closed that too.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienReleaseSignModal from './LienReleaseSignModal'
import type { JobLienReleaseRow } from '../../lib/jobs/lienReleaseTracking'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return null } } }))

const RELEASE = {
  id: 'r1',
  job_id: 'j1',
  form_type: 'conditional_progress',
  status: 'awaiting_signature',
  amount: 100,
  invoice_ids: ['b1'],
  voided_at: null,
  created_at: '2026-10-01T18:00:00Z',
  signer_user_id: 'master-1',
  fields: { amount: '100', companyName: 'Click Plumbing and Electrical', projectDescription: 'ZZ TEST', checkFrom: 'Owner', throughDate: '2026-09-30', signedDate: '2026-10-01', signerName: 'Malachi Whites', signerTitle: '' },
} as unknown as JobLienReleaseRow

afterEach(cleanup)

describe('LienReleaseSignModal', () => {
  it('a click outside the pad closes the pad, not the window it sits in', () => {
    const onClose = vi.fn()
    const windowBehind = vi.fn()
    renderWithProviders(
      <div onClick={windowBehind}>
        <LienReleaseSignModal open onClose={onClose} release={RELEASE} jobNumber="1054" presentSigner={{ id: 'master-1', name: 'Malachi Whites' }} deviceUserName="Taunya" />
      </div>,
    )
    fireEvent.click(screen.getByRole('dialog', { name: 'Sign release of lien' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(windowBehind).not.toHaveBeenCalled()
  })

  it('a click inside the pad closes nothing', () => {
    const onClose = vi.fn()
    const windowBehind = vi.fn()
    renderWithProviders(
      <div onClick={windowBehind}>
        <LienReleaseSignModal open onClose={onClose} release={RELEASE} jobNumber="1054" presentSigner={{ id: 'master-1', name: 'Malachi Whites' }} deviceUserName="Taunya" />
      </div>,
    )
    fireEvent.click(screen.getByText('Malachi Whites signs here — Job 1054'))
    expect(onClose).not.toHaveBeenCalled()
    expect(windowBehind).not.toHaveBeenCalled()
  })
})
