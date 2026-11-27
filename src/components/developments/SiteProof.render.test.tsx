// @vitest-environment jsdom
/**
 * **The proof** under Papers for this site (punch list #439, piece 5, part 5a): the count, **Make the packet**, the
 * packet as it prints and **Print**, with a fake for the site's secrecy. Every name here is made up.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SiteProof as Proof } from '../../lib/addresses/siteProof'
import type { SiteSecrecyRow } from '../../lib/addresses/siteSecrecy'
import type { SiteSecrecyIo } from '../../lib/addresses/siteSecrecyIo'
import type { ProofCopyFetch } from '../../lib/addresses/siteProofPdf'
import { SiteProof } from './SiteProof'

const SITE = { developmentId: 'dev-1' }
const PROOF: Proof = {
  signed: [
    { id: 'a', company: 'Tallgrass Supply Co.', paper: 'Vendor NDA', signer: 'Lena Park, Branch manager', day: 'Nov 12' },
    { id: 'b', company: 'Placeholder Fence Co.', paper: 'Vendor NDA', signer: 'Sam Placeholder, Owner', day: 'Nov 14' },
  ],
  asked: [{ id: 'w', company: 'Example Pipe & Valve', paper: 'Vendor NDA', signer: 'Lee Example', day: 'Nov 20' }],
}
const ON: SiteSecrecyRow = { id: 'site-1', development_id: 'dev-1', address_key: null, address: null, book_document_id: 'book-sec', paper_name: 'Site secrecy paper', turned_on_at: '2026-11-20T18:00:00Z', turned_off_at: null }

function fakeIo(over: Partial<SiteSecrecyIo> = {}): SiteSecrecyIo {
  return {
    readLive: vi.fn(async () => ON),
    readCounts: vi.fn(async () => ({ jobs: 3, signed: 18 })),
    preview: vi.fn(async () => ({ jobs: 3, people: 21 })),
    readBook: vi.fn(async () => []),
    turnOn: vi.fn(async () => ({ id: 'site-1', jobs: 3 })),
    turnOff: vi.fn(async () => undefined),
    ...over,
  }
}
// jsdom's Blob has no arrayBuffer, which a browser's has: the fake copy carries its own bytes.
const onePage = async (): Promise<Blob> => {
  const doc = await PDFDocument.create()
  doc.addPage([612, 792])
  const bytes = await doc.save()
  return { type: 'application/pdf', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as unknown as Blob
}
const draw = (io: SiteSecrecyIo, proof: Proof = PROOF, fetchCopy: ProofCopyFetch = onePage, save: (blob: Blob, fileName: string) => void = () => undefined) =>
  render(<SiteProof proof={proof} clientName="Sample Owner LLC" siteName="Old Quarry Ranch" site={SITE} todayYmd="2026-11-27" io={io} fetchCopy={fetchCopy} save={save} />)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SiteProof', () => {
  it('counts the companies and reads nothing of the site’s secrecy until the packet is made', async () => {
    const io = fakeIo()
    draw(io)
    const block = screen.getByTestId('site-proof')
    expect(within(block).getByRole('heading', { name: 'The proof for Sample Owner LLC' })).toBeTruthy()
    expect(screen.getByTestId('site-proof-count').textContent).toBe('2 companies signed. 1 asked, not yet signed.')
    expect(within(block).getAllByRole('button').map((b) => b.textContent)).toEqual(['Make the packet'])
    expect(io.readLive).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Make the packet opens the packet as it prints: the client, the site, who signed, who was asked and our own people as a count', async () => {
    const io = fakeIo()
    draw(io)
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    const packet = await screen.findByRole('dialog', { name: 'The packet, as it prints' })
    const sheet = within(packet).getByTestId('site-proof-sheet')
    expect(within(sheet).getByRole('heading', { name: 'The proof for Sample Owner LLC' })).toBeTruthy()
    expect(within(sheet).getByText('Old Quarry Ranch')).toBeTruthy()
    expect(within(sheet).getAllByTestId('site-proof-row').map((r) => r.textContent)).toEqual([
      'Tallgrass Supply Co.Signed by Lena Park, Branch managerVendor NDASigned Nov 12',
      'Placeholder Fence Co.Signed by Sam Placeholder, OwnerVendor NDASigned Nov 14',
      'Example Pipe & ValveSent to Lee ExampleVendor NDASent Nov 20',
    ])
    expect((await within(sheet).findByTestId('site-proof-own-people')).textContent).toBe('18 of 21 have signed. A job at this site stays shut to a person until they sign. Workers are counted, not named.')
    expect(within(sheet).getByTestId('site-proof-foot').textContent).toBe('As of Nov 27. This is the list. Download adds the signed copies.')
    expect(io.readLive).toHaveBeenCalledWith(SITE)
    // The packet is paper: light, whatever the page's theme.
    expect(packet.parentElement?.getAttribute('data-theme')).toBe('light')
  })

  it('Print prints, and Close and Escape close the packet', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    draw(fakeIo())
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    const packet = await screen.findByRole('dialog', { name: 'The packet, as it prints' })
    fireEvent.click(within(packet).getByRole('button', { name: 'Print' }))
    expect(print).toHaveBeenCalledTimes(1)
    fireEvent.click(within(packet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    await screen.findByRole('dialog', { name: 'The packet, as it prints' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Download names its count, is dead until our own people are read, and hands the browser one PDF named for the site', async () => {
    const saved: Array<{ type: string; size: number; name: string }> = []
    const asked: string[] = []
    const fetchCopy: ProofCopyFetch = async (id) => {
      asked.push(id)
      return onePage()
    }
    let release: (v: null) => void = () => undefined
    const io = fakeIo({ readLive: vi.fn(() => new Promise<null>((r) => (release = r))) })
    draw(io, PROOF, fetchCopy, (blob, name) => void saved.push({ type: blob.type, size: blob.size > 500 ? 1 : 0, name }))
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    const packet = await screen.findByRole('dialog', { name: 'The packet, as it prints' })
    const press = within(packet).getByRole('button', { name: 'Download with 2 signed copies' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    release(null)
    await waitFor(() => expect(press.disabled).toBe(false))
    fireEvent.click(press)
    expect((await screen.findByTestId('site-proof-download-outcome')).textContent).toBe('Downloaded, with 2 signed copies attached.')
    expect(asked).toEqual(['a', 'b'])
    // The pages are the kernel's to count (siteProofPdf.test.ts): here, one PDF with something in it, named for the site.
    await waitFor(() => expect(saved).toEqual([{ type: 'application/pdf', size: 1, name: 'The proof - Old Quarry Ranch.pdf' }]))
  })

  it('a copy that cannot be had is named with its reason, and the rest are still downloaded', async () => {
    const save = vi.fn()
    const fetchCopy: ProofCopyFetch = async (id) => {
      if (id === 'b') throw new Error('This paper is a form. Open its PDF from the form’s own press.')
      return onePage()
    }
    draw(fakeIo({ readLive: vi.fn(async () => null) }), PROOF, fetchCopy, save)
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Download with 2 signed copies' }))
    const outcome = await screen.findByTestId('site-proof-download-outcome')
    expect(outcome.textContent).toBe('Downloaded, with 1 of 2 signed copies attached. Not attached: Placeholder Fence Co.: This paper is a form. Open its PDF from the form’s own press.')
    expect(outcome.getAttribute('role')).toBe('status')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('with nobody signed, Download is the list alone and asks for no copy', async () => {
    const fetchCopy = vi.fn<ProofCopyFetch>(onePage)
    const save = vi.fn()
    draw(fakeIo({ readLive: vi.fn(async () => null) }), { signed: [], asked: PROOF.asked }, fetchCopy, save)
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Download the list' }))
    expect((await screen.findByTestId('site-proof-download-outcome')).textContent).toBe('Downloaded the list.')
    expect(fetchCopy).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('a site whose secrecy is off, or a database with none yet, says nothing of our own people', async () => {
    for (const live of [null, 'not-there' as const]) {
      const io = fakeIo({ readLive: vi.fn(async () => live) })
      const view = draw(io)
      fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
      await screen.findByRole('dialog', { name: 'The packet, as it prints' })
      await waitFor(() => expect(io.readLive).toHaveBeenCalled())
      expect(screen.queryByTestId('site-proof-own-people')).toBeNull()
      expect(screen.queryByText('Our own people')).toBeNull()
      expect(io.readCounts).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('a count that cannot be read is said and never guessed', async () => {
    for (const io of [fakeIo({ preview: vi.fn(async () => Promise.reject(new Error('Only the office turns on secrecy for a site.'))) }), fakeIo({ readLive: vi.fn(async () => Promise.reject(new Error('offline'))) }), fakeIo({ readCounts: vi.fn(async () => ({ jobs: 3, signed: null })) })]) {
      const view = draw(io)
      fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
      expect((await screen.findByTestId('site-proof-own-people')).textContent).toBe('Our own people sign before a job at this site opens to them. Their count could not be read just now.')
      view.unmount()
    }
  })

  it('with nobody signed yet the packet says so and lists who was asked', async () => {
    draw(fakeIo({ readLive: vi.fn(async () => null) }), { signed: [], asked: PROOF.asked })
    expect(screen.getByTestId('site-proof-count').textContent).toBe('0 companies signed. 1 asked, not yet signed.')
    fireEvent.click(screen.getByRole('button', { name: 'Make the packet' }))
    const packet = await screen.findByRole('dialog', { name: 'The packet, as it prints' })
    expect(within(packet).getByText('No company has signed yet.')).toBeTruthy()
    expect(within(packet).getAllByTestId('site-proof-row')).toHaveLength(1)
  })

  it('a site nobody was asked for draws no block', () => {
    const { container } = draw(fakeIo(), { signed: [], asked: [] })
    expect(container.querySelector('[data-testid="site-proof"]')).toBeNull()
  })
})
