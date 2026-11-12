// @vitest-environment jsdom
/**
 * The pay line under a billed row's Expected date (v2.7013): "Pays in 3–67d" is a press that opens the Pay speeds
 * window on the row's payer. It is a real button with a name that says what it opens, it wears the class whose
 * underline says press (the owner's call: no colour of its own, no ring), and the words the window does not hold stay plain.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BilledReliabilityLine from './BilledReliabilityLine'
import { buildReliabilityLine } from '../../lib/jobs/paymentReliability'
import type { PayReceipt } from '../../lib/jobs/billedExpectedPay'
import type { CustomerPromiseRecord } from '../../lib/jobs/paymentPromises'

const receipts: PayReceipt[] = [2, 3, 3, 9, 21, 40, 67, 67, 90].map((gapDays, i) => ({ billedYmd: `2026-0${i + 1}-01`, paidYmd: `2026-0${i + 1}-20`, gapDays, jobId: null, jobName: null, address: null }))
const record = { decided: 7, kept: 3, late: 2, broken: 2, open: 0, usualSlipDays: 9 } as unknown as CustomerPromiseRecord

afterEach(() => cleanup())

describe('BilledReliabilityLine', () => {
  it('with a way to open pay speeds, the Pays in words are a button named for what it opens', () => {
    const onOpen = vi.fn()
    const onRow = vi.fn()
    render(
      // The row around it has its own click (open the job): the press must not set it off.
      <div onClick={onRow}>
        <BilledReliabilityLine line={buildReliabilityLine(receipts, null)} showBars={false} onOpenPaySpeeds={onOpen} payerName="Made Up Diner" />
      </div>,
    )
    const press = screen.getByRole('button', { name: 'Pays in 3–67d. Open pay speeds for Made Up Diner' })
    expect(press.textContent).toBe('Pays in 3–67d')
    expect(press.getAttribute('type')).toBe('button')
    expect(press.className).toBe('billedPaysInPress')
    expect(press.getAttribute('title')).toMatch(/Click to open pay speeds for Made Up Diner\.$/)
    fireEvent.click(press)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('the promise record after it stays plain words, outside the button', () => {
    const line = buildReliabilityLine(receipts, record, '2 checks came back · Apr')
    render(<BilledReliabilityLine line={line} showBars={false} onOpenPaySpeeds={vi.fn()} payerName="Made Up Diner" />)
    const press = screen.getByTestId('billed-pays-in-press')
    expect(press.textContent).toBe('Pays in 3–67d')
    const whole = screen.getByTestId('billed-reliability-line')
    // Every word the line had is still there, in order.
    expect(whole.textContent?.replace(/\s+/g, ' ')).toBe(line.text.replace('Pays in 3–67d ·', 'Pays in 3–67d·'))
    expect(whole.textContent).toContain(line.kept!)
    expect(press.textContent).not.toContain(line.kept!)
  })

  it('with no way to open it, the line is plain words as before', () => {
    render(<BilledReliabilityLine line={buildReliabilityLine(receipts, null)} showBars={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('billed-reliability-line').textContent).toBe('Pays in 3–67d')
  })

  it('a line with no Pays in has nothing to open and stays plain, even with the handler', () => {
    const line = buildReliabilityLine([], record)
    expect(line.paysIn).toBeNull()
    render(<BilledReliabilityLine line={line} showBars={false} onOpenPaySpeeds={vi.fn()} payerName="Made Up Diner" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('billed-reliability-line').textContent).toBe(line.text)
  })

  it('a payer with no name still gets a press that says what it opens', () => {
    render(<BilledReliabilityLine line={buildReliabilityLine(receipts, null)} showBars={false} onOpenPaySpeeds={vi.fn()} payerName={null} />)
    expect(screen.getByRole('button', { name: 'Pays in 3–67d. Open pay speeds for this customer' })).toBeTruthy()
  })

  it('the class says press with the underline alone: no colour of its own and no ring, at rest, under the pointer or under focus (owner, 2026-11-12)', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    const rule = (selector: string) => {
      const at = css.indexOf(selector)
      expect(at, selector).toBeGreaterThan(-1)
      return css.slice(at, css.indexOf('}', at))
    }
    const rest = rule('.billedPaysInPress {')
    const hover = rule('.billedPaysInPress:hover {')
    const focus = rule('.billedPaysInPress:focus-visible {')
    expect(rest).toMatch(/text-decoration: underline dotted/)
    expect(rest).toMatch(/color: inherit/)
    expect(hover).toMatch(/text-decoration: underline;/)
    // The keyboard still gets a look of its own: the underline goes solid and thicker.
    expect(focus).toMatch(/text-decoration-thickness: 2px/)
    expect(focus).toMatch(/outline: none/)
    for (const r of [hover, focus]) {
      expect(r).not.toMatch(/(^|[^-])color:/)
      expect(r).not.toMatch(/outline: \d/)
      expect(r).not.toMatch(/border|box-shadow|background/)
    }
  })
})
