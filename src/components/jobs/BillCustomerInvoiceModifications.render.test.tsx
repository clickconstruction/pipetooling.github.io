// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's two Invoice Modifications cards, cut out of `SendRecordInvoiceModal` as a pure
 * move: `BillCustomerPhysicalModifications` and `BillCustomerStripeModifications`, with the memo preset row they
 * share. The cards own nothing. Each test holds the window's state in a small harness and reads what the card draws
 * and what it writes back. The cards inside the window are `SendRecordInvoiceModal.modifications.render.test.tsx`.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { BILL_CUSTOMER_MEMO_MAX_CHARS, type BillCustomerMemoPreset } from '../../lib/billCustomerMemoPresets'
import {
  PHYSICAL_INVOICE_FOOTER_MAX_CHARS,
  PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE,
  PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD,
  listPhysicalInvoiceFooterPresets,
} from '../../lib/physicalInvoiceFooter'
import {
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL,
  STRIPE_INVOICE_FOOTER_PRESET_PLUMBING,
} from '../../lib/stripeInvoiceFooter'
import { STRIPE_INVOICE_LINE_DESCRIPTION_MAX } from '../../lib/stripeInvoiceLineDescription'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import { BillCustomerMemoPresetRow } from './BillCustomerMemoPresetRow'
import { BillCustomerPhysicalModifications } from './BillCustomerPhysicalModifications'
import { BillCustomerStripeModifications } from './BillCustomerStripeModifications'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const job: JobBillingContext = {
  id: 'job-978',
  master_user_id: 'user-1',
  hcp_number: '978',
  job_name: 'Penmoor demo',
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
}

const MEMO_PRESETS: BillCustomerMemoPreset[] = [
  { id: 'standard', label: 'Standard', body: 'Thank you for your business.' },
  { id: 'c1', label: 'Rush', body: 'Due on receipt.' },
]

type Seed = { line?: string; memo?: string; footer?: string }

function PhysicalHarness({ seed = {}, onPreset }: { seed?: Seed; onPreset: (body: string) => void }) {
  const [lineOpen, setLineOpen] = useState(false)
  const [line, setLine] = useState(seed.line ?? '')
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState(seed.memo ?? '')
  const [footerOpen, setFooterOpen] = useState(false)
  const [footer, setFooter] = useState(seed.footer ?? '')
  return (
    <BillCustomerPhysicalModifications
      job={job}
      lineOnBillSectionOpen={lineOpen}
      setLineOnBillSectionOpen={setLineOpen}
      stripeLineDescription={line}
      setStripeLineDescription={setLine}
      memoSectionOpen={memoOpen}
      setMemoSectionOpen={setMemoOpen}
      externalNote={memo}
      setExternalNote={setMemo}
      memoPresets={MEMO_PRESETS}
      applyMemoPresetToBoth={onPreset}
      physicalFooterSectionOpen={footerOpen}
      setPhysicalFooterSectionOpen={setFooterOpen}
      physicalInvoiceFooter={footer}
      setPhysicalInvoiceFooter={setFooter}
      physicalFooterPresets={listPhysicalInvoiceFooterPresets()}
    />
  )
}

function StripeHarness({ seed = {}, onPreset }: { seed?: Seed; onPreset: (body: string) => void }) {
  const [lineOpen, setLineOpen] = useState(false)
  const [line, setLine] = useState(seed.line ?? '')
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState(seed.memo ?? '')
  const [footerOpen, setFooterOpen] = useState(false)
  const [footer, setFooter] = useState(seed.footer ?? '')
  return (
    <BillCustomerStripeModifications
      job={job}
      lineOnBillSectionOpen={lineOpen}
      setLineOnBillSectionOpen={setLineOpen}
      stripeLineDescription={line}
      setStripeLineDescription={setLine}
      memoSectionOpen={memoOpen}
      setMemoSectionOpen={setMemoOpen}
      stripeMemo={memo}
      setStripeMemo={setMemo}
      memoPresets={MEMO_PRESETS}
      applyMemoPresetToBoth={onPreset}
      stripeFooterSectionOpen={footerOpen}
      setStripeFooterSectionOpen={setFooterOpen}
      stripeInvoiceFooter={footer}
      setStripeInvoiceFooter={setFooter}
    />
  )
}

