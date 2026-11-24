// @vitest-environment jsdom
/**
 * Render smoke for the bill viewer (punch list #431, PR 2): the paper for a bill, Previous and Next with the keys,
 * the list beside it, the share press, the facts, a bill with no PDF, a file the app cannot open, and a bill the
 * reader may not open. Every house, number, date and amount is made up.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { BillFacts, BillViewerItem } from '../../lib/materials/bills/billViewer'
import type { BillBytes, BillLoad, BillViewerIo } from '../../lib/materials/bills/billViewerIo'

vi.mock('./BillPdfPages', () => ({
  BillPdfPages: ({ pageFrom, pageTo }: { pageFrom: number | null; pageTo: number | null }) => <div data-testid="bill-pages">pages {String(pageFrom)} to {String(pageTo)}</div>,
}))
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-23' }))
const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.urls.push(url) }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { BillViewer } from './BillViewer'

const ITEMS: BillViewerItem[] = [
  { invoiceId: 'a', number: 'HS-204418', house: 'Harlow Supply', dateYmd: '2026-11-16', amount: 560 },
  { invoiceId: 'b', number: 'BW 7731-02', house: 'Brightwater Pipe & Valve', dateYmd: '2026-11-13', amount: 40.48 },
  { invoiceId: 'c', number: 'CF117406', house: 'Cedar Fork Wholesale', dateYmd: '2025-12-18', amount: 1085.58 },
]

function facts(id: string, over: Partial<BillFacts> = {}): BillFacts {
  const item = ITEMS.find((i) => i.invoiceId === id)!
  return {
    invoiceId: id,
    number: item.number,
    house: item.house,
    houseSite: 'https://house.example',
    dateYmd: item.dateYmd,
    poText: 'LC-C 114',
    total: item.amount * 2,
    kind: 'invoice',
    onJob: { pct: 50, amount: item.amount },
    paid: false,
    paidOnYmd: null,
    link: `https://drive.example/file/d/${id}/view`,
    ownCopyPath: null,
    pageFrom: 4,
    pageTo: 5,
    linesWords: '7 lines · adds up',
    linesTone: 'ok',
    lines: [],
    ...over,
  }
}

function fakeIo(over: { bills?: Record<string, BillLoad>; bytes?: Record<string, BillBytes> } = {}) {
  const asked = { bills: [] as string[], bytes: [] as string[] }
  const io: BillViewerIo = {
    loadBill: async (id, jobId) => {
      asked.bills.push(`${id}|${jobId ?? ''}`)
      return over.bills?.[id] ?? { facts: facts(id) }
    },
    loadBillBytes: async (f) => {
      asked.bytes.push(f.invoiceId)
      return over.bytes?.[f.invoiceId] ?? { bytes: new ArrayBuffer(8) }
    },
  }
  return { io, asked }
}

function Harness({ io, start = 'a', items = ITEMS, onClose = () => {}, search = false, markWords }: { io: BillViewerIo; start?: string; items?: BillViewerItem[]; onClose?: () => void; search?: boolean; markWords?: string[] }) {
  const [openId, setOpenId] = useState(start)
  const [query, setQuery] = useState('')
  const shown = search && query ? items.filter((i) => i.number.toLowerCase().includes(query.toLowerCase())) : items
  return <BillViewer items={shown} openId={openId} onOpen={setOpenId} onClose={onClose} jobId="job-1" io={io} shareUrlOf={(id) => `https://app.example/files/bills/${id}?job=job-1`} search={search ? { query, onQuery: setQuery } : null} markWords={markWords} />
}
let written: string[] = []
beforeEach(() => {
  opened.urls = []
  written = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void written.push(text) } })
})
afterEach(() => cleanup())

describe('BillViewer', () => {
  it('draws the bill’s own pages, its facts and where it sits in the list', async () => {
    const { io, asked } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    const dialog = screen.getByRole('dialog', { name: 'Invoice HS-204418' })
    expect(within(dialog).getByTestId('bill-pages').textContent).toBe('pages 4 to 5')
    expect(screen.getAllByTestId('bill-position')[0]!.textContent).toBe('1 of 3')
    const f = screen.getByTestId('bill-facts')
    expect(f.textContent).toContain('Harlow Supply')
    expect(f.textContent).toContain('Nov 16')
    expect(f.textContent).toContain('LC-C 114')
    expect(f.textContent).toContain('$1,120.00')
    expect(f.textContent).toContain('50%')
    expect(f.textContent).toContain('$560.00')
    expect(f.textContent).toContain('The rest is not on this job.')
    expect(f.textContent).toContain('7 lines · adds up')
    expect(f.textContent).toContain('Not yet')
    // The bill was read with its job, so what is on the job shows.
    expect(asked.bills[0]).toBe('a|job-1')
  })

  it('Next and Previous flip, and the ends are dead presses', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    const top = screen.getByTestId('bill-nav-top')
    expect((within(top).getByRole('button', { name: /Previous/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(top).getByRole('button', { name: /Next/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice BW 7731-02' })).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('bill-nav-top')).getByRole('button', { name: /Next/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice CF117406' })).toBeTruthy()
    expect((within(screen.getByTestId('bill-nav-top')).getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true)
    // A date from another year keeps its year.
    expect(screen.getByTestId('bill-facts').textContent).toContain('Dec 18, 2025')
    fireEvent.click(within(screen.getByTestId('bill-nav-top')).getByRole('button', { name: /Previous/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice BW 7731-02' })).toBeTruthy()
  })

  it('the arrow keys flip and Escape closes, and no window under it hears them', async () => {
    const { io } = fakeIo()
    const onClose = vi.fn()
    const under = vi.fn()
    window.addEventListener('keydown', under)
    renderWithProviders(<Harness io={io} onClose={onClose} />)
    await settle()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice BW 7731-02' })).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice HS-204418' })).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(under).not.toHaveBeenCalled()
    window.removeEventListener('keydown', under)
  })

  it('the list beside the paper opens any bill and marks the one on show', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    const rail = screen.getByTestId('bill-rail')
    expect(within(rail).getAllByRole('button')).toHaveLength(3)
    fireEvent.click(within(rail).getByRole('button', { name: /CF117406/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice CF117406' })).toBeTruthy()
    expect(within(rail).getByRole('button', { name: /CF117406/ }).getAttribute('aria-current')).toBe('true')
    expect(within(rail).getByRole('button', { name: /HS-204418/ }).getAttribute('aria-current')).toBeNull()
  })

  it('the box types into the list’s search, and Next goes to what the search left', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} search />)
    await settle()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cf' } })
    await settle()
    // The bill on show is not in the search, so the count says so and Next is the first bill left.
    expect(screen.getAllByTestId('bill-position')[0]!.textContent).toBe('not in the search')
    fireEvent.click(within(screen.getByTestId('bill-nav-top')).getByRole('button', { name: /Next/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice CF117406' })).toBeTruthy()
    // A side arrow moves the cursor in the box and does not flip, and a down arrow flips.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    await settle()
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowLeft' })
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice CF117406' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowUp' })
    await settle()
    expect(screen.getByRole('dialog', { name: 'Invoice BW 7731-02' })).toBeTruthy()
  })

  it('a search that leaves nothing says so and offers the press that clears it', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} search />)
    await settle()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    await settle()
    expect(screen.getByText('Nothing matches.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    await settle()
    expect(within(screen.getByTestId('bill-rail')).getAllByRole('button')).toHaveLength(3)
  })

  it('the share press copies this bill’s link and says so', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} start="b" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Copy a link to this invoice' }))
    await settle()
    expect(written).toEqual(['https://app.example/files/bills/b?job=job-1'])
    expect(screen.getByText('Link copied to clipboard')).toBeTruthy()
  })

  it('Open in Drive is the way out to a tab of its own', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Open in Drive/ }))
    expect(opened.urls).toEqual(['https://drive.example/file/d/a/view'])
  })

  it('a bill with no PDF says so, offers its Edit window, and asks for no file', async () => {
    const { io, asked } = fakeIo({ bills: { a: { facts: facts('a', { link: null, pageFrom: null, pageTo: null, linesWords: 'No PDF on this bill', linesTone: 'none' }) } } })
    renderWithProviders(<Harness io={io} />)
    await settle()
    const hole = screen.getByTestId('bill-no-pdf')
    expect(hole.textContent).toContain('This bill has no PDF yet.')
    expect(within(hole).getByRole('link', { name: 'Open the bill' }).getAttribute('href')).toBe('/materials?tab=supply-houses&bill=a')
    fireEvent.click(within(hole).getByRole('button', { name: /supplier’s site/ }))
    expect(opened.urls).toEqual(['https://house.example'])
    expect(screen.queryByRole('button', { name: /Open in Drive/ })).toBeNull()
    // Only the next bill's paper was asked for ahead, never this one's.
    expect(asked.bytes).not.toContain('a')
    // The facts still read from the bill.
    expect(screen.getByTestId('bill-facts').textContent).toContain('No PDF on this bill')
  })

  it('a file the app cannot open says why in the door’s words and still offers Drive', async () => {
    const { io, asked } = fakeIo({ bytes: { a: { problem: 'That file is not in the bills folder, so the app does not open it here.', why: 'not_a_bill_file', retry: false } } })
    renderWithProviders(<Harness io={io} />)
    await settle()
    const hole = screen.getByTestId('bill-cannot-open')
    expect(hole.textContent).toContain('The app cannot open this file.')
    expect(hole.textContent).toContain('That file is not in the bills folder')
    expect(within(hole).queryByRole('button', { name: 'Try again' })).toBeNull()
    fireEvent.click(within(hole).getByRole('button', { name: /Open in Drive/ }))
    expect(opened.urls).toEqual(['https://drive.example/file/d/a/view'])
    expect(asked.bytes).toEqual(['a'])
  })

  it('a read that may go again offers Try again, and the press asks again', async () => {
    const bytes: Record<string, BillBytes> = { a: { problem: 'Drive did not hand that file over.', why: 'unanswered', retry: true } }
    const { io, asked } = fakeIo({ bytes })
    renderWithProviders(<Harness io={io} />)
    await settle()
    delete bytes.a
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await settle()
    expect(screen.getByTestId('bill-pages')).toBeTruthy()
    expect(asked.bytes.filter((id) => id === 'a')).toHaveLength(2)
  })

  it('a bill the reader may not open shows no paper and no facts', async () => {
    const { io, asked } = fakeIo({ bills: { a: { problem: 'notYours' } } })
    renderWithProviders(<Harness io={io} items={[ITEMS[0]!]} />)
    await settle()
    expect(screen.getByTestId('bill-problem').textContent).toBe('This bill is not one you can open.')
    expect(screen.queryByTestId('bill-facts')).toBeNull()
    expect(asked.bytes).toEqual([])
  })

  it('the next bill’s paper is asked for ahead, so Next draws at once', async () => {
    const { io, asked } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    await settle()
    expect(asked.bytes).toEqual(['a', 'b'])
  })

  it('the lines read from the paper sit beside it, the first few of a long bill', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({ lineNo: i + 1, code: `C-${i + 1}`, mfr: '', description: i === 8 ? '2 in. ball valve' : `copper tee ${i + 1}`, qty: i + 1, extendedCents: 1250, component: false }))
    const { io } = fakeIo({ bills: { a: { facts: facts('a', { lines }) } } })
    renderWithProviders(<Harness io={io} />)
    await settle()
    const list = screen.getByTestId('bill-lines')
    expect(list.textContent).toContain('Lines read from the paper')
    expect(list.textContent).toContain('copper tee 1')
    expect(list.textContent).toContain('C-1')
    expect(list.textContent).toContain('$12.50')
    expect(list.textContent).not.toContain('ball valve')
    fireEvent.click(within(list).getByRole('button', { name: 'Show all 10 lines' }))
    expect(list.textContent).toContain('ball valve')
    expect(within(list).queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  it('with a search on, the lines that hold its words come alone and marked', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({ lineNo: i + 1, code: `C-${i + 1}`, mfr: '', description: i === 8 ? '2 in. ball valve' : `copper tee ${i + 1}`, qty: i + 1, extendedCents: 1250, component: false }))
    const { io } = fakeIo({ bills: { a: { facts: facts('a', { lines }) } } })
    renderWithProviders(<Harness io={io} markWords={['valve']} />)
    await settle()
    const list = screen.getByTestId('bill-lines')
    expect(list.textContent).toContain('Lines that match your search')
    expect(list.querySelectorAll('[data-found="true"]')).toHaveLength(1)
    expect(within(list).getByText('valve').tagName).toBe('B')
    expect(list.textContent).not.toContain('copper tee')
    fireEvent.click(within(list).getByRole('button', { name: 'Show all 10 lines' }))
    expect(list.textContent).toContain('copper tee 1')
    expect(list.querySelectorAll('[data-found="true"]')).toHaveLength(1)
  })

  it('a bill with no lines read lists none', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} />)
    await settle()
    expect(screen.queryByTestId('bill-lines')).toBeNull()
  })

  it('one bill alone has no Previous, no Next and no list', async () => {
    const { io } = fakeIo()
    renderWithProviders(<Harness io={io} items={[ITEMS[0]!]} />)
    await settle()
    expect(screen.queryByTestId('bill-nav-top')).toBeNull()
    expect(screen.queryByTestId('bill-rail')).toBeNull()
    expect(screen.getByTestId('bill-pages')).toBeTruthy()
  })
})
