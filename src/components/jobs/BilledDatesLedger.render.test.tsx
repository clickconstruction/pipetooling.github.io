// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import BilledDatesLedger from './BilledDatesLedger'
import { buildBilledDatesLedger } from '../../lib/jobs/billedDatesLedger'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'

const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { drf: { medianDays: 11, samples: 8 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}
const row = { billedAtIso: '2026-09-23T15:00:00Z', estBillYmd: null, customerId: 'drf' }
const today = '2026-10-05'
const runway = buildLienPayRunway({ todayYmd: today, openBalance: 15406, lastWorkYmd: '2026-08-14', propertyKind: 'residential', expectedPayYmd: '2026-10-04', filedYmd: null, releasedYmd: null, isSub: true })
const ledger = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway, inCollections: false })

describe('BilledDatesLedger (v2.4168)', () => {
  it('draws four markers on the track and four rows whose numbers match; the notice row is the bold one', () => {
    render(<BilledDatesLedger ledger={ledger} />)
    expect(screen.getAllByTestId('ledger-marker')).toHaveLength(4)
    expect(screen.getAllByTestId('ledger-marker').map((m) => m.textContent)).toEqual(['1', '2', '3', '4'])
    expect(screen.getByTestId('ledger-row-billed').textContent).toBe('Billed Sep 23')
    expect(screen.getByTestId('ledger-row-money').textContent).toBe('Expected Oct 4')
    expect(screen.getByTestId('ledger-row-notice').textContent).toBe('Send the notice by Oct 15')
    expect(screen.getByTestId('ledger-row-lien').textContent).toBe('Lien by Nov 16')
    expect(screen.getByTestId('billed-dates-ledger').getAttribute('aria-label')).toBe('Billed Sep 23 · 12 d ago · Expected Oct 4 · 1 d past · Send the notice by Oct 15 · 10 d · Lien by Nov 16 · 42 d')
    // Without handlers nothing is a button.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('the money row opens They said…, the deadline rows open the Lien window, and neither click reaches the row', () => {
    const onMoney = vi.fn()
    const onLienDesk = vi.fn()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BilledDatesLedger ledger={ledger} onMoney={onMoney} onLienDesk={onLienDesk} evidence={<span data-testid="evidence">Pays in 2–8d</span>} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Expected Oct 4' }))
    expect(onMoney).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Send the notice by Oct 15 ›' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lien by Nov 16' }))
    expect(onLienDesk).toHaveBeenCalledTimes(2)
    expect(rowClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('evidence')).toBeTruthy()
    // The bill row is a fact, not a door.
    expect(within(screen.getByTestId('billed-dates-ledger')).queryByRole('button', { name: 'Billed Sep 23' })).toBeNull()
  })

  it('a bill on time: no bold row, the green room line is the door to the Lien window; an empty ledger draws nothing', () => {
    const calm = buildBilledDatesLedger({
      todayYmd: '2026-09-30',
      row: { ...row, billedAtIso: '2026-09-29T15:00:00Z' },
      data,
      promise: null,
      runway: buildLienPayRunway({ todayYmd: '2026-09-30', openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: '2026-10-10', filedYmd: null, releasedYmd: null, isSub: false }),
      inCollections: false,
    })
    const onLienDesk = vi.fn()
    render(<BilledDatesLedger ledger={calm} onLienDesk={onLienDesk} />)
    expect(screen.getAllByTestId('ledger-marker')).toHaveLength(3)
    fireEvent.click(screen.getByTestId('ledger-room'))
    expect(onLienDesk).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ledger-room').textContent).toBe('66 d of room after they pay ›')
    document.body.innerHTML = ''
    const { container } = render(<BilledDatesLedger ledger={{ rows: [], track: null, roomLine: null, full: '' }} />)
    expect(container.innerHTML).toBe('')
  })
})
