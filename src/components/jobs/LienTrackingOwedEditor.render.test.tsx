// @vitest-environment jsdom
/**
 * "Add the number" (v2.4119): one input per certified send with a blank
 * number, the shape hint as it is typed, Save disabled until something is
 * typed; nothing drawn when every send has its number.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienTrackingOwedEditor from './LienTrackingOwedEditor'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

describe('LienTrackingOwedEditor', () => {
  it('draws the owed recipient with a shape-checked input; nothing when nothing is owed', () => {
    const { container } = renderWithProviders(
      <LienTrackingOwedEditor filing={{ id: 'f1', sends: [{ recipient: 'original_contractor', method: 'certified_mail', tracking: '' }, { recipient: 'owner', method: 'certified_mail', tracking: '9407 1118 9876 5432 1098' }] }} onSaved={() => {}} />,
    )
    expect(screen.getByText('tracking owed')).toBeTruthy()
    expect(screen.getByText(/Original contractor · certified mail/)).toBeTruthy()
    const input = screen.getByLabelText('Tracking number — Original contractor')
    const save = screen.getByRole('button', { name: /add the number/ }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '9407 1118 9876' } })
    expect(screen.getByText('12 digits — a certified number has 20')).toBeTruthy()
    fireEvent.change(input, { target: { value: '9407 1118 9876 5432 1098' } })
    expect(screen.getByText(/20 digits · certified/)).toBeTruthy()
    expect(save.disabled).toBe(false)
    container.remove()
    const { container: c2 } = renderWithProviders(<LienTrackingOwedEditor filing={{ id: 'f2', sends: [{ recipient: 'owner', method: 'email', tracking: 'resend:x' }] }} onSaved={() => {}} />)
    expect(c2.querySelector('[data-testid="lien-tracking-owed"]')).toBeNull()
  })
})
