// @vitest-environment jsdom
/**
 * What the customer sees (v2.5794): the window over the Tell the customer sheet. The email with From, To and Subject
 * in a frame; the pills switch; the text as it lands with the sample link and its note; no email means no pills;
 * Escape and Back close it once each, the Escape taken before the shell's own listener.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PreviewEmail } from '../../lib/tellCustomer/preview'
import { TellCustomerPreview } from './TellCustomerPreview'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const EMAIL: PreviewEmail = { from: 'Click Plumbing <estimates@clickplumbing.com>', replyTo: 'robert@douglasmining.com', subject: 'Estimate #171 · ZZ walk estimate (delete me)', html: '<html><body><p>Hi ZZ, your estimate is ready.</p></body></html>' }
const WORDS = 'ZZ, this is Robert with Click Plumbing. Your estimate is ready, $1.00. Open it: {link}'

describe('TellCustomerPreview', { timeout: 15_000 }, () => {
  it('shows the email with From, Reply to, To and Subject over a frame, and the pills switch to the text', () => {
    const onKind = vi.fn()
    renderWithProviders(<TellCustomerPreview first="ZZ" kind="email" onKind={onKind} email={EMAIL} emailTo="bids@clickplumbing.com" textWords={WORDS} number="(737) 300-9478" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'What ZZ sees' })).toBeTruthy()
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('email')
    expect(screen.getByText('The sheet stays open under this. Nothing is sent from here.')).toBeTruthy()
    expect(screen.getByTestId('tell-preview-email').textContent).toContain('From: Click Plumbing <estimates@clickplumbing.com> · Reply to: robert@douglasmining.com')
    expect(screen.getByTestId('tell-preview-email').textContent).toContain('To: bids@clickplumbing.com')
    expect(screen.getByTestId('tell-preview-subject').textContent).toBe('Subject: Estimate #171 · ZZ walk estimate (delete me)')
    expect((screen.getByTestId('tell-preview-frame') as HTMLIFrameElement).getAttribute('srcdoc')).toBe(EMAIL.html)
    expect(screen.getByTestId('tell-preview-pill-email').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByTestId('tell-preview-pill-text'))
    expect(onKind).toHaveBeenCalledWith('text')
  })
  it('shows the text as it lands on their phone, the link filled by the sample, with the note', () => {
    renderWithProviders(<TellCustomerPreview first="ZZ" kind="text" onKind={vi.fn()} email={EMAIL} emailTo="bids@clickplumbing.com" textWords={WORDS} number="(737) 300-9478" onClose={vi.fn()} />)
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('text')
    expect(screen.getByTestId('tell-preview-caption').textContent).toBe('To (737) 300-9478From the company number.')
    expect(screen.getByTestId('tell-preview-words').textContent).toBe('ZZ, this is Robert with Click Plumbing. Your estimate is ready, $1.00. Open it: https://clicktooling.com/estimate/accept?t=sample')
    expect(screen.getByTestId('tell-preview-sample').textContent).toBe('The link here is a sample. The real one fills in when the email goes.')
    expect(screen.queryByTestId('tell-preview-frame')).toBeNull()
  })
  it('with no email there are no pills and the text shows; a blank left is named; Escape and Back each close it once', () => {
    const onClose = vi.fn()
    renderWithProviders(<TellCustomerPreview first={null} kind="email" onKind={vi.fn()} email={null} emailTo={null} textWords="{first}, we have you booked for Friday." number="(830) 555-0121" onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'What the customer sees' })).toBeTruthy()
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('text')
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByTestId('tell-preview-sample')).toBeNull()
    expect(screen.getByText('Fill {first} before it sends.')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('tell-preview-back'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
