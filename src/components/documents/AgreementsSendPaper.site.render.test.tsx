// @vitest-environment jsdom
/**
 * Documents → Agreements, Send a paper, the site (punch list #439, piece 3): an outside company's paper can name a
 * site. The email window says the paper names none and offers **Name a site…**. The window that opens finds an
 * address on file. A company holds a paper once for each site and once for none: a copy for another site is never
 * reused, a copy out for the picked site is offered again, and a signature for it stops the send with the reason.
 * The site is written with the row at Send, and never before. Every name and address here is made up.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { AgreementsSendPaper } from './AgreementsSendPaper'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const BARN = '118 Old Quarry Trl Barn, Sampleton, TX'
const KEY_QUARRY = '118 old quarry trail sampleton tx'
const KEY_BARN = '118 old quarry trail barn sampleton tx'
const CONTACT = '3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d'

const io = vi.hoisted(() => ({
  personDocuments: [] as unknown[],
  found: null as string | null,
  /** What the send wrote, in order. */
  wrote: [] as string[],
  addressRows: [] as unknown[],
  failAddresses: null as unknown,
  answers: [] as unknown[],
  failAnswers: false,
  /** What the signer's page answers when asked whether it can show an address: yes, no, or no answer at all. */
  showsSite: true as boolean | 'fail',
}))
vi.mock('../../lib/contracts/sitePrintReadyIo', () => ({
  readSignerPageShowsSite: async () => {
    if (io.showsSite === 'fail') throw new Error('Failed to fetch')
    return io.showsSite
  },
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsSendIo', () => ({
  readAgreementsSendBook: async () => ({
    book: [{ id: 'b1', document_name: 'Vendor NDA', book_body_html: '<p>Words</p>', book_body_format: 'html', canonical_document_url: null, form_template_id: null, book_version_date: null, updated_at: '2026-10-01T00:00:00Z', audience: 'sub', flow_kind: null }],
    personDocuments: io.personDocuments,
    rosterNames: [],
    roster: [],
  }),
}))
vi.mock('../../lib/documents/paperPartyIo', () => ({
  readPartyShortLists: async () => ({
    customerPeople: [],
    supplyHouses: [{ id: 'h1', name: 'Tallgrass Supply Co.' }],
    reps: [{ id: 'r1', name: 'Lena Park', label: 'Branch manager', email: 'lena@tallgrass.example', houseId: 'h1', houseName: 'Tallgrass Supply Co.' }],
  }),
  searchPartyCustomers: async () => [],
  findPartyContacts: async () => (io.found ? [io.found] : []),
  readCopiesOut: async (ids: string[]) => ids.map((docId) => ({ docId, signerName: 'Lena Park', signerTitle: 'Branch manager', signerEmail: 'lena@tallgrass.example', sentAt: '2026-11-01T18:00:00Z' })),
  readPartyContact: async () => CONTACT,
  makeContactForAddress: async () => CONTACT,
  keepSignerWithBusiness: async () => ({ table: 'supply_house_contacts', id: 'r-new' }),
}))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({
  readPersonSendFactsByName: async (personName: string, documentName: string) => ({ target: { personName, documentName }, initialEmail: '', personId: null, sender: null }),
  readSenderFacts: async () => ({ name: 'Grace Hale', email: 'grace@example.com' }),
  materializeQuickSendRow: async (pending: { plan: { kind: string }; site?: Record<string, unknown> }) => {
    io.wrote.push(`wrote ${pending.plan.kind} ${pending.site ? JSON.stringify(pending.site) : 'no site'}`)
    return 'new-row'
  },
  writePaperPrintsAddress: async (documentId: string, printsAddress: boolean) => {
    io.wrote.push(`print ${documentId} ${printsAddress ? 'on' : 'off'}`)
  },
}))
vi.mock('../../hooks/useAddressesOnFile', () => ({
  readAddresses: async () => {
    if (io.failAddresses) throw io.failAddresses
    return { rows: io.addressRows, developments: new Map([['d1', 'Old Quarry Ranch']]) }
  },
}))
vi.mock('../../hooks/useAddressLookAlikes', () => ({
  readAnswers: async () => {
    if (io.failAnswers) throw new Error('refused')
    return io.answers
  },
}))
// The Send window is its own file's to test: here it draws the site's line it was handed, and its button sends.
vi.mock('../contracts/ContractSendWindow', () => ({
  ContractSendWindow: (p: {
    again?: boolean
    docId: string | null
    siteSlot?: ReactNode
    preparePartyPaper?: (input: { signerName: string; signerEmail: string; typedCompany: string; keep: boolean }) => Promise<string>
    onRowWritten?: (docId: string) => void
  }) => (
    <div data-testid="send-window">
      {`${p.again ? 'again' : 'first'}|${p.docId}`}
      {p.siteSlot}
      {p.preparePartyPaper ? (
        <button
          type="button"
          onClick={() =>
            void p.preparePartyPaper!({ signerName: 'Lena Park', signerEmail: 'lena@tallgrass.example', typedCompany: '', keep: false }).then((docId) => {
              // As the real window does: the row is pinned once it is written, and the email goes after. Here it never goes.
              p.onRowWritten?.(docId)
              io.wrote.push(`sends ${docId}`)
            })
          }
        >
          fake party send
        </button>
      ) : null}
    </div>
  ),
}))

