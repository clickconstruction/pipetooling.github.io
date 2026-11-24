// @vitest-environment jsdom
/**
 * A job's Deliveries panel (punch list #344, PR 8, v2.7250): the press sends the lines its button counts, as one
 * delivery, and says one sentence after the answer. A line that did not read is listed. A line with one figure asks
 * what the figure is. An invoice that landed before is asked about before it lands again. Since v2.7267 a delivery
 * the office answered line by line keeps each refused line with its reason and sends it again under its own id.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type SentLine = { id: string; partName: string; quantity: number; note?: string }
type Outcome = { kind: string; first?: boolean; message?: string; rows?: { landed: string[]; refused: Array<{ id: string; message: string; code: string | null }> } }
const data = vi.hoisted(() => ({
  movements: [] as unknown[],
  outcome: { kind: 'landed' } as Outcome,
  /** An answer that reads the lines sent, for the line-by-line case; null answers with `outcome`. */
  answer: null as null | ((lines: SentLine[]) => Outcome),
  deliveries: [] as Array<{ source: string; lines: SentLine[] }>,
  prices: [] as Array<[string, number]>,
  /** The boxes the Add row made (punch list #351). */
  added: [] as Array<{ label: string; kind: string; where: string; said?: string | null }>,
}))
const unsorted = { id: 'un', jobId: 'ja', label: 'Unsorted', kind: 'unsorted', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' }

vi.mock('../../lib/materials/onSiteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/materials/onSiteStore')>()),
  jobIdsWithData: () => ['ja'],
  listContainers: () => [unsorted],
  listMovements: () => data.movements,
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  unsortedContainer: () => unsorted,
  loadJob: () => Promise.resolve(),
  loadBookPrices: async () => {},
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
  rememberPrice: (key: string, price: number) => void data.prices.push([key, price]),
  addContainer: (input: { label: string; kind: string; where: string; said?: string | null }) => {
    data.added.push({ label: input.label, kind: input.kind, where: input.where, said: input.said })
    return { ...unsorted, id: 'new', label: input.label, kind: input.kind }
  },
  addDelivery: (input: { source: string; lines: SentLine[] }) => {
    data.deliveries.push({ source: input.source, lines: [...input.lines] })
    return Promise.resolve(data.answer ? data.answer([...input.lines]) : data.outcome)
  },
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
// The job's stickers (punch list #329, PR 3): none in these tests.
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '' }, toPrint: [], loaded: true, refresh: () => {} }) }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'
import { moneyText } from '../../test/moneyText'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2', job_address: null, google_drive_link: null }]

afterEach(() => {
  cleanup()
  data.movements = []
  data.outcome = { kind: 'landed' }
  data.answer = null
  data.deliveries.length = 0
  data.prices.length = 0
  data.added.length = 0
})

