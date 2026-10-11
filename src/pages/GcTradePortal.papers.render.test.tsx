// @vitest-environment jsdom
/**
 * The trade portal's paperwork (P5b-1, to-dos/gc-mode/mockups/portal-p5b.md): the home's block reads the company's papers
 * and where the office's check stands; a company new to us sends its vetting form; its master agreement the office sent
 * and its W-9 open on the signing page in the same tab (`paper_link`); a refusal reads in the company's words; Needs
 * you's paper to-dos open the block; Your papers lists what it signed; and the office's preview posts nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

const goTo = vi.fn()
vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))
vi.mock('../lib/gc/tradePortalSubmit', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/gc/tradePortalSubmit')>()), goToSignPath: (path: string) => goTo(path) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const SIGN = `/contract/accept?t=${'ab'.repeat(32)}`
const reads: string[] = []
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice
let postAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true } }

/** The sample, new to us, its master agreement sent and not signed, no W-9 on file. */
function owing(s: TradePortalSlice): TradePortalSlice {
  return {
    ...s,
    company: { ...s.company, vetting_status: 'new', vetting_limit: null, vetting_decided_on: null },
    papers: [
      { id: ID.msa, company_id: ID.company, doc_type: 'agreement', status: 'sent', sent_at: '2026-10-06T15:00:00Z', signed_at: null, expires_at: null },
      { id: ID.coi, company_id: ID.company, doc_type: 'coi', status: 'signed', sent_at: null, signed_at: '2026-09-01', expires_at: '2027-09-01' },
    ],
    vettingForm: null,
  }
}

