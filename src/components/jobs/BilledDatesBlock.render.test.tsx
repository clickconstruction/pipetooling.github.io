// @vitest-environment jsdom
/**
 * Dates · Words | Track (v2.6139, punch list #217, jobs-pipeline-1): a Billed row's dates block
 * opens on Words, the ledger as it has read since v2.4168; the switch draws the same ledger as
 * a track against today, remembered in this browser; every door still opens the same window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BilledDatesBlock from './BilledDatesBlock'
import { buildBilledDatesLedger } from '../../lib/jobs/billedDatesLedger'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import { setJobDatesView } from '../../hooks/useJobDatesView'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { drf: { medianDays: 11, samples: 8 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}
const today = '2026-09-30'
const row = { billedAtIso: '2026-09-29T15:00:00Z', estBillYmd: null, customerId: 'drf', payerName: 'DRF' }
const runway = buildLienPayRunway({ todayYmd: today, openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: '2026-10-10', filedYmd: null, releasedYmd: null, isSub: false })
const ledger = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway, inCollections: false })

afterEach(() => {
  document.body.innerHTML = ''
  setJobDatesView('words')
  window.history.replaceState({}, '', '/')
})

describe('BilledDatesBlock · Dates · Words | Track (v2.6139)', () => {
  it('opens on Words, the ledger as it reads today, and the switch is there', () => {
    window.localStorage.removeItem('jobDatesView')
    render(<BilledDatesBlock ledger={ledger} todayYmd={today} />)
    expect(screen.getByTestId('billed-dates-block').getAttribute('data-view')).toBe('words')
    expect(screen.getByTestId('billed-dates-ledger')).toBeTruthy()
    expect(screen.queryByTestId('billed-dates-track')).toBeNull()
    expect(screen.getByRole('button', { name: 'Words' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Track' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('Track draws the same dates on one axis, remembers the choice, and its doors open the same windows', () => {
    const onMoney = vi.fn()
    const onLienDesk = vi.fn()
    const onPaySpeeds = vi.fn()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BilledDatesBlock ledger={ledger} todayYmd={today} onMoney={onMoney} onLienDesk={onLienDesk} onPaySpeeds={onPaySpeeds} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Track' }))
    expect(window.localStorage.getItem('jobDatesView')).toBe('track')
    expect(screen.getByTestId('billed-dates-block').getAttribute('data-view')).toBe('track')
    expect(screen.queryByTestId('billed-dates-ledger')).toBeNull()
    const track = screen.getByTestId('billed-dates-track')
    expect(track.getAttribute('aria-label')).toBe('Billed · Sep 29 · today · Sep 30 · ~Oct 10 · guessed · Lien by Dec 15 · 76d · guessed · ~11 d over 8 payments · 66d of room')
    expect(screen.getByTestId('billed-track-mark-billed').getAttribute('data-glyph')).toBe('dot')
    expect(screen.getByTestId('billed-track-mark-money').getAttribute('data-glyph')).toBe('ring_dashed')
    expect(screen.getByTestId('billed-track-mark-lien').getAttribute('data-glyph')).toBe('flag')
    expect(screen.getByTestId('billed-track-band').getAttribute('data-kind')).toBe('room')
    expect(screen.getByTestId('billed-track-verdict').textContent).toBe('66d of room')
    // The guessed ring opens They said…, the flag the Lien window, the tag the pay-speeds breakdown; no press reaches the row.
    fireEvent.click(screen.getByRole('button', { name: '~Oct 10 · guessed — record what the customer said' }))
    expect(onMoney).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Lien by Dec 15 · 76d — open the Lien window' }))
    expect(onLienDesk).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('billed-track-tag'))
    expect(onPaySpeeds).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('billed-track-verdict'))
    expect(onLienDesk).toHaveBeenCalledTimes(2)
    expect(rowClick).not.toHaveBeenCalled()
    // Words brings the ledger back.
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    expect(screen.getByTestId('billed-dates-ledger')).toBeTruthy()
    expect(window.localStorage.getItem('jobDatesView')).toBe('words')
  })

  it('a promise is a solid ring whose tag opens New date…; no history draws no ring and the band asks for a date', () => {
    setJobDatesView('track')
    const onMoney = vi.fn()
    const promise = { promisedYmd: '2026-10-20', markedByName: 'Robert' }
    const promised = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway: buildLienPayRunway({ todayYmd: today, openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: '2026-10-20', filedYmd: null, releasedYmd: null, isSub: false }), inCollections: false })
    render(<BilledDatesBlock ledger={promised} todayYmd={today} onMoney={onMoney} />)
    expect(screen.getByTestId('billed-track-mark-money').getAttribute('data-glyph')).toBe('ring_solid')
    expect(screen.getByTestId('billed-track-tag').textContent).toContain('their word · Oct 20')
    fireEvent.click(screen.getByTestId('billed-track-tag'))
    expect(onMoney).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ''
    const bare = buildBilledDatesLedger({ todayYmd: today, row, data: null, promise: null, runway: buildLienPayRunway({ todayYmd: today, openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub: false }), inCollections: false })
    render(<BilledDatesBlock ledger={bare} todayYmd={today} onMoney={onMoney} />)
    expect(screen.queryByTestId('billed-track-mark-money')).toBeNull()
    expect(screen.queryByTestId('billed-track-tag')).toBeNull()
    expect(screen.getByTestId('billed-track-band').getAttribute('data-kind')).toBe('ask')
    expect(screen.getByTestId('billed-track-verdict').textContent).toBe('Ask for a date')
  })

  it('a dev on ?sbs=1 sees today’s ledger over the track on the same row, with no switch; anyone else sees the switch', () => {
    window.history.replaceState({}, '', '/jobs?tab=stages&sbs=1')
    render(<BilledDatesBlock ledger={ledger} todayYmd={today} />)
    expect(screen.getByTestId('billed-dates-block').getAttribute('data-view')).toBe('side-by-side')
    const sbs = screen.getByTestId('billed-dates-sbs')
    expect(sbs.textContent).toContain('Today')
    expect(sbs.textContent).toContain('With the track')
    expect(screen.getByTestId('billed-dates-ledger')).toBeTruthy()
    expect(screen.getByTestId('billed-dates-track')).toBeTruthy()
    expect(screen.queryByTestId('job-dates-view-switch')).toBeNull()
    document.body.innerHTML = ''
    // The flag can name its surface; another surface's key leaves this one alone.
    window.history.replaceState({}, '', '/jobs?sbs=jobs-pipeline-6')
    render(<BilledDatesBlock ledger={ledger} todayYmd={today} />)
    expect(screen.getByTestId('billed-dates-block').getAttribute('data-view')).toBe('words')
    expect(screen.getByTestId('job-dates-view-switch')).toBeTruthy()
  })
})
