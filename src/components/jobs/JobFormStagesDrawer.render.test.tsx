// @vitest-environment jsdom
/**
 * Render smoke for the drawer's Create-their-link door (Stage Plan residual 5,
 * v2.3517): shown only when the portal door is the sample AND the job has a GC;
 * pressing it mints through the shared helper and tells the parent to re-read
 * the GC's links. The card itself is covered by JobFormStagesGroup.render.test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobFormStagesDrawer } from './JobFormStagesDrawer'
import { stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { settle } from '../../test/renderSmokeMocks'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

afterEach(() => {
  cleanup()
  rpc.mockReset()
})

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough-in', count: 1, line_unit_price: 12465, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: true },
  { id: 'b', name: 'Top-out', count: 1, line_unit_price: 12465, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: true },
]
const plan = stagePlanFromForm({
  fixtures,
  windows: [{ id: 'w-a', fixture_id: 'a', window_start: '2026-09-01', window_end: '2026-09-05' }],
  orders: [],
  sheets: [],
  invoices: [],
  payments: [],
  todayYmd: '2026-09-09',
})

function renderDrawer(props: Partial<React.ComponentProps<typeof JobFormStagesDrawer>> = {}) {
  return render(
    <JobFormStagesDrawer
      open
      onClose={() => {}}
      plan={plan}
      gcName="Summit General"
      jobLabel="#1004 · 407 E 6th St"
      jobAddress={null}
      portalUrl="http://x/portal?t=sample-gc"
      portalIsSample
      zIndex={5}
      {...props}
    />,
  )
}

describe('JobFormStagesDrawer — Create their link', () => {
  it('offers the door when the portal is the sample and the job has a GC, then mints and tells the parent', async () => {
    rpc.mockResolvedValue({ data: { token: 'tok-new', audience: 'all' }, error: null })
    const onLinkMinted = vi.fn()
    renderDrawer({ gcCustomerId: 'gc-1', onLinkMinted })
    await settle()
    expect(screen.getByTestId('stages-drawer-mint').textContent).toContain('No portal link yet.')
    expect(screen.getByText(/Summit General has never been given a portal page/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create their link' }))
    await waitFor(() => expect(onLinkMinted).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('mint_customer_portal_link', { p_customer_id: 'gc-1', p_audience: 'all', p_rotate: false })
    expect(screen.getByTestId('stages-drawer-mint').textContent).toContain('Their link is live.')
    expect(screen.queryByRole('button', { name: 'Create their link' })).toBeNull()
  })

  it('shows the error in place and keeps the door when the mint is refused', async () => {
    rpc.mockResolvedValue({ data: { error: 'not allowed' }, error: null })
    const onLinkMinted = vi.fn()
    renderDrawer({ gcCustomerId: 'gc-1', onLinkMinted })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Create their link' }))
    await waitFor(() => expect(screen.getByTestId('stages-drawer-mint').textContent).toContain('not allowed'))
    expect(onLinkMinted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Create their link' })).toBeTruthy()
  })

  it('has no door when the GC already has a link, or when the job has no GC', async () => {
    renderDrawer({ gcCustomerId: 'gc-1', portalIsSample: false, portalUrl: 'http://x/portal?t=real' })
    await settle()
    expect(screen.queryByTestId('stages-drawer-mint')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open the portal ↗' })).toBeTruthy()
    cleanup()
    renderDrawer({ gcCustomerId: null })
    await settle()
    expect(screen.queryByTestId('stages-drawer-mint')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open the sample portal ↗' })).toBeTruthy()
  })
})
