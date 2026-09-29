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

describe('BilledDatesLedger (v2.4193)', () => {
  it('draws the time bar, four rows and the verdict; the notice stretch is the live one', () => {
    render(<BilledDatesLedger ledger={ledger} />)
    const segments = screen.getAllByTestId('ledger-segment')
    expect(segments.map((s) => s.getAttribute('data-segment-kind'))).toEqual(['wait', 'notice', 'wait'])
    expect(segments.map((s) => s.getAttribute('data-segment-live'))).toEqual([null, 'true', null])
    expect(screen.getByTestId('ledger-bar').textContent).toBe('Sep 2342 days to the lienNov 16notice42 d left')
    expect(screen.getByTestId('ledger-row-billed').textContent).toBe('Billed Sep 2312 d ago')
    expect(screen.getByTestId('ledger-row-money').textContent).toBe('Expected Oct 41 d past')
    expect(screen.getByTestId('ledger-row-notice').textContent).toBe('Send the notice by Oct 1510 d')
    expect(screen.getByTestId('ledger-row-lien').textContent).toBe('Lien by Nov 1642 d')
    expect(screen.getByTestId('ledger-verdict').textContent).toBe('Send the notice10 d')
    expect(screen.getByTestId('billed-dates-ledger').getAttribute('aria-label')).toBe('Billed Sep 23 · 12 d ago · Expected Oct 4 · 1 d past · Send the notice by Oct 15 · 10 d · Lien by Nov 16 · 42 d · Send the notice · 10 d')
    // Without handlers nothing is a button.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('the money row opens They said…, the deadline rows and the verdict open the Lien window, and no click reaches the row', () => {
    const onMoney = vi.fn()
    const onLienDesk = vi.fn()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BilledDatesLedger ledger={ledger} onMoney={onMoney} onLienDesk={onLienDesk} evidence={<span data-testid="evidence">Pays in 2–8d</span>} />
      </div>,
    )
    fireEvent.click(screen.getByTestId('ledger-row-money'))
    expect(onMoney).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('ledger-row-notice'))
    fireEvent.click(screen.getByTestId('ledger-row-lien'))
    fireEvent.click(screen.getByTestId('ledger-verdict'))
    expect(onLienDesk).toHaveBeenCalledTimes(3)
    expect(rowClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('evidence')).toBeTruthy()
    // The bill row is a fact, not a door.
    expect(screen.getByTestId('ledger-row-billed').tagName).toBe('DIV')
    expect(within(screen.getByTestId('billed-dates-ledger')).getAllByRole('button')).toHaveLength(4)
  })

  it('a bill on time: the room is the green stretch and the verdict; an empty ledger draws nothing', () => {
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
    const segments = screen.getAllByTestId('ledger-segment')
    expect(segments.map((s) => s.getAttribute('data-segment-kind'))).toEqual(['wait', 'room'])
    expect(segments[1]!.textContent).toBe('66 d of room')
    fireEvent.click(screen.getByTestId('ledger-verdict'))
    expect(onLienDesk).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ledger-verdict').textContent).toBe('Room after they pay66 d')
    document.body.innerHTML = ''
    const { container } = render(<BilledDatesLedger ledger={{ rows: [], bar: null, verdict: null, full: '' }} />)
    expect(container.innerHTML).toBe('')
  })
})