const paper = (over: Record<string, unknown>) => ({ id: 'd1', person_name: `party:${CONTACT}`, document_name: 'Vendor NDA', status: 'sent', lineage_version: 1, sent_at: '2026-11-01T00:00:00Z', signer_last_viewed_at: null, signed_at: null, url: null, signing_body_html: '<p>Words</p>', signing_body_format: 'html', canonical_document_url: null, ...over })

beforeEach(() => {
  io.personDocuments = []
  io.found = null
  io.wrote = []
  io.failAddresses = null
  io.answers = []
  io.failAnswers = false
  io.showsSite = true
  io.addressRows = [
    { kind: 'job', id: 'j1', address: QUARRY, developmentId: 'd1', label: 'J1340' },
    { kind: 'job', id: 'j2', address: QUARRY, developmentId: 'd1', label: 'J1352' },
    { kind: 'bid', id: 'b9', address: BARN, developmentId: null, label: 'B214' },
  ]
})
afterEach(() => cleanup())

/** Send a paper, the paper, then a pick under Supply houses: the email window is open. */
async function openOn(pick: RegExp) {
  renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} startOn={{ documentName: 'Vendor NDA' }} />)
  await screen.findByRole('dialog', { name: 'Send Vendor NDA: who is it with?' })
  fireEvent.click(screen.getByRole('button', { name: 'Supply houses' }))
  fireEvent.click(await screen.findByRole('button', { name: pick }))
}
const siteLine = () => screen.getByTestId('contract-send-site')
async function pickSite(typed: string, row: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /^(Name a site…|Change the site…)$/ }))
  await screen.findByRole('dialog', { name: 'Which site is it for?' })
  fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: typed } })
  fireEvent.click(await screen.findByRole('button', { name: row }))
}

