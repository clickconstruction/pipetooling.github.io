// @vitest-environment jsdom
/**
 * Render smoke for a site's materials on one screen (punch list #330): the figures over the list,
 * one row per part across two jobs with the same words folded and a near twin kept apart, a row
 * that opens to its boxes with a door each, the search with its running total, a figure that
 * narrows the list, the boxes by place with the device remembering the pick, money hidden from a
 * role that does not read it, and the empty site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, Movement, MovementReason, Place } from '../../lib/materials/onSite'
import { readSiteView } from '../../lib/materials/siteMaterialsViewPrefs'
import SiteMaterialsView from './SiteMaterialsView'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role: 'dev' }),
  useOptionalAuth: () => makeUseAuthValue({ role: 'dev' }),
}))

// A made-up site, Juniper Ridge: two jobs, one yard both use.
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
let seq = 0
function row(jobId: string, reason: MovementReason, name: string, quantity: number, box: string, daysAgo: number): Movement {
  seq += 1
  const into = reason === 'delivered'
  return { id: `m${String(seq).padStart(4, '0')}`, jobId, partId: null, partName: name, manufacturer: null, quantity, reason, fromContainerId: into ? null : box, toContainerId: into ? box : null, note: '', byUserId: null, byName: 'Priya', at: ago(daysAgo), source: null, itemId: null }
}
const box = (id: string, jobId: string, label: string, locationId: string | null): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: ago(30) })
const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: ago(30) })

const store = vi.hoisted(() => ({ containers: {} as Record<string, unknown[]>, places: {} as Record<string, unknown[]>, movements: {} as Record<string, unknown[]>, loadBookPrices: vi.fn(async () => {}), sitePrices: [] as Array<Record<string, unknown>>, pricingOk: true, n: 0, setScopeTies: vi.fn() }))
vi.mock('../../lib/materials/onSiteStore', async () => {
  const { latestSitePrices, sitePriceLookup } = await vi.importActual<typeof import('../../lib/materials/sitePrices')>('../../lib/materials/sitePrices')
  return {
    listContainers: (id: string) => store.containers[id] ?? [],
    listPlaces: (id: string) => store.places[id] ?? [],
    listMovements: (id: string) => store.movements[id] ?? [],
    serverSummary: () => null,
    priceOf: (key: string) => (key === 'text:1/2" pex drop ear' ? 4 : null),
    priceOfJob: (_jobId: string, key: string) => (key === 'text:1/2" pex drop ear' ? 4 : null),
    // The one rule, real, over a made-up book and device: the drop ear carries an invoice price, and one
    // parts-book part has a book price checked inside 90 days. The site's own answers are the table below.
    priceForScope: (_scope: string, key: string, canon?: (k: string) => string) => {
      const latest = latestSitePrices(store.sitePrices as never)
      return sitePriceLookup({
        book: (id) => (id === 'book-9' ? [{ partId: 'book-9', supplyHouse: 'Pecan Supply', price: 1.5, checkedOn: '2026-10-03' }] : []),
        invoice: (k) => (k === 'text:1/2" pex drop ear' ? 4 : null),
        site: (k) => latest.get(k),
        canon: canon ?? ((k) => k),
        today: '2026-11-13',
      })(key)
    },
    loadBookPrices: store.loadBookPrices,
    // The site's own prices (punch list #342, PR 2), in memory.
    sitePricingAvailable: () => store.pricingOk,
    listSitePrices: () => store.sitePrices,
    addSitePrice: async (_scope: unknown, input: Record<string, unknown>, byName: string) => {
      store.n += 1
      const row = { id: `sp${store.n}`, rowKey: input.rowKey, rowName: input.rowName, kind: input.kind, unitPrice: input.kind === 'price' ? input.unitPrice : null, source: input.source ?? 'typed', sourceLineId: input.sourceLineId ?? null, sourceWords: input.sourceWords ?? '', pricedOn: input.pricedOn, byName, at: new Date(Date.now() + store.n).toISOString() }
      store.sitePrices = [...store.sitePrices, row]
      return row
    },
    removeSitePrice: async (_scope: unknown, id: string) => {
      store.sitePrices = store.sitePrices.filter((r) => r.id !== id)
    },
    setScopeTies: store.setScopeTies,
  }
})

// The answers table, in memory (punch list #330, PR 3).
const tiesDb = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, failRead: false, n: 0 }))
vi.mock('../../lib/materials/partTiesIo', () => ({
  fetchPartTies: async () => {
    if (tiesDb.failRead) throw new Error('relation "on_site_part_ties" does not exist')
    return [...tiesDb.rows]
  },
  insertPartTie: async (_scope: unknown, tie: Record<string, unknown>, byName: string) => {
    tiesDb.n += 1
    const row = { id: `t${tiesDb.n}`, ...tie, byName, at: new Date().toISOString() }
    tiesDb.rows.push(row)
    return row
  },
  deletePartTie: async (id: string) => {
    tiesDb.rows = tiesDb.rows.filter((r) => r.id !== id)
  },
}))

// The price offers' sources (punch list #342): a made-up parts book of one part and one bill line.
const offersIo = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../../lib/materials/priceOffersIo', () => ({ loadOfferSources: offersIo.load }))

function fill() {
  seq = 0
  offersIo.load.mockReset()
  store.sitePrices = []
  store.pricingOk = true
  store.n = 0
  offersIo.load.mockResolvedValue({
    sources: {
      parts: [{ id: 'book-9', name: '2 PVC 90 DWV', manufacturer: 'Charlotte' }],
      prices: [{ partId: 'book-9', supplyHouse: 'Pecan Supply', price: 1.5, checkedOn: '2026-10-03' }],
      lines: [{ id: 'l1', houseId: 'h1', houseName: 'Cedar Fork Supply', datedOn: '2026-10-09', houseCode: 'P290', description: '2 PVC DWV 90 ELL', unit: 'EA', pricingUnit: 'each', unitPrice: 2.18, quantity: 10, extendedCents: 2180 }],
    },
    bookError: null,
    billsError: null,
  })
  tiesDb.rows = []
  tiesDb.failRead = false
  store.containers = { ja: [box('r12', 'ja', 'R12', 'ya'), box('r58', 'ja', 'R58', 'ya'), box('r22', 'ja', 'R22', null)], jb: [box('p1', 'jb', 'P1', 'yb')] }
  store.places = { ja: [place('ya', 'ja', 'Laydown yard')], jb: [place('yb', 'jb', 'Laydown yard')] }
  store.movements = {
    ja: [
      row('ja', 'delivered', '2" 90 pvc', 94, 'r12', 5),
      row('ja', 'counted', '2" 90 pvc', 94, 'r12', 2),
      row('ja', 'delivered', '2" 90', 42, 'r58', 20),
      row('ja', 'delivered', '1/2" PEX drop ear', 28, 'r22', 6),
      row('ja', 'counted', '1/2" PEX drop ear', 28, 'r22', 5),
      row('ja', 'cannot_find', '1/2" PEX drop ear', 3, 'r22', 1),
    ],
    jb: [row('jb', 'delivered', '2 inch 90 PVC', 28, 'p1', 3), row('jb', 'used', '2 inch 90 PVC', 8, 'p1', 1)],
  }
}

const jobs = [
  { id: 'ja', label: 'J1042 · Juniper Ridge, phase 2' },
  { id: 'jb', label: 'J1057 · Juniper Ridge pump house' },
]

function setup(props: Partial<Parameters<typeof SiteMaterialsView>[0]> = {}) {
  fill()
  const onBack = vi.fn()
  renderWithProviders(<SiteMaterialsView site={{ id: 'dev1', name: 'Juniper Ridge' }} jobs={jobs} showMoney onBack={onBack} backLabel="Materials desk" boxHref={(jobId, boxId) => `/jobs?tab=materials&job=${jobId}#${boxId}`} developmentHref="/developments/dev1" {...props} />)
  return { onBack }
}

afterEach(() => {
  window.localStorage.clear()
})

/** The Same part? ask, once the answers so far were read. */
const findAsk = () =>
  waitFor(() => {
    const el = document.querySelector('[data-same-part-ask]')
    if (!el) throw new Error('no ask yet')
    return el as HTMLElement
  })

