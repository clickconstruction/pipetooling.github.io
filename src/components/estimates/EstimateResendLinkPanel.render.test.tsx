// @vitest-environment jsdom
/**
 * v2.2856 (J17-F2/N3): the "Waiting for customer" block on a sent estimate offers a real
 * Resend link, names where the email went, refuses rows the kernel blocks with the reason
 * (and a "start a new estimate" nudge where that is the answer), and shows the fresh URL
 * once after a resend.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EstimateResendLinkPanel from './EstimateResendLinkPanel'
import { customerLinkUnavailableTitle } from '../../../supabase/functions/_shared/estimateLinkResend'

afterEach(() => {
  cleanup()
})

describe('EstimateResendLinkPanel', () => {
  it('offers Resend link on a resendable row and names the address', () => {
    const onResend = vi.fn()
    render(
      <EstimateResendLinkPanel
        sentTo="pat@example.com"
        verdict={{ ok: true }}
        busy={false}
        onResend={onResend}
        resent={null}
        onCopyUrl={() => {}}
      />,
    )
    expect(screen.getByText('pat@example.com')).toBeTruthy()
    const btn = screen.getByRole('button', { name: /resend the customer link/i })
    fireEvent.click(btn)
    expect(onResend).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/ask an admin/i)).toBeNull()
  })

  it('disables the button while a resend is in flight', () => {
    render(
      <EstimateResendLinkPanel
        sentTo="pat@example.com"
        verdict={{ ok: true }}
        busy
        onResend={() => {}}
        resent={null}
        onCopyUrl={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /resend the customer link/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Resending…')
  })

  it('hides Resend and explains when pricing has passed its good-through date', () => {
    render(
      <EstimateResendLinkPanel
        sentTo="pat@example.com"
        verdict={{ ok: false, reason: 'pricing_expired' }}
        busy={false}
        onResend={() => {}}
        resent={null}
        onCopyUrl={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /resend/i })).toBeNull()
    expect(screen.getByText(/good-through date/i)).toBeTruthy()
    expect(screen.getByText(/New estimate/)).toBeTruthy()
  })

  it('shows the fresh URL once with a Copy button after a resend', () => {
    const onCopyUrl = vi.fn()
    const url = 'https://pipetooling.com/estimate/accept?t=abc123'
    render(
      <EstimateResendLinkPanel
        sentTo="pat@example.com"
        verdict={{ ok: true }}
        busy={false}
        onResend={() => {}}
        resent={{ email: 'pat@example.com', emailed: true, url }}
        onCopyUrl={onCopyUrl}
      />,
    )
    expect(screen.getByRole('status').textContent).toContain('Link resent to')
    expect(screen.getByText(url)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /copy the new customer link/i }))
    expect(onCopyUrl).toHaveBeenCalledWith(url)
  })

  it('says so when the email did not go out but the link is ready', () => {
    render(
      <EstimateResendLinkPanel
        sentTo="pat@example.com"
        verdict={{ ok: true }}
        busy={false}
        onResend={() => {}}
        resent={{ email: 'pat@example.com', emailed: false, url: 'https://x/estimate/accept?t=1' }}
        onCopyUrl={() => {}}
      />,
    )
    expect(screen.getByRole('status').textContent).toMatch(/did not go out/i)
  })
})

describe('customerLinkUnavailableTitle', () => {
  it('points at Resend link when a resend is possible and never at an admin', () => {
    expect(customerLinkUnavailableTitle(true)).toMatch(/Resend link/)
    expect(customerLinkUnavailableTitle(true)).not.toMatch(/admin/i)
    expect(customerLinkUnavailableTitle(false)).not.toMatch(/Resend link|admin/i)
  })
})
