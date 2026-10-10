// @vitest-environment jsdom
/**
 * The trade portal's statement of work (P2c-ii, to-dos/gc-mode/mockups/portal-p2c.md): a draft says the office is
 * writing it; a sent one shows the price, the lines and what it will not do, then `/contract/accept`'s form, which needs
 * a name and the e-sign consent and posts `sign_sow`; a signed one reads its day. A refusal shows in the company's
 * words, and the office's preview posts nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const reads: string[] = []
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice
let postAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true } }

/** The sample's job with its statement of work in the given state. */
function withSow(fields: Record<string, unknown>): TradePortalSlice {
  const s = gcTradePortalSample(TODAY)
  return { ...s, sows: (s.sows ?? []).map((w) => ({ ...w, ...fields })) }
}

beforeEach(() => {
  reads.length = 0
  posts.length = 0
  slice = withSow({ status: 'sent', signed_on: null })
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

const openJob = async (title = 'Electrical · statement of work') => {
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: title }))
}

/** Type the name and tick both boxes: the e-sign consent first, then the agreement. */
function fillTheForm(sow: ReturnType<typeof within>, name = 'Dana Ortiz') {
  fireEvent.change(sow.getByPlaceholderText('Your full legal name'), { target: { value: name } })
  const boxes = sow.getAllByRole('checkbox')
  fireEvent.click(boxes[0]!)
  fireEvent.click(boxes[1]!)
}

describe('the statement of work on the company’s job (P2c-ii)', () => {
  it('says the office is writing a draft, with nothing to sign', async () => {
    slice = withSow({ status: 'draft', sent_on: null, signed_on: null })
    open()
    const got = await openJob('Electrical · you got the job')
    expect(got.getByText('Click picked your quote. Your statement of work is being written.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign the statement of work' })).toBeNull()
  })

  it('shows a sent one’s price, its lines and what it will not do, with the sign form', async () => {
    slice = withSow({ status: 'sent', signed_on: null, excluded: [{ name: 'Permits and fees', by: 'the owner' }] })
    open()
    const sow = await openJob()
    expect(sow.getByText('$48,600')).toBeTruthy()
    expect(sow.getByText(/10% held until the end · based on/)).toBeTruthy()
    expect(sow.getByText('Rough-in $29,160 · Trim and fixtures $19,440')).toBeTruthy()
    expect(sow.getByText('What you will do')).toBeTruthy()
    expect(sow.getByText('Rough-in · Trim and fixtures')).toBeTruthy()
    expect(sow.getByText('What you will not do')).toBeTruthy()
    expect(sow.getByText(/Permits and fees/)).toBeTruthy()
    expect(sow.getByText(/By signing, you agree to do this work for this price, under our master agreement\./)).toBeTruthy()
    expect(sow.getByRole('button', { name: 'Sign the statement of work' })).toBeTruthy()
  })

  it('needs a name and the e-sign consent, then posts sign_sow and reads the slice again', async () => {
    open()
    const sow = await openJob()
    fireEvent.click(sow.getByRole('button', { name: 'Sign the statement of work' }))
    expect(sow.getByText('Please enter your full name.')).toBeTruthy()
    fireEvent.change(sow.getByPlaceholderText('Your full legal name'), { target: { value: 'Dana Ortiz' } })
    fireEvent.click(sow.getByRole('button', { name: 'Sign the statement of work' }))
    expect(sow.getByText('Please tick "I agree to sign electronically" to continue.')).toBeTruthy()
    expect(posts).toEqual([])
    fillTheForm(sow)
    fireEvent.click(sow.getByRole('button', { name: 'Sign the statement of work' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      token: TOKEN,
      kind: 'sign_sow',
      sowId: ID.sow,
      printedName: 'Dana Ortiz',
      esignConsent: { version: 2, lang: 'en', audience: 'sub', documentNoun: 'this statement of work' },
    })
    expect(posts[0]).not.toHaveProperty('signaturePngBase64')
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('says a company with no signed master agreement in its words, and reads nothing again', async () => {
    postAnswer = { ok: false, body: { error: 'msaFirst' } }
    open()
    const sow = await openJob()
    fillTheForm(sow)
    fireEvent.click(sow.getByRole('button', { name: 'Sign the statement of work' }))
    expect(await sow.findByText('Sign the master agreement first.')).toBeTruthy()
    expect(reads).toHaveLength(1)
  })

  it('posts nothing from the office’s preview, and says so', async () => {
    open(`/t/${TOKEN}?preview=1`)
    const sow = await openJob()
    fillTheForm(sow)
    fireEvent.click(sow.getByRole('button', { name: 'Sign the statement of work' }))
    expect(await sow.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })

  it('reads a signed one’s day, with no form', async () => {
    slice = gcTradePortalSample(TODAY)
    open()
    const sow = await openJob()
    expect(sow.getByText(/^signed /)).toBeTruthy()
    expect(sow.queryByRole('button', { name: 'Sign the statement of work' })).toBeNull()
  })
})