describe('SiteMaterialsView', () => {
  it('draws the figures: how fresh the record is, the boxes, what is on hand, the week', () => {
    setup()
    const glance = screen.getByRole('group', { name: 'This site at a glance' })
    expect(within(glance).getByText('Yesterday')).toBeTruthy()
    expect(within(glance).getByText('by Priya')).toBeTruthy()
    expect(within(glance).getByText('2 jobs · 1 place')).toBeTruthy()
    expect(within(glance).getByText('4 lines')).toBeTruthy()
    expect(within(glance).getByText('181 pieces')).toBeTruthy()
    expect(within(glance).getByText('150 in')).toBeTruthy()
    expect(within(glance).getByText('8 used')).toBeTruthy()
    // The week's Can't find at the price the store knows: 3 at $4.
    expect(within(glance).getByText('$12.00')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Print the material location report' }).getAttribute('href')).toBe('/developments/dev1?report=materials')
  })

  it('folds the same words across two jobs into one row and keeps a near twin its own row', () => {
    setup()
    const rows = document.querySelectorAll('[data-site-part-row]')
    expect(rows).toHaveLength(3)
    const pvc = screen.getByRole('button', { name: /2" 90 pvc.*2 spellings/ })
    expect(within(pvc).getByText('114')).toBeTruthy()
    expect(within(pvc).getByText('R12 · 94')).toBeTruthy()
    expect(within(pvc).getByText('P1 · 20')).toBeTruthy()
    fireEvent.click(pvc)
    expect(screen.getByText(/These names are one row because their words are the same/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'P1' }).getAttribute('href')).toBe('/jobs?tab=materials&job=jb#p1')
    expect(screen.getByText(/typed “2 inch 90 PVC”/)).toBeTruthy()
  })

  it('the search adds up the rows it shows, and Show every row clears it', () => {
    setup()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a part or a box on this site' }), { target: { value: '2 90' } })
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(2)
    expect(screen.getByTestId('site-shown-total').textContent).toContain('156 pieces in the 2 rows shown')
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a part or a box on this site' }), { target: { value: 'zzz' } })
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(0)
    expect(screen.getByText(/zzz/)).toBeTruthy()
  })

  it("a figure narrows the list: Can't find leaves the one line", () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Can't find/ }))
    const rows = document.querySelectorAll('[data-site-part-row]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('1/2" PEX drop ear')
    expect(rows[0]!.textContent).toContain("3 can't find")
    expect(screen.getByTestId('site-shown-total').textContent).toContain('25 pieces in the 1 row shown')
  })

  it('reads by place, one section for a name two jobs share, and remembers the pick', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'By place' }))
    expect(readSiteView()).toBe('place')
    const yard = screen.getByRole('heading', { name: /Laydown yard/ })
    expect(yard.textContent).toContain('3 boxes')
    expect(yard.textContent).toContain('2 jobs')
    expect(screen.getByRole('heading', { name: /No place yet/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'R58' })).toBeTruthy()
  })

  it('draws no money for a role that does not read it, and no print press without the Development page', () => {
    setup({ showMoney: false, developmentHref: null })
    expect(screen.queryByText('$12.00')).toBeNull()
    expect(screen.queryByText('Worth')).toBeNull()
    expect(document.querySelector('[data-row-worth]')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Print the material location report' })).toBeNull()
  })

  it('an empty site says what fills it, and Back returns', () => {
    fill()
    const onBack = vi.fn()
    renderWithProviders(<SiteMaterialsView site={{ id: 'dev2', name: 'Alder Court' }} jobs={[]} showMoney onBack={onBack} backLabel="Materials desk" boxHref={() => '/'} />)
    expect(screen.getByText('No part is on hand on this site yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Materials desk' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('asks Same part? once for two names that are nearly the same, joins them on a yes, and Undo separates them', async () => {
    setup({ canTie: true, byName: 'Dana' })
    const ask = await findAsk()
    expect(ask.textContent).toContain('Same part?')
    expect(ask.textContent).toContain('2" 90 and 2" 90 pvc')
    expect(ask.textContent).toContain('One name has one more word.')
    expect(screen.getByRole('button', { name: 'Same part? · 1' })).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Same part' }))
    await waitFor(() => expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(2))
    expect(document.querySelector('[data-same-part-ask]')).toBeNull()
    const joined = screen.getByRole('button', { name: /2" 90 pvc.*3 spellings/ })
    expect(within(joined).getByText('156')).toBeTruthy()
    fireEvent.click(joined)
    const list = screen.getByTestId('names-joined-here')
    expect(list.textContent).toContain('by Dana')
    fireEvent.click(within(list).getByRole('button', { name: /^Undo joining/ }))
    await waitFor(() => expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3))
    expect(tiesDb.rows).toHaveLength(0)
  })

  it('Different is kept too, so the pair is not asked again and the rows stay apart', async () => {
    setup({ canTie: true, byName: 'Dana' })
    const ask = await findAsk()
    fireEvent.click(within(ask).getByRole('button', { name: 'Different' }))
    await waitFor(() => expect(document.querySelector('[data-same-part-ask]')).toBeNull())
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3)
    expect(tiesDb.rows[0]).toMatchObject({ verdict: 'different' })
    expect(screen.queryByRole('button', { name: /^Same part\? ·/ })).toBeNull()
  })

  it('a role that may not answer is asked nothing, and a read that is refused leaves the same-words rows', async () => {
    setup()
    await waitFor(() => expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3))
    expect(document.querySelector('[data-same-part-ask]')).toBeNull()
  })

  it('before the table exists the screen asks nothing and still draws', async () => {
    fill()
    tiesDb.failRead = true
    renderWithProviders(<SiteMaterialsView site={{ id: 'dev1', name: 'Juniper Ridge' }} jobs={jobs} showMoney canTie onBack={() => {}} backLabel="Materials desk" boxHref={() => '/'} />)
    await waitFor(() => expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(3))
    expect(document.querySelector('[data-same-part-ask]')).toBeNull()
  })

  it('Worth says what is known with its cover, and a press lists the rows with no price, most pieces first', async () => {
    setup()
    const glance = screen.getByRole('group', { name: 'This site at a glance' })
    const worth = within(glance).getByRole('button', { name: /Worth/ })
    expect(worth.textContent).toContain('$100.00 known')
    expect(worth.textContent).toContain('1 of 4 lines have a price')
    fireEvent.click(worth)
    const rows = [...document.querySelectorAll('[data-site-part-row]')]
    expect(rows.map((r) => r.querySelector('button')!.textContent!.slice(0, 9))).toEqual(['2" 90 pvc', '2" 9042R5'])
    expect(screen.getByTestId('site-shown-total').textContent).toContain('the rows with a line that has no price')
    expect(document.querySelector('[data-row-worth]')).toBeNull()
    // A viewer who may not tie is offered no pricing, and the offers are never read.
    expect(screen.queryByRole('button', { name: /one at a time/ })).toBeNull()
    expect(offersIo.load).not.toHaveBeenCalled()
  })

  it('Price rows one at a time: the window asks about one row, a number key takes an offer, Undo takes it back', async () => {
    setup({ canTie: true, byName: 'Dana' })
    // Before the site's own prices can be written, a bill is read and not pressed, and no box is drawn.
    store.pricingOk = false
    await findAsk()
    const worth = within(screen.getByRole('group', { name: 'This site at a glance' })).getByRole('button', { name: /Worth/ })
    fireEvent.click(worth)
    // The tile counts the rows with an offer, never dollars.
    await waitFor(() => expect(worth.textContent).toContain('2 rows have an offer'))
    expect(worth.textContent).toContain('$100.00 known')
    expect(offersIo.load).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Price 2 rows one at a time' }))

    const win = await screen.findByTestId('site-pricing-window')
    expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90 pvc')
    expect(win.textContent).toContain('Row 1 of 2')
    expect(win.textContent).toContain('2 left · 156 pieces to go')
    // The parts-book fit is an answer. What a bill paid is read, not pressed.
    expect(within(win).getByRole('button', { name: 'Use 2 PVC 90 DWV at $1.50 for 2" 90 pvc' }).textContent).toContain('Offer · parts book · checked Oct 3')
    const bills = within(win).getByRole('group', { name: 'What a bill paid' })
    expect(bills.textContent).toContain('Offer · a bill · Cedar Fork Supply · Oct 9')
    expect(bills.textContent).toContain('$2.18 each')
    expect(within(bills).queryByRole('button')).toBeNull()
    expect(within(win).queryByRole('textbox', { name: 'A price for one, as counted' })).toBeNull()
    expect(within(win).queryByRole('button', { name: /^Not a part/ })).toBeNull()

    // 1 takes the first answer: the tie is written, and the window moves on.
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90'))
    expect(tiesDb.rows).toHaveLength(1)
    expect(tiesDb.rows[0]).toMatchObject({ aKey: 'id:book-9', aName: '2 PVC 90 DWV', verdict: 'same' })
    expect(win.textContent).toContain('Row 2 of 2')
    expect(win.textContent).toContain('1 left · 42 pieces to go')
    expect(screen.getByTestId('pricing-last-answer').textContent).toContain('Just now: 2" 90 pvc · 2 PVC 90 DWV · $1.50')
    await waitFor(() => expect(worth.textContent).toContain('3 of 4 lines have a price'))

    // Undo takes the tie back and returns to that row.
    fireEvent.click(screen.getByRole('button', { name: 'Undo the price of 2" 90 pvc' }))
    await waitFor(() => expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90 pvc'))
    expect(tiesDb.rows).toHaveLength(0)

    // S skips. Past the last row the window says what is left and offers it again.
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90')
    fireEvent.click(within(win).getByRole('button', { name: /^Skip/ }))
    const end = screen.getByTestId('pricing-walk-end')
    expect(end.textContent).toContain('0 rows priced. 2 rows still have no price.')
    fireEvent.click(within(end).getByRole('button', { name: 'Go through the 2 left' }))
    expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90 pvc')
    fireEvent.click(screen.getByRole('button', { name: 'Done for now' }))
    expect(screen.queryByTestId('site-pricing-window')).toBeNull()
  })

  it('a bill’s price is an answer once the site’s own prices can be written, and Undo takes it back', async () => {
    setup({ canTie: true, byName: 'Dana' })
    await findAsk()
    const worth = within(screen.getByRole('group', { name: 'This site at a glance' })).getByRole('button', { name: /Worth/ })
    fireEvent.click(worth)
    fireEvent.click(await screen.findByRole('button', { name: 'Price 2 rows one at a time' }))
    const win = await screen.findByTestId('site-pricing-window')
    const bill = await within(win).findByRole('button', { name: 'Use the bill’s price for 2 PVC DWV 90 ELL at $2.18 each for 2" 90 pvc' })
    expect(bill.textContent).toContain('Offer · a bill · Cedar Fork Supply · Oct 9')
    // 2 is the bill: 114 pieces at $2.18 join what is known, on the bill's own day.
    fireEvent.keyDown(window, { key: '2' })
    await waitFor(() => expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90'))
    expect(store.sitePrices).toHaveLength(1)
    expect(store.sitePrices[0]).toMatchObject({ rowKey: 'words:2" 90 pvc', kind: 'price', unitPrice: 2.18, source: 'bill', sourceLineId: 'l1', sourceWords: 'Cedar Fork Supply', pricedOn: '2026-10-09', byName: 'Dana' })
    expect(worth.textContent).toContain('$348.52 known')
    expect(worth.textContent).toContain('3 of 4 lines have a price')
    expect(tiesDb.rows).toHaveLength(0)
    expect(screen.getByTestId('pricing-last-answer').textContent).toContain('Just now: 2" 90 pvc · $2.18 each from Cedar Fork Supply’s bill')
    fireEvent.click(screen.getByRole('button', { name: 'Undo the price of 2" 90 pvc' }))
    await waitFor(() => expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90 pvc'))
    expect(store.sitePrices).toHaveLength(0)
    expect(worth.textContent).toContain('$100.00 known')
  })

  it('a typed price and Not a part finish the list, and the row keeps its answer with a way back', async () => {
    setup({ canTie: true, byName: 'Dana' })
    await findAsk()
    const worth = within(screen.getByRole('group', { name: 'This site at a glance' })).getByRole('button', { name: /Worth/ })
    fireEvent.click(worth)
    fireEvent.click(await screen.findByRole('button', { name: 'Price 2 rows one at a time' }))
    const win = await screen.findByTestId('site-pricing-window')
    const box = within(win).getByRole('textbox', { name: 'A price for one, as counted' })
    fireEvent.change(box, { target: { value: 'two' } })
    expect(win.textContent).toContain('Type a price as a number, such as 3.12.')
    fireEvent.change(box, { target: { value: '3.5' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Save $3.50 for one' }))
    await waitFor(() => expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90'))
    expect(store.sitePrices[0]).toMatchObject({ rowKey: 'words:2" 90 pvc', kind: 'price', unitPrice: 3.5, source: 'typed' })
    // N sets the last row aside: it leaves the cover, and nothing is left to price.
    fireEvent.keyDown(window, { key: 'n' })
    await waitFor(() => expect(screen.getByTestId('pricing-walk-end').textContent).toContain('Nothing waiting on a price on this site.'))
    expect(store.sitePrices[1]).toMatchObject({ rowKey: 'words:2" 90', kind: 'left_out', unitPrice: null })
    expect(worth.textContent).toContain('$499.00 known')
    expect(worth.textContent).toContain('3 of 3 lines have a price · 1 left out')
    fireEvent.click(within(screen.getByTestId('pricing-walk-end')).getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('site-pricing-window')).toBeNull()

    // On the list the row says it was left out, and its open row brings it back.
    fireEvent.click(worth)
    expect(document.querySelector('[data-row-left-out]')?.textContent).toBe('left out · not a part')
    fireEvent.click(screen.getByRole('button', { name: /^2" 90\b(?! pvc)/ }))
    const here = screen.getByTestId('priced-here')
    expect(here.textContent).toContain('Left out, not a part · by Dana')
    fireEvent.click(within(here).getByRole('button', { name: 'Bring 2" 90 back' }))
    await waitFor(() => expect(document.querySelector('[data-row-left-out]')).toBeNull())
    expect(worth.textContent).toContain('3 of 4 lines have a price')
    // The typed price reads on its row with who typed it, and Undo takes it back.
    const priced = screen.getByRole('button', { name: /^2" 90 pvc/ })
    expect(priced.textContent).toContain('$399.00 · typed by Dana')
    fireEvent.click(priced)
    fireEvent.click(within(screen.getByTestId('priced-here')).getByRole('button', { name: 'Undo the price of 2" 90 pvc' }))
    await waitFor(() => expect(worth.textContent).toContain('$100.00 known'))
  })

  it('a source that did not answer is named, and a typed key in a box is not an answer', async () => {
    setup({ canTie: true, byName: 'Dana', searchBook: vi.fn(async () => []) })
    offersIo.load.mockResolvedValue({ sources: { parts: [], prices: [], lines: [] }, bookError: null, billsError: 'You do not have access to the bills.' })
    await findAsk()
    fireEvent.click(within(screen.getByRole('group', { name: 'This site at a glance' })).getByRole('button', { name: /Worth/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Price 2 rows one at a time' }))
    const win = await screen.findByTestId('site-pricing-window')
    await waitFor(() => expect(win.textContent).toContain('The bills’ offers are not here. You do not have access to the bills.'))
    expect(win.textContent).toContain('Nothing found in the parts book or on a bill. Type a price for one')
    // Other part… opens the picker on the folded words; typing an s there does not skip the row.
    fireEvent.click(within(win).getByRole('button', { name: 'Other part…' }))
    const box = within(win).getByRole('searchbox', { name: 'Find it in the parts book' }) as HTMLInputElement
    expect(box.value).toBe('2 90 pvc')
    fireEvent.keyDown(box, { key: 's' })
    expect(screen.getByTestId('pricing-row-name').textContent).toBe('2" 90 pvc')
  })

  it('This is a parts-book part ties a typed name to the book, and the row takes the book’s name and price', async () => {
    const searchBook = vi.fn(async () => [{ id: 'book-9', name: '2 PVC 90 DWV', manufacturer: 'Charlotte' }])
    setup({ canTie: true, byName: 'Dana', searchBook })
    await findAsk()
    fireEvent.click(screen.getByRole('button', { name: /^2" 90\b(?! pvc)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'This is a parts-book part' }))
    const picker = screen.getByTestId('book-part-picker')
    expect((within(picker).getByRole('searchbox', { name: 'Find it in the parts book' }) as HTMLInputElement).value).toBe('2 90')
    fireEvent.click(await within(picker).findByRole('button', { name: 'Tie to 2 PVC 90 DWV' }))
    const tied = await screen.findByRole('button', { name: /2 PVC 90 DWV/ })
    expect(tied.textContent).toContain('$63.00 · parts book · checked Oct 3')
    expect(searchBook).toHaveBeenCalledWith('2 90')
    expect(store.loadBookPrices).toHaveBeenCalledWith(['book-9'])
    expect(tiesDb.rows[0]).toMatchObject({ aKey: 'id:book-9', aName: '2 PVC 90 DWV', bName: '2" 90', verdict: 'same' })
    const worth = within(screen.getByRole('group', { name: 'This site at a glance' })).getByRole('button', { name: /Worth/ })
    expect(worth.textContent).toContain('$163.00 known')
    expect(worth.textContent).toContain('2 of 4 lines have a price')
    // The tie is undone like any other.
    fireEvent.click(tied)
    fireEvent.click(within(screen.getByTestId('names-joined-here')).getByRole('button', { name: /^Undo joining/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /2 PVC 90 DWV/ })).toBeNull())
  })
})