describe('Send a paper · the site', () => {
  it('a new paper names no site until one is named, and a send with none writes none', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    expect(siteLine().textContent).toBe('This paper names no site.Name a site…')
    expect(screen.queryByRole('dialog', { name: 'Which site is it for?' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toEqual(['wrote insert no site', 'sends new-row']))
  })

  it('finds an address on file, takes it as the site, and writes it with the row at Send and not before', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    fireEvent.click(screen.getByRole('button', { name: 'Name a site…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Which site is it for?' })
    expect(await screen.findByTestId('paper-site-hint')).toHaveProperty('textContent', 'Type three letters or more of the address.')
    fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: '118 old' } })
    await waitFor(() => expect(Array.from(dialog.querySelectorAll('[data-testid="paper-site-row"]')).map((b) => b.textContent)).toEqual([`${QUARRY}2 jobs · Old Quarry Ranch`, `${BARN}1 bid`]))
    fireEvent.click(screen.getByRole('button', { name: /^118 Old Quarry Trl, Sampleton, TX/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Which site is it for?' })).toBeNull())
    expect(siteLine().textContent).toBe(`For the site at ${QUARRY}.Change the site…Take the site off`)
    expect(io.wrote).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() =>
      expect(io.wrote).toEqual([`wrote insert ${JSON.stringify({ site_development_id: null, site_address_key: KEY_QUARRY, site_address: QUARRY, site_prints_address: false })}`, 'sends new-row']),
    )
  })

  it('a copy the company has with no site is not taken for the site’s paper, and the other way round', async () => {
    io.personDocuments = [paper({ id: 'no-site' })]
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(siteLine().textContent).toContain('For the site at'))
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote[0]).toContain(`"site_address_key":"${KEY_QUARRY}"`))
    expect(io.wrote).toHaveLength(2)
    cleanup()

    // A copy for the site, and a send that names none: a row of its own.
    io.wrote = []
    io.personDocuments = [paper({ id: 'at-quarry', site_address_key: KEY_QUARRY })]
    await openOn(/^Lena Park/)
    fireEvent.click(await screen.findByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toEqual(['wrote insert no site', 'sends new-row']))
  })

  it('a copy already out for the picked site is offered again, with the site said, and nothing is written', async () => {
    io.found = CONTACT
    io.personDocuments = [paper({ id: 'at-quarry', site_address_key: KEY_QUARRY })]
    await openOn(/^Tallgrass Supply Co\./)
    // The copy names a site, so the look for a paper with none finds nothing and the email window opens.
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    const out = await screen.findByRole('dialog', { name: 'Vendor NDA is already out' })
    expect(out.textContent).toContain('Tallgrass Supply Co. has one copy waiting on a signature.')
    expect(screen.getByTestId('party-out-site').textContent).toBe(`For the site at ${QUARRY}.`)
    expect(screen.queryByTestId('send-window')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Send it to Lena Park again/ }))
    // The copy that is out keeps its own site: it is not asked again.
    expect((await screen.findByTestId('send-window')).textContent).toBe('again|at-quarry')
    expect(screen.queryByTestId('contract-send-site')).toBeNull()
    expect(io.wrote).toEqual([])
  })

  it('two spellings answered Same place are one site', async () => {
    io.found = CONTACT
    io.personDocuments = [paper({ id: 'at-barn', site_address_key: KEY_BARN })]
    io.answers = [{ keyA: KEY_BARN, keyB: KEY_QUARRY, same: true, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' }]
    await openOn(/^Tallgrass Supply Co\./)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    expect(await screen.findByRole('dialog', { name: 'Vendor NDA is already out' })).toBeTruthy()
    cleanup()

    // With the answers refused, the same spelling is still the same site, and another spelling is another.
    io.failAnswers = true
    await openOn(/^Tallgrass Supply Co\./)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(siteLine().textContent).toContain(`For the site at ${QUARRY}.`))
    expect(screen.queryByRole('dialog', { name: 'Vendor NDA is already out' })).toBeNull()
  })

  it('a signature for the site stops the send with the reason, and the paper still names no site', async () => {
    io.found = CONTACT
    io.personDocuments = [paper({ id: 'signed', status: 'signed', signed_at: '2026-11-12T18:00:00Z', site_address_key: KEY_QUARRY })]
    await openOn(/^Tallgrass Supply Co\./)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    expect(await screen.findByText('Tallgrass Supply Co. signed Vendor NDA for this site on Nov 12. One signature covers a site.')).toBeTruthy()
    expect(siteLine().textContent).toBe('This paper names no site.Name a site…')
    expect(io.wrote).toEqual([])
  })

  it('Take the site off, It is not for a site and Escape each do their one thing', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl Barn/)
    await waitFor(() => expect(siteLine().textContent).toContain(`For the site at ${BARN}.`))
    fireEvent.click(screen.getByRole('button', { name: 'Take the site off' }))
    await waitFor(() => expect(siteLine().textContent).toBe('This paper names no site.Name a site…'))

    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(siteLine().textContent).toContain(`For the site at ${QUARRY}.`))
    fireEvent.click(screen.getByRole('button', { name: 'Change the site…' }))
    fireEvent.click(await screen.findByRole('button', { name: /^It is not for a site/ }))
    await waitFor(() => expect(siteLine().textContent).toBe('This paper names no site.Name a site…'))

    // Escape closes the site's window alone: the email window, and what was typed in it, stays.
    fireEvent.click(screen.getByRole('button', { name: 'Name a site…' }))
    await screen.findByRole('dialog', { name: 'Which site is it for?' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Which site is it for?' })).toBeNull())
    expect(screen.getByTestId('send-window')).toBeTruthy()
  })

  it('an address that is not on file is no site, and a read that fails says so', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    fireEvent.click(screen.getByRole('button', { name: 'Name a site…' }))
    await screen.findByRole('dialog', { name: 'Which site is it for?' })
    fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: '9000 nowhere' } })
    expect(await screen.findByText('No addresses on file match ‘9000 nowhere’.')).toBeTruthy()
    expect(screen.getByTestId('paper-site-hint').textContent).toBe('A site is an address a job or a bid already has.')
    expect(screen.queryAllByTestId('paper-site-row')).toEqual([])
    cleanup()

    io.failAddresses = new Error('permission denied for table jobs_ledger')
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    fireEvent.click(screen.getByRole('button', { name: 'Name a site…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Which site is it for?' })
    await waitFor(() => expect(dialog.textContent).toContain('permission denied for table jobs_ledger'))
  })
})

