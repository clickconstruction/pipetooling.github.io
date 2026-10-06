// @vitest-environment jsdom
/**
 * Fix it from the paper (v2.4719): the property window opens on the pressed blank and says
 * when it will add the job address as the property; the GC window lists the desk's GCs, never
 * lets the job's customer be picked, and Esc closes it alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import LienPaperPropertyWindow from './LienPaperPropertyWindow'
import LienPaperGcWindow from './LienPaperGcWindow'
import type { LienDeskJob } from '../../hooks/useLienDeskData'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const job: LienDeskJob = {
  id: 'j838',
  hcp_number: '838',
  click_number: null,
  job_name: 'Bruce Hall',
  job_address: '1200 Ilka Rd, Seguin, TX 78155',
  customer_id: 'c-bruce',
  customer_name: 'Bruce Hall',
  gc_customer_id: null,
  customer_address_id: null,
  revenue: 1000,
  payments_made: 0,
  master_user_id: null,
  last_work_date: null,
}

describe('LienPaperPropertyWindow', () => {
  it('says it will keep the job address as the property, focuses the pressed blank, and Discard closes without saving', async () => {
    const onClose = vi.fn()
    await renderSettled(<LienPaperPropertyWindow job={job} address={null} ownerOnJob={false} focus="legal" onClose={onClose} />, { loaded: () => screen.getByTestId('lien-paper-property-new') })
    expect(screen.getByTestId('lien-paper-property-new').textContent).toContain('1200 Ilka Rd, Seguin, TX 78155 as a property on the customer')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Property legal description')
    fireEvent.click(screen.getByTestId('lien-paper-property-discard'))
    expect(onClose).toHaveBeenCalledWith(false)
  })
})

describe('LienPaperGcWindow', () => {
  it('lists the desk’s GCs, keeps the customer out of reach, and Esc closes it alone', async () => {
    const onClose = vi.fn()
    const knownGcs = [
      { id: 'g2', name: 'Seguin Custom Homes', address: 'Seguin, TX' },
      { id: 'c-bruce', name: 'Bruce Hall', address: '' },
      { id: 'g1', name: 'Hill Country Builders LLC', address: 'Austin, TX' },
    ]
    await renderSettled(<LienPaperGcWindow job={job} knownGcs={knownGcs} onClose={onClose} />, { loaded: () => screen.getByTestId('lien-paper-gc-options') })
    const opts = Array.from(screen.getByTestId('lien-paper-gc-options').querySelectorAll('button'))
    expect(opts.map((b) => b.textContent)).toEqual(['Bruce Hallthe customer on this job', 'Hill Country Builders LLCAustin, TX', 'Seguin Custom HomesSeguin, TX'])
    expect(opts[0]!.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Find the GC'), { target: { value: 'hill' } })
    expect(screen.getByTestId('lien-paper-gc-options').querySelectorAll('button')).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith(false)
  })
})
