// @vitest-environment jsdom
/**
 * Render smoke for the jump strip's ☰ section-tools menu (Stages tab decomposition PR 11):
 * closed by default, opens on the trigger, lists the kernel's items with the Accounts
 * Receivable badge, disables what the kernel disables, and closes before calling a door.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { JobsStagesSectionToolsMenu } from './JobsStagesSectionToolsMenu'
import type { StagesSectionToolKey } from '../../lib/jobs/stagesSectionToolsMenu'

const KEYS: StagesSectionToolKey[] = ['recently-added', 'weekly-movement', 'weekly-money', 'capable-to-bill', 'ready-to-bill-notifications', 'gc-review', 'accounts-receivable', 'billed-share-print', 'billed-aging-chart', 'billed-payment-forecast', 'paid-notifications', 'paid-profit-chart', 'paid-in-full-notifications', 'lien-desk']

function doors() {
  return Object.fromEntries(KEYS.map((k) => [k, vi.fn()])) as unknown as Record<StagesSectionToolKey, () => void>
}

const inputs = {
  authRole: 'dev',
  billedRowCount: 0,
  collectionsRowCount: 0,
  arBankTxUnallocatedCount: 5,
  capableToBillTotalFormatted: '12.3k',
  recentViewOpen: false,
  lienDeskCount: 2,
}

describe('JobsStagesSectionToolsMenu', () => {
  it('is closed until the trigger is pressed, then lists the kernel items for a dev', () => {
    const onSelect = doors()
    render(<JobsStagesSectionToolsMenu inputs={inputs} onSelect={onSelect} />)
    const trigger = screen.getByLabelText('Section tools')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Recently added')).toBeTruthy()
    expect(screen.getByText('Capable of Being Billed: $12.3k')).toBeTruthy()
    expect(screen.getByText('Accounts Receivable')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    // GC Review is disabled while Billed + Collections are both empty (kernel rule).
    expect((screen.getByText('GC Review').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes first, then calls the picked door', () => {
    const onSelect = doors()
    render(<JobsStagesSectionToolsMenu inputs={inputs} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Section tools'))
    fireEvent.click(screen.getByText('Accounts Receivable'))
    expect(onSelect['accounts-receivable']).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('Section tools').getAttribute('aria-expanded')).toBe('false')
  })

  it('the backdrop click closes without calling anything', () => {
    const onSelect = doors()
    const { container } = render(<JobsStagesSectionToolsMenu inputs={inputs} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Section tools'))
    const backdrop = [...container.querySelectorAll('div')].find((d) => d.style.position === 'fixed' && d.style.zIndex === '120')!
    fireEvent.click(backdrop)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(Object.values(onSelect).some((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(false)
  })
})
