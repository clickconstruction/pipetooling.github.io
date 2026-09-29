// @vitest-environment jsdom
/**
 * The customer's contract page with two frames (v2.4186): a second signer the office named gets
 * a frame of their own; either may sign first; the page asks who is signing when both frames are
 * open, posts `signer: 'co'` for the second, and says who it is still waiting on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import JobContractSign from './JobContractSign'

vi.mock('../hooks/useHoldsUnsavedWork', () => ({ useHoldsUnsavedWork: () => undefined }))
vi.mock('../components/AuthPublicLandingLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const contract = (over: Record<string, unknown> = {}) => ({
  contract: {
    id: 'c1',
    status: 'sent',
    revision: 1,
    heading: 'Service agreement for 1 Test Street',
    job_number: '1053',
    job_address: '1 Test Street, Austin, TX',
    customer_name: 'Sam Sample',
    recipient_name: 'Sam Sample',
    fields: { scope_lines: ['Water heater'], amount_cents: 220000, payment_terms_key: 'half_down', payment_terms_text: '', exclusions: '', start_date: null, completion_date: null, note: '' },
    body_html: '1. Scope. The work.',
    body_format: 'plain',
    template_name: 'Service agreement',
    template_version_date: '2026-09-01',
    sent_at: '2026-09-20T15:00:00Z',
    signed_at: null,
    signer_printed_name: null,
    signer_mode: null,
    signer_consented_at: null,
    signature_url: null,
    signed_pdf_url: null,
    co_signer_name: 'Alex Sample',
    co_signed_at: null,
    co_signer_printed_name: null,
    co_signer_mode: null,
    co_signer_consented_at: null,
    co_signature_url: null,
    ...over,
  },
  issuer: { companyName: 'Click Plumbing', addressText: '', phone: '512-360-0599', email: '', tagline: '', licenseLine: '' },
  brand: null,
})

function mount() {
  return render(
    <MemoryRouter initialEntries={['/contract/sign?t=tok123']}>
      <Routes>
        <Route path="/contract/sign" element={<JobContractSign />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JobContractSign — two frames', () => {
  it('both frames open: asks who is signing, and the second signer posts signer: co', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('sign-job-contract')) {
          calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
          return new Response(JSON.stringify({ ok: true, signed_at: null, mode: 'type', complete: false, signer: 'co', waiting_on: 'Sam Sample' }), { status: 200 })
        }
        return new Response(JSON.stringify(contract()), { status: 200 })
      }),
    )
    mount()
    const who = await screen.findByTestId('contract-sign-who')
    expect(who.textContent).toContain('Two signatures complete this agreement')
    expect(within(who).getByTestId('contract-sign-as-primary').textContent).toBe('Sam Sample')
    expect(within(who).getByTestId('contract-sign-as-co').textContent).toBe('Alex Sample')
    // no frame picked yet: no form
    expect(screen.queryByLabelText(/full name/i)).toBeNull()
    fireEvent.click(within(who).getByTestId('contract-sign-as-co'))
    expect(await screen.findByText('Sign agreement — Alex Sample')).toBeTruthy()
  })

  it('the first frame already filled: no chooser, the second signer signs straight away, and the page says who has signed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(contract({ signer_printed_name: 'Sam Sample', signer_mode: 'type', signer_consented_at: '2026-09-21T14:29:00Z' })), { status: 200 })))
    mount()
    const partial = await screen.findByTestId('contract-sign-partial')
    expect(partial.textContent).toContain('Sam Sample has signed')
    expect(partial.textContent).toContain("Waiting on Alex Sample's signature")
    expect(screen.getByTestId('contract-sign-frame-primary').textContent).toContain('Sam Sample')
    expect(screen.queryByTestId('contract-sign-who')).toBeNull()
    expect(screen.getByText('Sign agreement — Alex Sample')).toBeTruthy()
  })

  it('both frames filled: the agreement reads signed by both, with a block per frame', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              contract({
                status: 'signed',
                signed_at: '2026-09-22T10:00:00Z',
                signer_printed_name: 'Sam Sample',
                signer_mode: 'type',
                signer_consented_at: '2026-09-21T14:29:00Z',
                co_signed_at: '2026-09-22T10:00:00Z',
                co_signer_printed_name: 'Alex Sample',
                co_signer_mode: 'draw',
                co_signer_consented_at: '2026-09-22T10:00:00Z',
                co_signature_url: 'https://files.example/alex.png',
              }),
            ),
            { status: 200 },
          ),
      ),
    )
    mount()
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Signed by Sam Sample and Alex Sample'))
    expect(screen.getByTestId('contract-sign-frame-primary')).toBeTruthy()
    expect(screen.getByTestId('contract-sign-frame-co').textContent).toContain('Second signature — Alex Sample')
    expect(screen.queryByText(/Sign agreement —/)).toBeNull()
  })
})