/**
 * Part 3e: the box **Print the site's address on the paper** under a named site. Off until ticked, its words say what
 * the signer reads, and it is dead until the signer's page can show an address.
 */
describe('Send a paper · the box that prints the site’s address', () => {
  const BOX = 'Print the site’s address on the paper'
  const box = () => screen.getByRole('checkbox', { name: BOX }) as HTMLInputElement
  const hint = () => screen.getByTestId('contract-send-site-print-hint').textContent

  it('there is no box until a site is named, then it is there, off, and says the signer reads nothing', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    expect(screen.queryByRole('checkbox', { name: BOX })).toBeNull()
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(hint()).toBe('The signer reads nothing about the site.'))
    expect(box().checked).toBe(false)
    expect(box().disabled).toBe(false)
    // Left off, the send writes the print off.
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toHaveLength(2))
    expect(io.wrote[0]).toContain('"site_prints_address":false')
  })

  it('ticked, the words say the line the signer reads, and the send writes the print on with the row', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(box())
    expect(box().checked).toBe(true)
    expect(hint()).toBe(`Above the paper the signer reads Site address: ${QUARRY}.`)
    expect(io.wrote).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() =>
      expect(io.wrote).toEqual([`wrote insert ${JSON.stringify({ site_development_id: null, site_address_key: KEY_QUARRY, site_address: QUARRY, site_prints_address: true })}`, 'sends new-row']),
    )
  })

  it('a new site unticks the box, and taking the site off takes the box away', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(box())
    expect(box().checked).toBe(true)
    await pickSite('118 old', /^118 Old Quarry Trl Barn/)
    await waitFor(() => expect(siteLine().textContent).toContain(`For the site at ${BARN}.`))
    await waitFor(() => expect(box().disabled).toBe(false))
    expect(box().checked).toBe(false)
    expect(hint()).toBe('The signer reads nothing about the site.')
    fireEvent.click(screen.getByRole('button', { name: 'Take the site off' }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: BOX })).toBeNull())
  })

  it('is dead and off while the signer’s page cannot show an address, and a send then writes the print off', async () => {
    io.showsSite = false
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(hint()).toBe('The signer’s page cannot show an address yet. This stays off until it can.'))
    expect(box().disabled).toBe(true)
    expect(box().checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toHaveLength(2))
    expect(io.wrote[0]).toContain('"site_prints_address":false')
    cleanup()

    // The page did not answer at all: the same hold, with its own reason.
    io.showsSite = 'fail'
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(hint()).toBe('The signer’s page did not answer, so this stays off. Close this window and try again.'))
    expect(box().disabled).toBe(true)
  })

  it('once the row is written the site and the box stand as sent: no press changes them before the send is pressed again', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(box())
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toHaveLength(2))
    // The email has not gone (a send that failed after the write). The window is still open on the same row.
    await waitFor(() => expect(siteLine().textContent).toBe(`For the site at ${QUARRY}.Kept with the paper when Send email was pressed.`))
    expect(screen.queryByRole('button', { name: 'Change the site…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take the site off' })).toBeNull()
    expect(box().checked).toBe(true)
    expect(box().disabled).toBe(true)
    expect(hint()).toBe(`Above the paper the signer reads Site address: ${QUARRY}.`)
  })

  it('a paper sent with no site stands as sent too', async () => {
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(siteLine().textContent).toBe('This paper names no site.Kept with the paper when Send email was pressed.'))
    expect(screen.queryByRole('button', { name: 'Name a site…' })).toBeNull()
  })

  it('a copy that was there already takes the box as the office left it, and is written only when it differs', async () => {
    // A copy for the site under this contact, which the look before the email window did not find (no contact yet).
    io.personDocuments = [paper({ id: 'at-quarry', site_address_key: KEY_QUARRY, site_prints_address: false })]
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(box())
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toEqual(['print at-quarry on', 'sends at-quarry']))
    cleanup()

    // Left off on a copy that prints nothing: nothing is written.
    io.wrote = []
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toEqual(['sends at-quarry']))
    cleanup()

    // Left off on a copy that printed it: the print is turned off.
    io.wrote = []
    io.personDocuments = [paper({ id: 'at-quarry', site_address_key: KEY_QUARRY, site_prints_address: true })]
    await openOn(/^Lena Park/)
    await screen.findByTestId('send-window')
    await pickSite('118 old', /^118 Old Quarry Trl, Sampleton, TX/)
    await waitFor(() => expect(box().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.wrote).toEqual(['print at-quarry off', 'sends at-quarry']))
  })
})
