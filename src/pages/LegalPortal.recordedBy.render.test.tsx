// @vitest-environment jsdom
/**
 * v2.8312 (punch list #85, a review residual): on one person's link *Recorded by* is that person, shown and
 * not picked, and the page sends no pick. On the firm's shared link it stays a pick.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import LegalPortal from './LegalPortal'
import { START_SEEN_KEY } from '../lib/legal/legalPortalStart'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeEach(() => window.localStorage.setItem(START_SEEN_KEY, 'yes'))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' }

async function openPortal(linkPerson: string | null) {
  const payload: Record<string, unknown> = { ...(sampleLegalPortalResponse(company as never, new Date().toISOString().slice(0, 10)) as unknown as Record<string, unknown>), linkPerson }
  const posts: Array<Record<string, unknown>> = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (String(url).includes('submit-legal-portal')) {
      posts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return Promise.resolve(new Response(JSON.stringify({ ok: true, entryId: 'e1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
  render(
    <MemoryRouter initialEntries={['/legal?t=tok_live']}>
      <LegalPortal />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText(/Brazos Ridge Contracting/).length).toBeGreaterThan(0))
  // The firm's acts, and who they are recorded by, sit on Fees & steps.
  fireEvent.click(screen.getByRole('button', { name: 'Fees & steps' }))
  return { posts, firstRecipientId: String(((payload.recipients as Array<{ id: string }>)[0] ?? { id: '' }).id) }
}

async function ask(question: string) {
  const box = await waitFor(() => screen.getByPlaceholderText(/Do you have the signed change order/))
  fireEvent.change(box, { target: { value: question } })
  fireEvent.submit(box.closest('form') as HTMLFormElement)
}

describe('LegalPortal — Recorded by', () => {
  it('on one person’s link the name is shown, there is nothing to pick, and the act carries no pick', async () => {
    // A pick left on this browser from the shared link must not ride along.
    window.localStorage.setItem('legalPortal.recordedBy', 'someone-else')
    const { posts } = await openPortal('Dana Reyes')
    const pinned = await waitFor(() => document.querySelector('[data-legal-recorded-by="pinned"]') as HTMLElement)
    expect(pinned.textContent).toBe('Recorded byDana ReyesThis link is yours alone, so everything saved here is recorded under your name.')
    expect(pinned.querySelector('[data-value="worked-out"]')?.textContent).toBe('Dana Reyes')
    expect(pinned.querySelector('select')).toBeNull()
    expect(document.querySelectorAll('[data-legal-recorded-by]')).toHaveLength(1)
    await ask('Is the change order signed?')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ kind: 'question', note: 'Is the change order signed?' })
    expect(posts[0]).not.toHaveProperty('recordedById')
  })

  it('on the firm’s shared link it stays a pick, and the pick rides with the act', async () => {
    const { posts, firstRecipientId } = await openPortal(null)
    const picker = await waitFor(() => document.querySelector('[data-legal-recorded-by]') as HTMLElement)
    expect(picker.getAttribute('data-legal-recorded-by')).not.toBe('pinned')
    const select = picker.querySelector('select') as HTMLSelectElement
    expect(select).toBeTruthy()
    fireEvent.change(select, { target: { value: firstRecipientId } })
    await ask('Is the change order signed?')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]?.recordedById).toBe(firstRecipientId)
  })
})
