// @vitest-environment jsdom
/** v2.4662 (punch list #85 item 26): a person whose emails are not going through carries the line on the firm's Notifications page. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import LegalPortal from './LegalPortal'
import { START_SEEN_KEY } from '../lib/legal/legalPortalStart'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// The portal opens on Matters once Start here has been seen (v2.4820); these tests read Matters.
beforeEach(() => window.localStorage.setItem(START_SEEN_KEY, 'yes'))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' }

async function openNotifications(failingSince: string | null, paused = false) {
  const payload = sampleLegalPortalResponse(company as never, new Date().toISOString().slice(0, 10)) as { recipients: Array<Record<string, unknown>> }
  payload.recipients = payload.recipients.map((r, i) => (i === 1 ? { ...r, confirmed: true, paused, failingSince } : r))
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
  render(
    <MemoryRouter initialEntries={['/legal?t=tok_live']}>
      <LegalPortal />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText(/Brazos Ridge Contracting/).length).toBeGreaterThan(0))
  fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
  await waitFor(() => expect(document.body.textContent).toMatch(/Add a person at the firm/))
}

describe('LegalPortal — Notifications · a person not reaching', () => {
  it('shows the line against the person, with the day it began', async () => {
    await openNotifications('2026-10-05')
    const lines = document.querySelectorAll('[data-legal-not-reaching]')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.textContent).toBe('Our emails to bo@samplepartner.example.com have not gone through since 2026-10-05. We try the digest again every five minutes for the rest of its day. If the address is wrong, press Stop emails to this person and add the right one.')
  })

  it('shows nothing while emails go through, or once the person is stopped', async () => {
    await openNotifications(null)
    expect(document.querySelector('[data-legal-not-reaching]')).toBeNull()
    cleanup()
    await openNotifications('2026-10-05', true)
    expect(document.querySelector('[data-legal-not-reaching]')).toBeNull()
  })
})

/** v2.6278 (punch list #233): the add card is the row it becomes, with the rule in it and the handling count under Only theirs. */
describe('LegalPortal — Notifications · the add card carries the rule', () => {
  it('adds a person with their rule and title, and the count under Only theirs reads the sample matter', async () => {
    await openNotifications(null)
    // Bo Sample is on Only theirs and handles nothing; Ann Sample handles the one sample matter.
    const counts = Array.from(document.querySelectorAll('[data-legal-handling-count]')).map((n) => n.textContent)
    expect(counts).toEqual(['The office names Bo Sample as handling 0 of 1 open matter today.'])
    expect(document.body.textContent).not.toMatch(/How this behaves|What you hear about|Only my matters/)
    const form = document.querySelector('[data-legal-add-person]') as HTMLFormElement
    expect(form.textContent).toMatch(/Title.*Optional\. Shows beside their name, here and to the office\./)
    expect(screen.getByRole('button', { name: 'Send them a confirmation' })).toBeTruthy()
    const inputs = form.querySelectorAll('input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'Ann Sample' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'ann2@samplepartner.example.com' } })
    fireEvent.change(inputs[2] as HTMLInputElement, { target: { value: 'attorney' } })
    expect(screen.getByRole('button', { name: 'Send Ann a confirmation' })).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Weekly digest' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Wed' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Only theirs' }))
    expect(form.querySelector('[data-legal-handling-count]')?.textContent).toBe('The office names Ann Sample as handling 1 of 1 open matter today.')
    fireEvent.submit(form)
    await waitFor(() => expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBeGreaterThan(1))
    const posts = (globalThis.fetch as unknown as { mock: { calls: Array<[string, { body?: string }]> } }).mock.calls.filter(([url]) => /submit-legal-portal/.test(String(url)))
    const sent = JSON.parse(String(posts[0]?.[1]?.body)) as Record<string, unknown>
    expect(sent).toMatchObject({ kind: 'recipient_add', name: 'Ann Sample', email: 'ann2@samplepartner.example.com', role: 'attorney', mode: 'digest', scope: 'mine', digestWeekday: 3, digestTime: '07:00' })
  })

  it('with nobody on the list, the empty card offers the first press and it lands on the name', async () => {
    const payload = sampleLegalPortalResponse(company as never, new Date().toISOString().slice(0, 10)) as { recipients: unknown[] }
    payload.recipients = []
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=tok_live']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Brazos Ridge Contracting/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
    await waitFor(() => expect(document.querySelector('[data-legal-nobody]')).not.toBeNull())
    expect(document.querySelector('[data-legal-nobody]')?.textContent).toBe('Nobody at the firm is on the list yet.Add the first person')
    fireEvent.click(screen.getByRole('button', { name: 'Add the first person' }))
    expect(document.activeElement).toBe(document.querySelector('[data-legal-add-person] input'))
  })
})

/** v2.6280 (punch list #233 PR 2): the sample inbox under the add card follows the rule and opens the email pressed. */
describe('LegalPortal — Notifications · the sample inbox', () => {
  it('lists the sample week under Each event, swaps to one digest line, and opens the line pressed', async () => {
    await openNotifications(null)
    const form = document.querySelector('[data-legal-add-person]') as HTMLFormElement
    const lines = () => Array.from(form.querySelectorAll('[data-legal-inbox-line]')) as HTMLButtonElement[]
    expect(lines()).toHaveLength(9)
    expect(lines()[0]?.getAttribute('data-legal-inbox-line')).toBe('open')
    expect(lines()[8]?.getAttribute('data-legal-inbox-line')).toBe('dim')
    expect(lines()[8]?.disabled).toBe(true)
    expect(lines()[8]?.textContent).toMatch(/saw your fee on Ridgeway Builders.*weekly digest only/)
    expect(lines()[3]?.textContent).toMatch(/Step by the office: Cedar Bend Homes.*weekly digest only/)
    expect(form.textContent).toMatch(/What lands in their inbox/)
    const frame = () => form.querySelector('[data-legal-sample-inbox] iframe')
    expect(frame()?.getAttribute('srcdoc')).toContain('has referred <b>Ridgeway Builders</b>')
    expect(frame()?.getAttribute('srcdoc')).toContain('Stop these emails to you')
    fireEvent.click(lines()[4] as HTMLButtonElement)
    expect(frame()?.getAttribute('srcdoc')).toContain('The GC called.')
    fireEvent.change(form.querySelector('input') as HTMLInputElement, { target: { value: 'Ann Sample' } })
    expect(form.textContent).toMatch(/What lands in Ann's inbox/)
    fireEvent.click(within(form).getByRole('button', { name: 'Only theirs' }))
    expect(lines()).toHaveLength(4)
    fireEvent.click(within(form).getByRole('button', { name: 'Weekly digest' }))
    expect(lines()).toHaveLength(1)
    expect(lines()[0]?.textContent).toMatch(/Weekly digest — 1 open matter/)
    expect(frame()?.getAttribute('srcdoc')).toContain('Your weekly digest, Ann Sample.')
  })
})