/** A disclosure's press, by the panel it opens. */
function toggleFor(panelId: string): HTMLButtonElement {
  const el = document.querySelector(`button[aria-controls="${panelId}"]`)
  if (!el) throw new Error(`no disclosure opens ${panelId}`)
  return el as HTMLButtonElement
}
function panel(panelId: string): HTMLElement {
  const el = document.getElementById(panelId)
  if (!el) throw new Error(`no panel ${panelId}`)
  return el
}
function box(id: string): HTMLTextAreaElement {
  return document.getElementById(id) as HTMLTextAreaElement
}

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('BillCustomerPhysicalModifications', () => {
  const ids = {
    line: 'bill-customer-physical-line-on-bill-section-panel',
    memo: 'bill-customer-physical-memo-section-panel',
    footer: 'bill-customer-physical-footer-section-panel',
  }

  it('draws the card closed, each disclosure saying what it holds', () => {
    render(<PhysicalHarness onPreset={() => {}} />)
    expect(screen.getByText('Invoice Modifications (optional)')).toBeTruthy()
    for (const id of [ids.line, ids.memo, ids.footer]) {
      expect(toggleFor(id).getAttribute('aria-expanded')).toBe('false')
      expect(panel(id).hidden).toBe(true)
    }
    expect(toggleFor(ids.line).textContent).toBe('▶Line item override—')
    expect(toggleFor(ids.memo).textContent).toBe('▶MemoNone')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterNone')
  })

  it('opens and closes each disclosure through the setter it was given', () => {
    render(<PhysicalHarness onPreset={() => {}} />)
    for (const id of [ids.line, ids.memo, ids.footer]) {
      fireEvent.click(toggleFor(id))
      expect(toggleFor(id).getAttribute('aria-expanded')).toBe('true')
      expect(panel(id).hidden).toBe(false)
    }
    fireEvent.click(toggleFor(ids.memo))
    expect(panel(ids.memo).hidden).toBe(true)
    expect(panel(ids.line).hidden).toBe(false)
  })

  it('cuts a typed line at the Stripe line max, counts it, and the default press writes the default line', () => {
    render(<PhysicalHarness onPreset={() => {}} />)
    const lineBox = box('bill-customer-physical-line-description')
    fireEvent.change(lineBox, { target: { value: 'x'.repeat(STRIPE_INVOICE_LINE_DESCRIPTION_MAX + 25) } })
    expect(lineBox.value.length).toBe(STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
    expect(document.getElementById('bill-customer-physical-line-on-bill-count')?.textContent).toBe(
      `(${STRIPE_INVOICE_LINE_DESCRIPTION_MAX} / ${STRIPE_INVOICE_LINE_DESCRIPTION_MAX})`,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset line item override to default', hidden: true }))
    expect(lineBox.value).toBe('Custom service.')
    expect(toggleFor(ids.line).textContent).toBe('▶Line item overrideCustom service.')
  })

  it('cuts a typed memo at the memo max, and a memo preset goes to the window, never straight into the box', () => {
    const onPreset = vi.fn()
    render(<PhysicalHarness onPreset={onPreset} />)
    const memoBox = within(panel(ids.memo)).getByRole('textbox', { hidden: true }) as HTMLTextAreaElement
    fireEvent.change(memoBox, { target: { value: 'm'.repeat(BILL_CUSTOMER_MEMO_MAX_CHARS + 3) } })
    expect(memoBox.value.length).toBe(BILL_CUSTOMER_MEMO_MAX_CHARS)
    fireEvent.click(within(panel(ids.memo)).getByRole('button', { name: 'Rush', hidden: true }))
    expect(onPreset).toHaveBeenLastCalledWith('Due on receipt.')
    // The preset is the window's to write (it writes both memos): the box here is unchanged.
    expect(memoBox.value.length).toBe(BILL_CUSTOMER_MEMO_MAX_CHARS)
  })

  it('a footer preset fills the footer and reads pressed; pressing it again empties the footer', () => {
    render(<PhysicalHarness onPreset={() => {}} />)
    const footerPanel = panel(ids.footer)
    const standard = within(footerPanel).getByRole('button', { name: 'Standard', hidden: true })
    const alternate = within(footerPanel).getByRole('button', { name: 'Alternate', hidden: true })
    fireEvent.click(standard)
    expect(box('bill-customer-physical-invoice-footer').value).toBe(PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD)
    expect(standard.getAttribute('aria-pressed')).toBe('true')
    expect(alternate.getAttribute('aria-pressed')).toBe('false')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterStandard')
    fireEvent.click(alternate)
    expect(box('bill-customer-physical-invoice-footer').value).toBe(PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE)
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterAlternate')
    fireEvent.click(alternate)
    expect(box('bill-customer-physical-invoice-footer').value).toBe('')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterNone')
  })

  it('a footer typed by hand reads Custom and is cut at the footer max', () => {
    render(<PhysicalHarness onPreset={() => {}} />)
    const footerBox = box('bill-customer-physical-invoice-footer')
    fireEvent.change(footerBox, { target: { value: 'f'.repeat(PHYSICAL_INVOICE_FOOTER_MAX_CHARS + 9) } })
    expect(footerBox.value.length).toBe(PHYSICAL_INVOICE_FOOTER_MAX_CHARS)
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterCustom')
  })
})

describe('BillCustomerStripeModifications', () => {
  // The Stripe footer's panel carries no channel in its id. The window drew it so before the cut, and the id stays.
  const ids = {
    line: 'bill-customer-stripe-line-on-bill-section-panel',
    memo: 'bill-customer-stripe-memo-section-panel',
    footer: 'bill-customer-footer-section-panel',
  }

  it('draws the card closed: no line, no memo, and an empty footer reads Stripe default', () => {
    render(<StripeHarness onPreset={() => {}} />)
    expect(screen.getByText('Invoice Modifications (optional)')).toBeTruthy()
    for (const id of [ids.line, ids.memo, ids.footer]) {
      expect(toggleFor(id).getAttribute('aria-expanded')).toBe('false')
      expect(panel(id).hidden).toBe(true)
    }
    expect(toggleFor(ids.line).textContent).toBe('▶Line item override—')
    expect(toggleFor(ids.memo).textContent).toBe('▶MemoNone')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterStripe default')
  })

  it('opens each disclosure, and a long typed line shows on the closed press cut at 48 characters', () => {
    render(<StripeHarness seed={{ line: `Rough-in,\n  phase   two ${'z'.repeat(60)}` }} onPreset={() => {}} />)
    expect(toggleFor(ids.line).textContent).toBe(`▶Line item overrideRough-in, phase two ${'z'.repeat(28)}…`)
    for (const id of [ids.line, ids.memo, ids.footer]) {
      fireEvent.click(toggleFor(id))
      expect(toggleFor(id).getAttribute('aria-expanded')).toBe('true')
      expect(panel(id).hidden).toBe(false)
    }
  })

  it('cuts a typed line and a typed memo at their maxes, and the default press writes the default line', () => {
    render(<StripeHarness onPreset={() => {}} />)
    const lineBox = box('bill-customer-stripe-line-description')
    fireEvent.change(lineBox, { target: { value: 'x'.repeat(STRIPE_INVOICE_LINE_DESCRIPTION_MAX + 1) } })
    expect(lineBox.value.length).toBe(STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
    fireEvent.click(screen.getByRole('button', { name: 'Reset line item override to default', hidden: true }))
    expect(lineBox.value).toBe('Custom service.')
    const memoBox = within(panel(ids.memo)).getByRole('textbox', { hidden: true }) as HTMLTextAreaElement
    fireEvent.change(memoBox, { target: { value: 'm'.repeat(BILL_CUSTOMER_MEMO_MAX_CHARS + 3) } })
    expect(memoBox.value.length).toBe(BILL_CUSTOMER_MEMO_MAX_CHARS)
    expect(toggleFor(ids.memo).textContent).toBe('▶MemoCustom')
  })

  it('Plumbing and Electrical fill the footer and read pressed; a second press leaves Stripe’s own footer', () => {
    render(<StripeHarness onPreset={() => {}} />)
    const footerPanel = panel(ids.footer)
    const plumbing = within(footerPanel).getByRole('button', { name: 'Plumbing', hidden: true })
    const electrical = within(footerPanel).getByRole('button', { name: 'Electrical', hidden: true })
    fireEvent.click(plumbing)
    expect(box('bill-customer-stripe-invoice-footer').value).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    expect(plumbing.getAttribute('aria-pressed')).toBe('true')
    expect(electrical.getAttribute('aria-pressed')).toBe('false')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterPlumbing')
    fireEvent.click(electrical)
    expect(box('bill-customer-stripe-invoice-footer').value).toBe(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    expect(electrical.getAttribute('aria-pressed')).toBe('true')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterElectrical')
    fireEvent.click(electrical)
    expect(box('bill-customer-stripe-invoice-footer').value).toBe('')
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterStripe default')
  })

  it('a footer typed by hand reads Custom and is cut at the footer max; the memo preset goes to the window', () => {
    const onPreset = vi.fn()
    render(<StripeHarness onPreset={onPreset} />)
    const footerBox = box('bill-customer-stripe-invoice-footer')
    fireEvent.change(footerBox, { target: { value: 'f'.repeat(STRIPE_INVOICE_FOOTER_MAX_CHARS + 9) } })
    expect(footerBox.value.length).toBe(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    expect(toggleFor(ids.footer).textContent).toBe('▶FooterCustom')
    fireEvent.click(within(panel(ids.memo)).getByRole('button', { name: 'Rush', hidden: true }))
    expect(onPreset).toHaveBeenLastCalledWith('Due on receipt.')
  })
})

describe('BillCustomerMemoPresetRow', () => {
  it('one press writes the preset, a press on the one in use empties the memo, and Clear always empties it', () => {
    // The row reads which preset is in use from the saved presets, so save the two this test draws.
    window.localStorage.setItem(
      'pipetooling-bill-customer-memo-presets',
      JSON.stringify({ v: 2, builtinOverrides: { standard: 'Thank you for your business.' }, customPresets: [{ id: 'c1', label: 'Rush', body: 'Due on receipt.' }] }),
    )
    const onApplyBoth = vi.fn()
    const view = render(<BillCustomerMemoPresetRow presets={MEMO_PRESETS} valueForHighlight="Due on receipt." onApplyBoth={onApplyBoth} />)
    const rush = screen.getByRole('button', { name: 'Rush' })
    const standard = screen.getByRole('button', { name: 'Standard' })
    expect(rush.getAttribute('aria-pressed')).toBe('true')
    expect(standard.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(standard)
    expect(onApplyBoth).toHaveBeenLastCalledWith('Thank you for your business.')
    fireEvent.click(rush)
    expect(onApplyBoth).toHaveBeenLastCalledWith('')
    onApplyBoth.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onApplyBoth).toHaveBeenCalledWith('')

    // A memo that matches no preset presses none.
    view.rerender(<BillCustomerMemoPresetRow presets={MEMO_PRESETS} valueForHighlight="Typed by hand" onApplyBoth={onApplyBoth} />)
    expect(screen.getByRole('button', { name: 'Rush' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Standard' }).getAttribute('aria-pressed')).toBe('false')
  })
})
