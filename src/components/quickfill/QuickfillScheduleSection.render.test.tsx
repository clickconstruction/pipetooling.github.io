// @vitest-environment jsdom
/**
 * Render smoke for the Day on a phone (v2.3884): the section mounts in agenda
 * mode with the Crews · Office · Free chips in its sticky bar and without the
 * hide-assistants toggle; on a desktop the chips are not drawn.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillScheduleSection } from './QuickfillScheduleSection'

const narrow = { on: true }
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => narrow.on }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

beforeAll(installDomShims)
afterEach(cleanup)

describe('QuickfillScheduleSection · the Day on a phone', () => {
  it('draws the three chips in the bar, opens where anyone is, and has no hide toggle', async () => {
    narrow.on = true
    renderWithProviders(<QuickfillScheduleSection hideConflictPrompt />)
    await settle()
    const bar = document.querySelector('[data-day-phone-bar]') as HTMLElement
    expect(bar).toBeTruthy()
    expect([...bar.querySelectorAll('[data-day-phone-chip]')].map((c) => c.textContent?.trim())).toEqual(['Crews 0', 'Office 0', 'Free 0'])
    expect(bar.querySelector('[aria-label="Hide assistants and estimators"]')).toBeNull()
    const office = bar.querySelector('[data-day-phone-chip="office"]') as HTMLElement
    fireEvent.click(office)
    expect(office.getAttribute('aria-pressed')).toBe('true')
  })

  it('draws no chips on a desktop', async () => {
    narrow.on = false
    renderWithProviders(<QuickfillScheduleSection hideConflictPrompt />)
    await settle()
    expect(document.querySelector('[data-day-phone-chip]')).toBeNull()
  })
})