beforeEach(() => {
  reads.length = 0
  posts.length = 0
  goTo.mockClear()
  slice = owing(gcTradePortalSample(TODAY))
  postAnswer = { ok: true, body: { ok: true } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: postAnswer.ok, json: async () => postAnswer.body }
      }
      reads.push(url)
      return { ok: true, json: async () => ({ today: TODAY, slice }) }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = `/t/${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const paperwork = async () => within(await screen.findByRole('region', { name: 'Your paperwork with Click' }))

describe('the paperwork block (P5b-1)', () => {
  it('reads each paper where it stands, with a newer certificate to send (P5b-2)', async () => {
    open()
    const block = await paperwork()
    expect(block.getByText('not sent yet')).toBeTruthy()
    expect(block.getByRole('button', { name: 'Tell us about your company' })).toBeTruthy()
    expect(block.getByRole('button', { name: 'Read and sign' })).toBeTruthy()
    expect(block.getByText(/good to/)).toBeTruthy()
    expect(block.getByRole('button', { name: 'Send a newer one' })).toBeTruthy()
    expect(block.getByText('none on file')).toBeTruthy()
    expect(block.getByRole('button', { name: 'Fill in your W-9' })).toBeTruthy()
  })

  it('sends its certificate: the file first, then the kind coi with its link and the day the policy runs out (P5b-2)', async () => {
    slice = { ...slice, papers: (slice.papers ?? []).filter((p) => p.doc_type !== 'coi') }
    const posted: { ok: boolean; body: unknown }[] = [
      { ok: true, body: { ok: true, value: { id: 'f1', name: 'certificate.pdf', url: 'https://drive.google.com/file/d/up/view' } } },
      { ok: true, body: { ok: true } },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
          const a = posted.shift() ?? { ok: true, body: { ok: true } }
          return { ok: a.ok, json: async () => a.body }
        }
        reads.push(url)
        return { ok: true, json: async () => ({ today: TODAY, slice }) }
      }),
    )
    open()
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Send your certificate' }))
    const send = block.getByRole('button', { name: 'Send it to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(block.getByLabelText('A photo or PDF of the certificate'), {
      target: { files: [new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'certificate.pdf', { type: 'application/pdf' })] },
    })
    await block.findByText('certificate.pdf')
    expect((block.getByLabelText('The day the policy runs out') as HTMLInputElement).value).toBe('2027-10-08')
    fireEvent.click(send)
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[0]).toMatchObject({ token: TOKEN, kind: 'file', for: 'coi', name: 'certificate.pdf' })
    expect(posts[0]).not.toHaveProperty('submittalId')
    expect(posts[1]).toEqual({ token: TOKEN, kind: 'coi', expiresOn: '2027-10-08', fileUrl: 'https://drive.google.com/file/d/up/view' })
  })

  it('reads a certificate it sent as being checked, asks for nothing more, and drops it from Needs you (P5b-2m)', async () => {
    slice = {
      ...slice,
      papers: [
        ...(slice.papers ?? []).filter((p) => p.doc_type !== 'coi'),
        { id: 'coi-waiting', company_id: ID.company, doc_type: 'coi', status: 'received', sent_at: '2026-10-07T15:00:00Z', signed_at: null, expires_at: '2027-10-07' },
      ],
    }
    open()
    const block = await paperwork()
    expect(block.getByText('Click is checking it · sent Oct 7')).toBeTruthy()
    expect(block.queryByRole('button', { name: /Send your certificate|Send a newer one/ })).toBeNull()
    const needs = within(screen.getByRole('region', { name: /Needs you/ }))
    expect(needs.queryByText(/insurance certificate/i)).toBeNull()
  })

  it('opens the master agreement and the W-9 on the signing page, in the same tab', async () => {
    postAnswer = { ok: true, body: { ok: true, value: { signPath: SIGN } } }
    open()
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Read and sign' }))
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(SIGN))
    expect(posts).toEqual([{ token: TOKEN, kind: 'paper_link', paper: 'msa' }])
    fireEvent.click(block.getByRole('button', { name: 'Fill in your W-9' }))
    await waitFor(() => expect(posts[1]).toEqual({ token: TOKEN, kind: 'paper_link', paper: 'w9' }))
    expect(goTo).toHaveBeenCalledTimes(2)
  })

  it('goes nowhere an answer names but the signing page', async () => {
    postAnswer = { ok: true, body: { ok: true, value: { signPath: 'https://evil.example/' } } }
    open()
    fireEvent.click((await paperwork()).getByRole('button', { name: 'Read and sign' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(goTo).not.toHaveBeenCalled()
  })

  it('goes nowhere and says nothing on the sample’s answer, which carries no path', async () => {
    postAnswer = { ok: true, body: { ok: true, sample: true } }
    open()
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Fill in your W-9' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'paper_link', paper: 'w9' }]))
    expect(goTo).not.toHaveBeenCalled()
    expect(block.queryByText('Preview. Nothing is saved from here.')).toBeNull()
    expect(block.getByRole('button', { name: 'Fill in your W-9' })).toBeTruthy()
  })

  it('says a refusal under its line in the company’s words', async () => {
    postAnswer = { ok: false, body: { error: 'noW9Form' } }
    open()
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Fill in your W-9' }))
    expect(await block.findByText('The W-9 form is not ready yet. Ask Click Construction for it.')).toBeTruthy()
    expect(goTo).not.toHaveBeenCalled()
  })

  it('sends the vetting form with every line, its years a number, and reads it being checked', async () => {
    open()
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Tell us about your company' }))
    const send = block.getByRole('button', { name: 'Send it to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(block.getByLabelText('Your license: its kind and number'), { target: { value: ' TECL 12345 ' } })
    fireEvent.change(block.getByLabelText('Your insurance company and your limits'), { target: { value: 'Acme, $1M' } })
    fireEvent.change(block.getByLabelText('Years in business'), { target: { value: '5' } })
    fireEvent.change(block.getByLabelText('Two or three people we can call, with their phone numbers'), { target: { value: 'Ann 555-0101' } })
    fireEvent.change(block.getByLabelText('Jobs like this one you have done'), { target: { value: 'Two clinics' } })
    slice = { ...slice, vettingForm: { company_id: ID.company, sent_on: TODAY } }
    fireEvent.click(send)
    await waitFor(() =>
      expect(posts).toEqual([{ token: TOKEN, kind: 'vetting_form', license: 'TECL 12345', insurance: 'Acme, $1M', years: 5, references: 'Ann 555-0101', pastJobs: 'Two clinics' }]),
    )
    expect(await block.findByText(/Click is checking it/)).toBeTruthy()
    expect(block.queryByRole('button', { name: 'Tell us about your company' })).toBeNull()
  })

  it('draws no line for a company we know', async () => {
    slice = { ...slice, company: { ...slice.company, vetting_status: null } }
    open()
    expect((await paperwork()).queryByText('Your company')).toBeNull()
  })

  it('opens the block from a paper’s to-do in Needs you, the vetting form open', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    open()
    const needs = within(await screen.findByRole('region', { name: /Needs you/ }))
    fireEvent.click(needs.getByRole('button', { name: /Fill in your W-9\./ }))
    expect(scrolled).toHaveBeenCalled()
    fireEvent.click(needs.getByRole('button', { name: /about your company/ }))
    expect((await paperwork()).getByLabelText('Your license: its kind and number')).toBeTruthy()
  })

  it('lists every paper it signed on Your papers, and goes back home', async () => {
    slice = gcTradePortalSample(TODAY)
    open()
    fireEvent.click((await paperwork()).getByRole('button', { name: 'See every paper' }))
    expect(await screen.findByText('Your papers')).toBeTruthy()
    const company = within(screen.getByRole('region', { name: 'With Click' }))
    expect(company.getByText('Master agreement')).toBeTruthy()
    expect(company.getByText('W-9')).toBeTruthy()
    expect(company.getByText('on file')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '← Everything with Click' }))
    expect(await screen.findByRole('region', { name: 'Your paperwork with Click' })).toBeTruthy()
  })

  it('posts nothing from the office’s preview', async () => {
    open(`/t/${TOKEN}?preview=1`)
    const block = await paperwork()
    fireEvent.click(block.getByRole('button', { name: 'Read and sign' }))
    expect(await block.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
    expect(goTo).not.toHaveBeenCalled()
  })
})
