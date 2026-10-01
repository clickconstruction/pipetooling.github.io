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

describe('BilledDatesLedger (v2.4205)', () => {
  it('draws three rows — the notice is the one deadline — and no verdict when the notice row is the to-do', () => {
    render(<BilledDatesLedger ledger={ledger} />)
    expect(screen.getByTestId('ledger-row-billed').textContent).toBe('Billed Sep 2312d ago')
    expect(screen.getByTestId('ledger-row-money').textContent).toBe('Expected Oct 41d past')
    expect(screen.getByTestId('ledger-row-notice').textContent).toBe('Lien notice by Oct 1510d')
    expect(screen.queryByTestId('ledger-row-lien')).toBeNull()
    expect(screen.queryByTestId('ledger-verdict')).toBeNull()
    expect(screen.getByTestId('billed-dates-ledger').getAttribute('aria-label')).toBe('Billed Sep 23 · 12d ago · Expected Oct 4 · 1d past · Lien notice by Oct 15 · 10d')
    // Without handlers nothing is a button.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('the money row opens They said…, the deadline row opens the Lien window, and no click reaches the row', () => {
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
    expect(onLienDesk).toHaveBeenCalledTimes(1)
    expect(rowClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('evidence')).toBeTruthy()
    // The bill row is a fact, not a door.
    expect(screen.getByTestId('ledger-row-billed').tagName).toBe('DIV')
    expect(within(screen.getByTestId('billed-dates-ledger')).getAllByRole('button')).toHaveLength(2)
  })

  it('a bill on time: the verdict is the slack and opens the Lien window; a past date asks through They said…; an empty ledger draws nothing', () => {
    const calm = buildBilledDatesLedger({
      todayYmd: '2026-09-30',
      row: { ...row, billedAtIso: '2026-09-29T15:00:00Z' },
      data,
      promise: null,
      runway: buildLienPayRunway({ todayYmd: '2026-09-30', openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: '2026-10-10', filedYmd: null, releasedYmd: null, isSub: false }),
      inCollections: false,
    })
    const onLienDesk = vi.fn()
    const onMoney = vi.fn()
    render(<BilledDatesLedger ledger={calm} onLienDesk={onLienDesk} onMoney={onMoney} />)
    expect(screen.getByTestId('ledger-verdict').textContent).toBe('Can run late66d')
    fireEvent.click(screen.getByTestId('ledger-verdict'))
    expect(onLienDesk).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ''
    const late = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway({ todayYmd: today, openBalance: 15406, lastWorkYmd: '2026-08-14', propertyKind: 'residential', expectedPayYmd: '2026-10-04', filedYmd: null, releasedYmd: null, isSub: false }), inCollections: false })
    render(<BilledDatesLedger ledger={late} onLienDesk={onLienDesk} onMoney={onMoney} />)
    expect(screen.getByTestId('ledger-verdict').textContent).toBe('Ask for a date1d past')
    fireEvent.click(screen.getByTestId('ledger-verdict'))
    expect(onMoney).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ''
    const { container } = render(<BilledDatesLedger ledger={{ rows: [], verdict: null, full: '' }} />)
    expect(container.innerHTML).toBe('')
  })
})
