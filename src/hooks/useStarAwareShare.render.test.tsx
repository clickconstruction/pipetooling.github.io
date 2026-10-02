// @vitest-environment jsdom
/**
 * Share / Print / CSV and the ★ chooser as a hook (region P7 of the Pricing map). Pins the
 * seam: with the ★ on screen (or no ★) each action runs at once on what is on screen; with
 * another scenario on screen the chooser opens on the ★; the ★ is priced from its own inputs
 * with no view switch; a CSV with nothing to export says so; busy and the chooser clear.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { useStarAwareShare } from './useStarAwareShare'
import type { PricingShareInputs, StarAwareAction, StarChoice } from '../lib/bids/starAwareShare'
import type { PricingPrintContext } from '../lib/bidDocuments/pricingPage'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const printed: PricingPrintContext[] = []
const csvAsked: Array<{ ctx: PricingPrintContext; teamLaborCost: number }> = []
let csvResult: { csv: string; filename: string } | null = { csv: 'a,b', filename: 'pricing.csv' }
let printAllError: string | null = null
vi.mock('../lib/bidDocuments/pricingPage', () => ({
  printPricingPage: (ctx: PricingPrintContext) => {
    printed.push(ctx)
  },
  printAllPricingPages: async () => printAllError,
  buildPricingCsvForBid: (ctx: PricingPrintContext, teamLaborCost: number) => {
    csvAsked.push({ ctx, teamLaborCost })
    return csvResult
  },
}))

const loads: Array<Record<string, unknown>> = []
let releaseLoad: (() => void) | null = null
let holdLoad = false
vi.mock('../lib/bids/loadScenarioInputs', () => ({
  scenarioBidVersionIdOf: (scenarios: Array<{ id: string; bid_version_id?: string | null }>, id: string) => scenarios.find((s) => s.id === id)?.bid_version_id ?? null,
  loadScenarioInputs: async (_client: unknown, args: Record<string, unknown>) => {
    loads.push(args)
    if (holdLoad) await new Promise<void>((resolve) => { releaseLoad = resolve })
    return {
      entries: [],
      assignments: [],
      hides: [],
      countRows: null,
      customPrices: [{ id: 'cp1', bid_id: 'b1', count_row_id: 'c1', price_book_version_id: 'pA', unit_price: 250 }],
    }
  },
}))

const toasts: Array<[string, string]> = []
vi.mock('../contexts/ToastContext', async (orig) => {
  const real = await orig<typeof import('../contexts/ToastContext')>()
  return { ...real, useToastContext: () => ({ showToast: (m: string, kind: string) => toasts.push([m, kind]), showActionToast: () => {} }) }
})

const versions = [
  { id: 'pA', name: 'Base', bid_version_id: 'v1' },
  { id: 'pB', name: 'Alternate 1', bid_version_id: 'v1' },
]

function makeInputs(over: { starId?: string | null; viewedId?: string | null } = {}): PricingShareInputs {
  return {
    bid: { id: 'b1', selected_price_book_version_id: over.starId === undefined ? 'pA' : over.starId },
    priceBookVersions: versions,
    priceBookEntries: [],
    selectedPricingVersionId: over.viewedId === undefined ? 'pB' : over.viewedId,
    countRows: [{ id: 'c1', fixture: 'WC-1', count: 4, bid_id: 'b1', sequence_order: 0 }],
    costEstimate: null,
    laborRows: [],
    materialTotalRoughIn: null,
    materialTotalTopOut: null,
    materialTotalTrimSet: null,
    laborRate: null,
    fixtureMaterialsFromTakeoff: {},
    assignments: [],
    customPrices: [],
    submissionHides: [],
    taxPercent: 8.25,
    directCostRows: [],
    teamLaborDataForBids: [{ bidId: 'b1', bidCost: 320 }],
  } as unknown as PricingShareInputs
}

const viewedPackage = { rows: [{ fixture: 'WC-1', count: 4, unitPrice: 300, revenue: 1200, omitFromSubmissionDocuments: false }], totalRevenue: 1200 }
const errors: Array<string | null> = []

/** `starPricingId` defaults to the bid column, as the tab passes it for a bid whose ★ is its own. */
function Probe({ inputs, pick, starPricingId }: { inputs: PricingShareInputs | null; pick?: StarChoice; starPricingId?: string | null }) {
  const star = starPricingId !== undefined ? starPricingId : (inputs?.bid.selected_price_book_version_id ?? null)
  const s = useStarAwareShare({ inputs, selectedBidVersionId: 'v1', starPricingId: star, pricingPackageSource: viewedPackage, setError: (m) => errors.push(m) })
  const o = s.shareOverride
  return (
    <div>
      <div data-testid="state">
        {`package:${s.packageSendOpen ? 'open' : 'closed'} · chooser:${s.starChooser ?? 'none'}/${s.starChoice} · busy:${s.starBusy ? 'yes' : 'no'}`}
      </div>
      <div data-testid="override">{o ? `${o.pricingId} ${o.name} ${o.totalRevenue}${o.also ? ` + ${o.also.pricingId} ${o.also.name} ${o.also.totalRevenue}` : ''}` : 'none'}</div>
      {(['share', 'print', 'csv'] as StarAwareAction[]).map((a) => (
        <button key={a} type="button" onClick={() => s.requestWithStarCheck(a)}>{`ask ${a}`}</button>
      ))}
      <button type="button" onClick={() => s.printPricingPage()}>print door</button>
      <button type="button" onClick={() => s.downloadPricingCsv()}>csv door</button>
      <button type="button" onClick={() => void s.printAllPricingPages()}>review door</button>
      <button type="button" onClick={() => s.starChooser && void s.runStarAwareAction(s.starChooser, pick ?? s.starChoice)}>confirm</button>
    </div>
  )
}