/** Open the job, its Deliveries panel and the paste box, paste the text and read it. */
function paste(text: string) {
  renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site&job=ja' })
  fireEvent.click(screen.getByRole('tab', { name: /came in/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Paste the text instead' }))
  fireEvent.change(screen.getByLabelText('The invoice’s text'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Read the lines' }))
}
const addButton = () => screen.getByRole('button', { name: /to Unsorted as a delivery$/ })

describe('a job’s Deliveries panel', () => {
  it('sends the lines its button counts as one delivery, and says so once after the answer', async () => {
    paste('Invoice ZZ1\n25 EA ZZ test elbow 4.70 117.50\n4 EA ZZ test tee 1.90 7.60\n12 EA ZZ test wax ring 2.10 25.20')
    // One line is typed down to nothing: the button counts two, and two go.
    fireEvent.change(screen.getAllByLabelText('Quantity')[1]!, { target: { value: '0' } })
    expect(addButton().textContent).toBe('Add 2 lines to Unsorted as a delivery')
    fireEvent.click(addButton())
    await waitFor(() => expect(data.deliveries).toHaveLength(1))
    expect(data.deliveries[0]).toMatchObject({ source: 'INV-ZZ1', lines: [{ partName: 'ZZ test elbow', quantity: 25, note: 'ea' }, { partName: 'ZZ test wax ring', quantity: 12, note: 'ea' }] })
    // Each line goes under an id of its own, minted when the lines were read (v2.7267).
    expect(data.deliveries[0]!.lines.map((l) => typeof l.id === 'string' && l.id.length > 0)).toEqual([true, true])
    expect(await screen.findByText('2 lines from INV-ZZ1 landed in Unsorted as a delivery.')).toBeTruthy()
    expect(data.prices).toEqual([['text:zz test elbow', 4.7], ['text:zz test wax ring', 2.1]])
    // The line that did not go stays, to finish or to leave out.
    expect(screen.getAllByLabelText('Part').map((i) => (i as HTMLInputElement).value)).toEqual(['ZZ test tee'])
  })

  it('says the lines wait when there is no signal, and keeps them on a refusal with no word of success', async () => {
    data.outcome = { kind: 'queued', first: true }
    paste('2 EA ZZ test tee 1.90 3.80')
    fireEvent.click(addButton())
    expect(await screen.findByText('1 line from invoice is kept on this device. It sends by itself when the signal is back.')).toBeTruthy()
    // Kept lines keep the price the invoice gave, like landed ones.
    expect(data.prices).toEqual([['text:zz test tee', 1.9]])
    cleanup()
    data.deliveries.length = 0
    data.prices.length = 0
    data.outcome = { kind: 'refused', message: 'Only this job’s team may add to it.' }
    paste('2 EA ZZ test tee 1.90 3.80')
    fireEvent.click(addButton())
    await waitFor(() => expect(data.deliveries).toHaveLength(1))
    await waitFor(() => expect((addButton() as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText(/landed in Unsorted/)).toBeNull()
    expect(screen.getAllByLabelText('Part').map((i) => (i as HTMLInputElement).value)).toEqual(['ZZ test tee'])
    expect(data.prices).toEqual([])
  })

  it('lists a line that did not read, and takes it as a line to finish on a press', () => {
    paste('25 EA ZZ test elbow 4.70 117.50\n2 1/2" x 10 ZZ test pipe')
    const box = screen.getByTestId('delivery-not-read')
    expect(box.textContent).toContain('1 line was not read. Add it as a line, or leave it out.')
    expect(box.textContent).toContain('2 1/2" x 10 ZZ test pipe')
    fireEvent.click(screen.getByRole('button', { name: 'Add it as a line' }))
    expect(screen.queryByTestId('delivery-not-read')).toBeNull()
    expect(screen.getAllByLabelText('Part').map((i) => (i as HTMLInputElement).value)).toEqual(['ZZ test elbow', '2 1/2" x 10 ZZ test pipe'])
    // It has no count yet, so the button does not count it.
    expect(addButton().textContent).toBe('Add 1 line to Unsorted as a delivery')
  })

  it('asks what one figure on a line is, and lands the price the office says', async () => {
    paste('25 EA ZZ test elbow 117.50')
    expect(screen.getByTestId('delivery-lone-figure').textContent).toContain('Until you say, those lines land with no price.')
    fireEvent.click(screen.getByRole('button', { name: 'The line’s total' }))
    expect(screen.getByText(moneyText('$4.70'))).toBeTruthy()
    fireEvent.click(addButton())
    await waitFor(() => expect(data.prices).toEqual([['text:zz test elbow', 4.7]]))
  })

  it('asks before an invoice that landed on this job lands again', async () => {
    data.movements = [{ id: 'm1', jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 25, reason: 'delivered', fromContainerId: null, toContainerId: 'un', note: '', byUserId: 'u1', byName: 'Sam', at: '2026-11-03T15:00:00Z', source: 'INV-ZZ1', itemId: null }]
    paste('Invoice ZZ1\n25 EA ZZ test elbow 4.70 117.50')
    expect(screen.getByTestId('delivery-landed-before').textContent).toBe('INV-ZZ1 already landed 1 line on this job.')
    fireEvent.click(addButton())
    // The window names the act, and nothing has gone yet.
    const again = await screen.findByRole('button', { name: 'Add 1 line again' })
    expect(data.deliveries).toEqual([])
    fireEvent.click(again)
    await waitFor(() => expect(data.deliveries).toHaveLength(1))
  })

  it('refused part way, keeps the refused line with its reason and sends it again under its own id, never the landed ones (v2.7267)', async () => {
    const CHECK = 'new row violates check constraint "job_material_movements_quantity_check"'
    data.answer = (lines) => ({ kind: 'refused', message: `2 of 3 landed. 1 was refused: ${CHECK}`, rows: { landed: [lines[0]!.id, lines[2]!.id], refused: [{ id: lines[1]!.id, message: CHECK, code: '23514' }] } })
    paste('Invoice ZZ1\n25 EA ZZ test elbow 4.70 117.50\n4 EA ZZ test tee 1.90 7.60\n12 EA ZZ test wax ring 2.10 25.20')
    fireEvent.click(addButton())
    await waitFor(() => expect(data.deliveries).toHaveLength(1))
    const sent = data.deliveries[0]!.lines
    const box = await screen.findByTestId('delivery-part')
    expect(box.textContent).toContain('2 lines from INV-ZZ1 landed in Unsorted as a delivery. 1 line did not save.')
    expect(box.textContent).toContain('It stays below with its reason. Press Add 1 line to Unsorted as a delivery to send it again. The lines that landed are not sent again.')
    expect(screen.getByTestId('delivery-line-refused').textContent).toBe(`Did not save: ${CHECK}`)
    // The landed lines left the table with their prices kept; the refused one stays, with no word of landing.
    expect(screen.getAllByLabelText('Part').map((i) => (i as HTMLInputElement).value)).toEqual(['ZZ test tee'])
    expect(addButton().textContent).toBe('Add 1 line to Unsorted as a delivery')
    expect(data.prices).toEqual([['text:zz test elbow', 4.7], ['text:zz test wax ring', 2.1]])
    expect(screen.queryByText(/landed in Unsorted as a delivery\.$/)).toBeNull()
    // The job now holds the two landed rows under this press's ids: that is not a landing "before", so nothing is asked.
    data.movements = [sent[0]!.id, sent[2]!.id].map((id) => ({ id, jobId: 'ja', partId: null, partName: 'x', manufacturer: null, quantity: 1, reason: 'delivered', fromContainerId: null, toContainerId: 'un', note: '', byUserId: 'u1', byName: 'Sam', at: '2026-11-14T15:00:00Z', source: 'INV-ZZ1', itemId: null }))
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } })
    expect(screen.queryByTestId('delivery-landed-before')).toBeNull()
    // The second press sends the mended line alone, under the id it had, and the table clears on the landing.
    data.answer = () => ({ kind: 'landed' })
    fireEvent.click(addButton())
    await waitFor(() => expect(data.deliveries).toHaveLength(2))
    expect(data.deliveries[1]!.lines).toEqual([{ id: sent[1]!.id, partName: 'ZZ test tee', quantity: 5, note: 'ea' }])
    expect(await screen.findByText('1 line from INV-ZZ1 landed in Unsorted as a delivery.')).toBeTruthy()
    expect(screen.queryByTestId('delivery-part')).toBeNull()
    expect(screen.queryAllByLabelText('Part')).toEqual([])
  })
})

describe('the office’s Add a container row (punch list #351)', () => {
  it('opens on the next free name with How it sits remembered, moves words typed after the name to What is in it, and says so', () => {
    try { localStorage.setItem('pt.box.lastKind', 'box') } catch { /* no storage */ }
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site&job=ja' })
    fireEvent.click(screen.getByTestId('materials-add-container'))
    // The job holds Unsorted alone, so the site has no named box yet: the row asks for the letter once.
    const name = screen.getByLabelText('Its name') as HTMLInputElement
    expect(name.value).toBe('')
    expect(screen.getByTestId('materials-add-say').textContent).toBe('This site has no named box yet. Type the letters painted on the steel and the number 1, like R1.')
    expect((screen.getByRole('button', { name: 'Add it' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('How it sits') as HTMLSelectElement).value).toBe('box')
    fireEvent.change(name, { target: { value: 'r' } })
    expect(screen.getByTestId('materials-add-say').textContent).toBe('R1 is the first R box on this site.')
    fireEvent.change(name, { target: { value: 'R76 TOILETS' } })
    expect(screen.getByTestId('materials-add-say').textContent).toBe('The name is R76. “Toilets” moved to What is in it.')
    expect((screen.getByTestId('materials-add-line') as HTMLInputElement).value).toBe('Toilets')
    fireEvent.change(screen.getByLabelText('Where exactly'), { target: { value: 'by the north stair' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add R76' }))
    expect(data.added).toEqual([{ label: 'R76', kind: 'box', where: 'by the north stair', said: 'Toilets' }])
  })
})
