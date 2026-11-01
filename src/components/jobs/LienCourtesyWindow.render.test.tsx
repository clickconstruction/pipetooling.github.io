// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LienCourtesyWindow from './LienCourtesyWindow'
import type { CourtesyRecipient } from '../../lib/jobs/lienCourtesyIo'
import type { CourtesyFacts } from '../../lib/jobs/lienCourtesyNotice'

afterEach(cleanup)

const byData = (name: string) => document.querySelector(`[data-lien-courtesy-${name}]`) as HTMLElement

const facts: CourtesyFacts = {
  jobNumber: '741',
  jobName: 'Riverbend Dental',
  propertyAddress: '2200 Riverbend Dr, Austin, TX 78704',
  county: 'Travis',
  gcName: 'Ridgeway Builders',
  claimantName: 'Click Plumbing and Electrical',
  claim: 4850,
  monthsWords: 'August 2026',
  noticeSentOn: '2026-10-14',
  lienDay: '2026-11-16',
  payLinks: [{ address: 'clicktooling.com/pay/8f3a', amount: 4850 }],
  contactPerson: 'R. Douglas, Master Plumber',
  phone: '(512) 555-0147',
}

const recipients: CourtesyRecipient[] = [
  { who: 'original_contractor', name: 'Dana Ortiz', email: { address: 'dortiz@ridgeway.example', goes: true, reason: '' }, text: { address: '(512) 555-0193', goes: true, reason: '' }, contactId: 'c1', textChannelId: 'ch1' },
  { who: 'owner', name: 'Cibolo Crossing Ltd', email: { address: '', goes: false, reason: 'no email on the property record' }, text: { address: '', goes: false, reason: 'no number on the property record' }, contactId: null, textChannelId: null },
]

describe('LienCourtesyWindow — the send window (punch list #231)', () => {
  it('names each recipient’s channels, shows the GC’s words with the greeting, and counts the button', () => {
    const onSend = vi.fn()
    render(<LienCourtesyWindow jobLabel="741 · Riverbend Dental" facts={facts} recipients={recipients} busy={false} onSend={onSend} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Courtesy notice · 741 · Riverbend Dental' })).toBeTruthy()
    const gc = document.querySelector('[data-lien-courtesy-recipient="original_contractor"]')!
    expect(gc.textContent).toContain('dortiz@ridgeway.example')
    expect(gc.textContent).toContain('(512) 555-0193')
    const owner = document.querySelector('[data-lien-courtesy-recipient="owner"]')!
    expect(owner.textContent).toContain('no email on the property record')
    const greeting = screen.getByLabelText('Greeting, the one line you may change:') as HTMLInputElement
    expect(greeting.value).toBe('Dana,')
    expect(document.querySelector('[data-lien-courtesy-email-text]')!.textContent!.startsWith('Dana,\n\nOn October 14, 2026 we mailed you and the owner')).toBe(true)
    fireEvent.change(greeting, { target: { value: 'Dana and Luis,' } })
    expect(document.querySelector('[data-lien-courtesy-email-text]')!.textContent!.startsWith('Dana and Luis,')).toBe(true)
    const send = byData('send') as HTMLButtonElement
    expect(send.textContent).toBe('Send 2 messages ▸')
    expect(send.disabled).toBe(false)
    expect(document.querySelector('[data-lien-courtesy-detail]')!.textContent).toContain('1 email · 1 text')
    fireEvent.click(send)
    expect(onSend).toHaveBeenCalledWith('Dana and Luis,')
  })

  it('folds the text and the owner’s copy under the words', () => {
    render(<LienCourtesyWindow jobLabel="741" facts={facts} recipients={recipients} busy={false} onSend={vi.fn()} onClose={() => undefined} />)
    expect(document.querySelector('[data-lien-courtesy-text-body]')).toBeNull()
    fireEvent.click(byData('show-text'))
    expect(document.querySelector('[data-lien-courtesy-text-body]')!.textContent).toContain('Pay here: clicktooling.com/pay/8f3a')
    fireEvent.click(byData('show-owner'))
    expect(document.querySelector('[data-lien-courtesy-owner-text]')!.textContent).toContain('You did not hire us, and nothing here is billed to you.')
  })

  it('waits while the addresses are found, and is dead with nothing to send', () => {
    const { unmount } = render(<LienCourtesyWindow jobLabel="741" facts={facts} recipients={null} busy={false} onSend={vi.fn()} onClose={() => undefined} />)
    expect(byData('finding').textContent).toBe('Finding their addresses…')
    expect((byData('send') as HTMLButtonElement).disabled).toBe(true)
    unmount()
    render(<LienCourtesyWindow jobLabel="741" facts={facts} recipients={[recipients[1]!]} busy={false} onSend={vi.fn()} onClose={() => undefined} />)
    const send = byData('send') as HTMLButtonElement
    expect(send.textContent).toBe('Send messages ▸')
    expect(send.disabled).toBe(true)
    expect(document.querySelector('[data-lien-courtesy-detail]')!.textContent).toContain('Nothing can go')
  })
})