beforeEach(() => {
  printed.length = 0
  csvAsked.length = 0
  loads.length = 0
  toasts.length = 0
  errors.length = 0
  csvResult = { csv: 'a,b', filename: 'pricing.csv' }
  printAllError = null
  holdLoad = false
  releaseLoad = null
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  // jsdom cannot follow a blob link; the download is the click itself
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const override = () => screen.getByTestId('override').textContent

/** Render, then let the mount settle — the harness rule: no click on the line after a render. */
async function mount(ui: React.ReactElement) {
  const result = renderWithProviders(ui)
  await settle()
  return result
}

describe('useStarAwareShare', () => {
  it('with no bid, every door does nothing', async () => {
    await mount(<Probe inputs={null} />)
    for (const name of ['ask share', 'ask print', 'ask csv', 'review door']) fireEvent.click(screen.getByText(name))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(printed).toEqual([])
    expect(csvAsked).toEqual([])
    expect(loads).toEqual([])
  })

  it('with the ★ on screen, Share opens the package at once with nothing overridden', async () => {
    await mount(<Probe inputs={makeInputs({ viewedId: 'pA' })} />)
    fireEvent.click(screen.getByText('ask share'))
    await screen.findByText('package:open · chooser:none/star · busy:no')
    expect(override()).toBe('none')
    expect(loads).toEqual([])
  })

  it('with no ★ on the bid, Print prints what is on screen — the price view, with the bid’s team labor', async () => {
    await mount(<Probe inputs={makeInputs({ starId: null })} />)
    fireEvent.click(screen.getByText('print door'))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(printed).toHaveLength(1)
    expect(printed[0]?.selectedPricingVersionId).toBe('pB')
    expect(printed[0]?.viewModel).toBe('price')
    expect(printed[0]?.teamLaborCost).toBe(320)
  })

  it('reads the ★ it is handed, not the bid column: a stray bid-level ★ opens no chooser (BP385, v2.4377)', async () => {
    // The bid column names pA; the version on screen resolves its ★ to pB, the price being viewed.
    await mount(<Probe inputs={makeInputs()} starPricingId="pB" />)
    fireEvent.click(screen.getByText('ask share'))
    await screen.findByText('package:open · chooser:none/star · busy:no')
    expect(override()).toBe('none')
    expect(loads).toEqual([])
  })

  it('with another scenario on screen, each door opens the chooser on the ★ and runs nothing yet', async () => {
    await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('csv door'))
    await screen.findByText('package:closed · chooser:csv/star · busy:no')
    expect(csvAsked).toEqual([])
    expect(loads).toEqual([])
  })

  it('picking the viewed price in the chooser prints what is on screen and closes the chooser', async () => {
    await mount(<Probe inputs={makeInputs()} pick="viewed" />)
    fireEvent.click(screen.getByText('ask print'))
    await screen.findByText('package:closed · chooser:print/star · busy:no')
    fireEvent.click(screen.getByText('confirm'))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(printed[0]?.selectedPricingVersionId).toBe('pB')
    expect(loads).toEqual([])
  })

  it('sharing the ★ loads its inputs, prices them and hands the package the ★ by name', async () => {
    await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('ask share'))
    await screen.findByText('package:closed · chooser:share/star · busy:no')
    fireEvent.click(screen.getByText('confirm'))
    await screen.findByText('package:open · chooser:none/star · busy:no')
    expect(override()).toBe('pA Base 1000')
    expect(loads).toEqual([{ bidId: 'b1', pricingId: 'pA', scenarioBidVersionId: 'v1', selectedBidVersionId: 'v1' }])
  })

  it('sharing both puts the viewed price under the ★', async () => {
    await mount(<Probe inputs={makeInputs()} pick="both" />)
    fireEvent.click(screen.getByText('ask share'))
    await screen.findByText('package:closed · chooser:share/star · busy:no')
    fireEvent.click(screen.getByText('confirm'))
    await screen.findByText('package:open · chooser:none/star · busy:no')
    expect(override()).toBe('pA Base 1000 + pB Alternate 1 1200')
  })

  it('printing the ★ re-aims the context at it; the view does not switch', async () => {
    await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('ask print'))
    await screen.findByText('package:closed · chooser:print/star · busy:no')
    fireEvent.click(screen.getByText('confirm'))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(printed).toHaveLength(1)
    expect(printed[0]?.selectedPricingVersionId).toBe('pA')
    expect(printed[0]?.customPrices).toHaveLength(1)
    expect(override()).toBe('none')
  })

  it('is busy while the ★ loads, and clears busy and the chooser after', async () => {
    holdLoad = true
    await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('ask csv'))
    await screen.findByText('package:closed · chooser:csv/star · busy:no')
    fireEvent.click(screen.getByText('confirm'))
    await screen.findByText('package:closed · chooser:csv/star · busy:yes')
    expect(csvAsked).toEqual([])
    releaseLoad?.()
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(csvAsked).toHaveLength(1)
    expect(csvAsked[0]?.ctx.selectedPricingVersionId).toBe('pA')
    expect(csvAsked[0]?.teamLaborCost).toBe(320)
    expect(toasts).toEqual([['Pricing exported to CSV.', 'success']])
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })

  it('a CSV with nothing to export says so and downloads nothing', async () => {
    csvResult = null
    await mount(<Probe inputs={makeInputs({ viewedId: 'pA' })} />)
    fireEvent.click(screen.getByText('ask csv'))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(toasts).toEqual([['Select a price and make sure Counts and Labor are set up.', 'info']])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('Print for review reports a failure to the page and nothing on success', async () => {
    printAllError = 'Pop-up blocked'
    const { unmount } = await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('review door'))
    await vi.waitFor(() => expect(errors).toEqual(['Pop-up blocked']))
    unmount()
    errors.length = 0
    printAllError = null
    await mount(<Probe inputs={makeInputs()} />)
    fireEvent.click(screen.getByText('review door'))
    await screen.findByText('package:closed · chooser:none/star · busy:no')
    expect(errors).toEqual([])
  })
})
