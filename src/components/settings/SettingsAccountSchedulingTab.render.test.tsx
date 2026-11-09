// @vitest-environment jsdom
/**
 * Settings → Your account → the pointer *Everyone's salaried workday* (punch list #188, row 17): the owner reads it as a
 * dev does, and an assistant who is not salaried sees no workday section at all.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import SettingsAccountSchedulingTab from './SettingsAccountSchedulingTab'

function draw(myRole: 'dev' | 'master_technician' | 'assistant') {
  return renderWithProviders(
    <SettingsAccountSchedulingTab
      authUser={{ id: 'u1' }}
      myProfileName="Pat"
      myRole={myRole}
      salaryWorkdaySectionOpen={false}
      selfIsSalariedInPayConfig={false}
      selfPaySalaryLoaded={true}
      setSalaryWorkdaySectionOpen={() => {}}
    />,
  )
}

describe('SettingsAccountSchedulingTab — the salaried workday pointer', () => {
  it('the owner reads the pointer to People → Users → Pay', () => {
    const { container } = draw('master_technician')
    // first paint
    expect(container.textContent).toContain('Everyone’s salaried workday')
    expect(container.querySelector('a[href="/people?tab=users&lens=pay"]')).not.toBeNull()
    cleanup()
  })
  it('a dev reads it too', () => {
    const { container } = draw('dev')
    // first paint
    expect(container.textContent).toContain('Everyone’s salaried workday')
    cleanup()
  })
  it('an assistant who is not salaried sees no workday section', () => {
    const { container } = draw('assistant')
    // first paint
    expect(container.textContent).not.toContain('Everyone’s salaried workday')
    expect(container.querySelector('#settings-salary-workday')).toBeNull()
    cleanup()
  })
})
