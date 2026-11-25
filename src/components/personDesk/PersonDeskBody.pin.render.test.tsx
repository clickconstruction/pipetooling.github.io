// @vitest-environment jsdom
/**
 * The Person Desk's body on a phone (punch list #365). The simulator's walk of 2026-11-25 measured the pinned head
 * at about 445 of 874 points, with the sections scrolling in what was left. In a phone's drawer the head and the
 * sections now share one scrolling box, and the head is told to pin its name row. At a desk, and on the People page,
 * the head stands outside the sections' own box as it did. The head and the sections are stood in for: this holds
 * the frame, and `PersonDeskHeader.render.test.tsx` holds the head.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const screenIs = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => screenIs.phone }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, role: 'dev', readOnly: false }) }))
vi.mock('../../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ isDev: true, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, canSeePushStatus: true }) }))
vi.mock('../../hooks/usePersonDesk', () => ({
  usePersonDesk: () => ({ key: { userId: 'u-kai', personId: 'p-kai', payName: 'Kai Moss', displayName: 'Kai Moss', isSub: false, gaps: [] }, user: { role: 'helpers' }, person: null, loading: false, error: null }),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('./PersonDeskHeader', () => ({ PersonDeskHeader: ({ pinName }: { pinName?: boolean }) => <div data-testid="head" data-pin={String(Boolean(pinName))} /> }))
vi.mock('./PersonDeskLifecycleModal', () => ({ PersonDeskLifecycleModal: () => null }))
vi.mock('./PersonDeskBringBackModal', () => ({ PersonDeskBringBackModal: () => null }))
vi.mock('./sections/PersonDeskPushSection', () => ({ PersonDeskPushSection: () => null }))
vi.mock('./sections/PersonDeskAccessSection', () => ({ PersonDeskAccessSection: () => null }))
vi.mock('./sections/PersonDeskHoursSection', () => ({ PersonDeskHoursSection: () => <section id="desk-hours" /> }))
vi.mock('./sections/PersonDeskPortalSection', () => ({ PersonDeskPortalSection: () => null }))
vi.mock('./sections/PersonDeskWorkOrdersSection', () => ({ PersonDeskWorkOrdersSection: () => null }))
vi.mock('./sections/PersonDeskPaySection', () => ({ PersonDeskPaySection: () => null }))
vi.mock('./sections/PersonDeskFieldSection', () => ({ PersonDeskFieldSection: () => null }))
vi.mock('./sections/PersonDeskWeekSection', () => ({ PersonDeskWeekSection: () => null }))
vi.mock('./sections/PersonDeskDashboardViewSection', () => ({ PersonDeskDashboardViewSection: () => null }))
vi.mock('./sections/PersonDeskBioSection', () => ({ PersonDeskBioSection: () => null }))
vi.mock('./sections/PersonDeskPaperworkSection', () => ({ PersonDeskPaperworkSection: () => null }))
vi.mock('./sections/PersonDeskRecordsSection', () => ({ PersonDeskRecordsSection: () => null }))
vi.mock('./sections/PersonDeskScheduleSection', () => ({ PersonDeskScheduleSection: () => null }))

import { PersonDeskBody } from './PersonDeskBody'

afterEach(() => {
  cleanup()
  screenIs.phone = false
})

const draw = (variant: 'drawer' | 'page') => render(<PersonDeskBody payload={{ userId: 'u-kai', displayName: 'Kai Moss' }} changeKey={0} onChanged={() => {}} onClose={() => {}} variant={variant} />)
const head = () => document.querySelector<HTMLElement>('[data-testid="head"]')!
const sections = () => document.getElementById('desk-hours')!.parentElement as HTMLElement

describe('PersonDeskBody, where the head scrolls', () => {
  it('in a phone’s drawer the head and the sections share one scrolling box, and the head pins its name row', () => {
    screenIs.phone = true
    draw('drawer')
    const box = document.querySelector<HTMLElement>('[data-desk-scroll]')!
    expect(box.style.overflow).toBe('auto')
    expect(box.style.flex).toContain('1')
    expect(box.contains(head())).toBe(true)
    expect(box.contains(sections())).toBe(true)
    expect(head().getAttribute('data-pin')).toBe('true')
    // The sections no longer scroll in a box of their own under the head.
    expect(sections().style.overflow).toBe('')
  })

  it('in a desk’s drawer the head stands above the sections’ own scrolling box, as before', () => {
    draw('drawer')
    expect(document.querySelector('[data-desk-scroll]')).toBeNull()
    expect(head().getAttribute('data-pin')).toBe('false')
    expect(sections().style.overflow).toBe('auto')
    expect(sections().contains(head())).toBe(false)
  })

  it('on the People page nothing pins, on a phone or at a desk: the page scrolls', () => {
    screenIs.phone = true
    draw('page')
    expect(document.querySelector('[data-desk-scroll]')).toBeNull()
    expect(head().getAttribute('data-pin')).toBe('false')
    expect(sections().style.overflow).toBe('')
  })
})
