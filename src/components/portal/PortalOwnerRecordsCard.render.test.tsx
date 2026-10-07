// @vitest-environment jsdom
/**
 * Records for an owner, on their portal (punch list #86, PR 1): the card asks for the name the
 * county lists, says so while the letters do not match, signs through sign-owner-records with
 * the consent words, and reads signed afterwards.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalOwnerRecordsCard } from './PortalOwnerRecordsCard'

const calls: Array<{ url: string; body: Record<string, unknown> }> = []
const answer = { ok: true, signedOn: '2026-10-06', printedName: 'umar khan' }

afterEach(() => {
  cleanup()
  calls.length = 0
  vi.unstubAllGlobals()
})

const records = { id: 'req-1', address: '9703 Lenox Hill, San Antonio, TX', ownerName: 'Umar Khan', offeredOn: '2026-10-06', signed: null, sent: null }

describe('PortalOwnerRecordsCard', () => {
  it('asks for the name as the county lists it, warns while the letters differ, and signs with the consent words', async () => {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return { ok: true, json: async () => answer }
    })
    render(<PortalOwnerRecordsCard records={records} token="tok-1" companyName="Click Plumbing" phone="(512) 360-0599" todayYmd="2026-10-06" />)
    expect(screen.getByText('Acknowledgment of a records request')).toBeTruthy()
    const hint = () => (document.querySelector('[data-portal-owner-name-hint]') as HTMLElement).textContent
    expect(hint()).toContain('Umar Khan')
    const name = screen.getByLabelText(/full legal name|Your full name|name/i) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'U. Khan' } })
    expect(hint()).toContain('Every letter must match')
    fireEvent.change(name, { target: { value: 'umar khan' } })
    expect(hint()).not.toContain('Every letter must match')
    // Consent, the agree box, then sign (typed).
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: 'Sign and send my request' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]!.url).toContain('/functions/v1/sign-owner-records')
    expect(calls[0]!.body).toMatchObject({ token: 'tok-1', requestId: 'req-1', printedName: 'umar khan', mode: 'type' })
    expect((calls[0]!.body.esignConsent as Record<string, unknown>).clauseText).toBeTruthy()
    await waitFor(() => expect((document.querySelector('[data-portal-owner-records]') as HTMLElement).getAttribute('data-state')).toBe('signed'))
    expect(document.querySelector('[data-portal-owner-records]')!.textContent).toContain('The office sends the records once it has checked our contract.')
  })

  it('shows the function’s own words when the name is not one the office allowed', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, json: async () => ({ error: 'Type your name as the county lists it: Umar Khan. Every letter must match.', nameMismatch: true }) }))
    render(<PortalOwnerRecordsCard records={records} token="tok-1" companyName="Click Plumbing" phone="" todayYmd="2026-10-06" />)
    fireEvent.change(screen.getByLabelText(/full legal name|Your full name|name/i), { target: { value: 'Someone Else' } })
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: 'Sign and send my request' }))
    await waitFor(() => expect(screen.getByText(/Type your name as the county lists it: Umar Khan/)).toBeTruthy())
  })

  it('sent on the portal: the day and one Download; while the copy is still being kept, say so (shape B)', () => {
    const signed = { ...records, signed: { on: '2026-10-05', name: 'Umar Khan' } }
    render(<PortalOwnerRecordsCard records={{ ...signed, sent: { on: '2026-10-07', downloadUrl: 'https://x.test/sent-documents/req-1/Records.pdf?token=t' } }} token="tok-1" companyName="Click Plumbing" phone="" todayYmd="2026-10-08" />)
    expect(screen.getByText(/The office sent your records on/)).toBeTruthy()
    const link = document.querySelector('[data-portal-owner-records-download]') as HTMLAnchorElement
    expect(link.textContent).toBe('Download the records')
    expect(link.href).toContain('Records.pdf')
    expect((document.querySelector('[data-portal-owner-records]') as HTMLElement).getAttribute('data-state')).toBe('sent')
    cleanup()
    render(<PortalOwnerRecordsCard records={{ ...signed, sent: { on: '2026-10-07', downloadUrl: null } }} token="tok-1" companyName="Click Plumbing" phone="" todayYmd="2026-10-08" />)
    expect(screen.getByText(/The file is being prepared/)).toBeTruthy()
    expect(document.querySelector('[data-portal-owner-records-download]')).toBeNull()
  })

  it('already signed reads thanks and no form', () => {
    render(<PortalOwnerRecordsCard records={{ ...records, signed: { on: '2026-10-05', name: 'Umar Khan' } }} token="tok-1" companyName="Click Plumbing" phone="" todayYmd="2026-10-06" />)
    expect(screen.getByText(/Thank you, Umar Khan/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign and send my request' })).toBeNull()
  })
})
