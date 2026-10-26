// @vitest-environment jsdom
/**
 * The door on an error line (punch list #187 PR 6): What this means opens the family's card in place,
 * records one `error_door_opened` row, and the card's guide opens in a new tab with `via=error`; the
 * Retry panel carries it beside the reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { ErrorDoorButton, ErrorDoorCard } from './ErrorDoor'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})

const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ data: null, error: null })
      },
    }),
  },
}))

afterEach(() => {
  cleanup()
  inserts.length = 0
})

function Line() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <p>
        Could not save the payment · {OFFLINE_ERROR_MESSAGE} · <ErrorDoorButton family="network" open={open} onToggle={setOpen} />
      </p>
      {open ? <ErrorDoorCard family="network" onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

describe('ErrorDoor', () => {
  it('opens the card in place with the three rows and the guide in a new tab, and records the press', () => {
    render(<Line />)
    fireEvent.click(screen.getByRole('button', { name: 'What this means' }))
    const card = screen.getByTestId('error-door')
    expect(card.textContent).toContain('What was saved')
    expect(card.textContent).toContain('Nothing. What you typed is still in the form.')
    const guide = screen.getByTestId('error-door-guide') as HTMLAnchorElement
    expect(guide.getAttribute('href')).toBe('/help?g=what-no-connection-means&via=error')
    expect(guide.getAttribute('target')).toBe('_blank')
    expect(inserts.filter((i) => i.table === 'ui_nav_clicks').map((i) => i.row)).toEqual([expect.objectContaining({ control: 'error_door_opened', target: '#network', role: 'helpers' })])
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('error-door')).toBeNull()
  })

  it('the Retry panel carries the door beside the reason', () => {
    render(<OfflineRetryPanel failure={{ kind: 'network', message: OFFLINE_ERROR_MESSAGE }} onRetry={() => {}} surface="clock-in" />)
    fireEvent.click(screen.getByRole('button', { name: 'What this means' }))
    expect(screen.getByTestId('error-door').textContent).toContain('The phone or the computer had no signal.')
  })
})
