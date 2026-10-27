// @vitest-environment jsdom
/**
 * Render smokes for the sign modal's code mode (v2.5924): with the present leader's code ready the
 * pad gives way to his cursive name and the code field; the right code signs through the IO and the
 * wrong one lands under the button with the tries left; with no code set the pad leads and no
 * switch link shows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import LienReleaseSignModal from './LienReleaseSignModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { JobLienReleaseRow } from '../../lib/jobs/lienReleaseTracking'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ user: { id: 'wendi-1' } })
})

vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return null
    }
  },
}))

const io = vi.hoisted(() => ({
  status: { set: true, setAtIso: '2026-10-23T00:00:00Z', lastUsedAtIso: null, lockedUntilIso: null } as unknown,
  statusFails: false,
  signResult: { ok: true, signedAtIso: '2026-10-26T19:14:00Z', printedName: 'Malachi Whites' } as unknown,
  signCalls: [] as Record<string, unknown>[],
}))

vi.mock('../../lib/jobs/lienDeskSignIo', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>
  return {
    ...actual,
    lienSignCodeStatus: async () => {
      if (io.statusFails) throw new Error('TypeError: fetch failed')
      return io.status
    },
  }
})

vi.mock('../../lib/jobs/lienReleaseSignIo', () => ({
  signLienRelease: vi.fn(),
  signLienReleaseWithCode: async (args: Record<string, unknown>) => {
    io.signCalls.push(args)
    return io.signResult
  },
}))

function release(): JobLienReleaseRow {
  return {
    id: 'rel-1',
    job_id: 'job-1',
    form_type: 'conditional_final',
    amount: 3800,
    status: 'awaiting_signature',
    fields: { companyName: 'Click Plumbing and Electrical', checkFrom: 'Southern Post Construction, LLC', amount: '3800', projectDescription: 'Take 5 Seguin', signerName: 'Malachi Whites', signerTitle: 'Owner' },
    voided_at: null,
    sent_to_customer_at: null,
    signed_at: null,
  } as unknown as JobLienReleaseRow
}

function renderModal() {
  return renderWithProviders(
    <LienReleaseSignModal
      open
      onClose={() => {}}
      release={release()}
      jobNumber="878"
      presentSigner={{ id: 'leader-1', name: 'Malachi Whites' }}
      deviceUserName="Wendi"
      onSigned={() => {}}
    />,
  )
}

beforeEach(() => {
  io.status = { set: true, setAtIso: '2026-10-23T00:00:00Z', lastUsedAtIso: null, lockedUntilIso: null }
  io.statusFails = false
  io.signResult = { ok: true, signedAtIso: '2026-10-26T19:14:00Z', printedName: 'Malachi Whites' }
  io.signCalls = []
})

describe('LienReleaseSignModal · his code (v2.5924)', () => {
  it('his code ready: the pad gives way to the cursive name, and the right code signs through the IO', async () => {
    renderModal()
    await settle()
    await screen.findByTestId('lien-release-code-foot')
    expect(screen.getByText('Malachi types his signing code')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Malachi types his signing code'), { target: { value: '2468' } })
    fireEvent.click(screen.getByLabelText(/I, Malachi Whites, have read this release/))
    fireEvent.click(screen.getByRole('button', { name: 'Sign it with his code' }))
    await waitFor(() => expect(io.signCalls.length).toBe(1))
    expect(io.signCalls[0]).toMatchObject({ releaseId: 'rel-1', signerUserId: 'leader-1', code: '2468', deviceUserName: 'Wendi' })
  })

  it('a wrong code lands under the button with the tries left', async () => {
    io.signResult = { ok: false, reason: 'wrong', message: 'That is not Malachi Whites’s code.', triesLeft: 3, lockedUntilIso: null }
    renderModal()
    await settle()
    await screen.findByTestId('lien-release-code-foot')
    fireEvent.change(screen.getByLabelText('Malachi types his signing code'), { target: { value: '1111' } })
    fireEvent.click(screen.getByLabelText(/I, Malachi Whites, have read this release/))
    fireEvent.click(screen.getByRole('button', { name: 'Sign it with his code' }))
    await screen.findByText(/That is not Malachi Whites’s code\. 3 tries left\./)
  })

  it('Draw instead brings the pad back', async () => {
    renderModal()
    await settle()
    await screen.findByTestId('lien-release-code-foot')
    fireEvent.click(screen.getByRole('button', { name: 'Draw instead' }))
    await waitFor(() => expect(screen.queryByTestId('lien-release-code-foot')).toBeNull())
    expect(screen.getByRole('button', { name: 'Malachi types his code instead' })).toBeTruthy()
  })

  it('a status read that fails leaves the pad leading, and nothing escapes as an unhandled rejection', async () => {
    io.statusFails = true
    renderModal()
    await settle()
    await settle()
    expect(screen.queryByTestId('lien-release-code-foot')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Malachi types his code instead' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign it' })).toBeTruthy()
  })

  it('no code set: the pad leads and nothing offers the code', async () => {
    io.status = { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null }
    renderModal()
    await settle()
    expect(screen.queryByTestId('lien-release-code-foot')).toBeNull()
    expect(screen.queryByText('Malachi types his signing code')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Malachi types his code instead' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign it' })).toBeTruthy()
  })
})
