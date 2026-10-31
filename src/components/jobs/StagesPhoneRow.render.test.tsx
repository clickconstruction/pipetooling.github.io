// @vitest-environment jsdom
/**
 * The phone Pipeline row's development door (v2.6204): the house and the name lead the second line and
 * open the development's page; a press on it does not open the job. Made-up rows; nothing is real.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobNextLine } from '../../lib/jobs/jobNextLine'
import { StagesPhoneRow } from './StagesPhoneRow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const NEXT: JobNextLine = { line: 'open 2 mo', chip: null, needsMe: false, today: false }

describe('StagesPhoneRow development door', () => {
  it('names the development on the second line as a door to its page, and the press does not open the job', () => {
    const onOpen = vi.fn()
    const job = makeJob({ job_name: 'Lot 14 rough-in', customer_name: 'Harlow Ranch LLC', development: { id: 'dev-harlow', name: 'Harlow Ranch' } })
    renderWithProviders(<StagesPhoneRow job={job} next={NEXT} busy={false} flash={false} advance={null} onOpen={onOpen} onChip={() => {}} onMore={() => {}} />)
    const door = document.querySelector('a[data-nav="development-page"]')
    expect(door?.getAttribute('href')).toBe('/developments/dev-harlow')
    expect(door?.textContent).toContain('Harlow Ranch')
    expect(door?.getAttribute('aria-label')).not.toMatch(/Harlow/)
    expect(door?.hasAttribute('data-phone-row-chip')).toBe(true)
    fireEvent.click(door!)
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByText('open 2 mo')).toBeTruthy()
    fireEvent.click(screen.getByText('open 2 mo'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('draws the next line alone when the job has no development', () => {
    const job = makeJob({ job_name: 'Lot 14 rough-in', development: null })
    renderWithProviders(<StagesPhoneRow job={job} next={NEXT} busy={false} flash={false} advance={null} onOpen={() => {}} onChip={() => {}} onMore={() => {}} />)
    expect(document.querySelector('a[data-nav="development-page"]')).toBeNull()
    expect(screen.getByText('open 2 mo')).toBeTruthy()
  })
})
