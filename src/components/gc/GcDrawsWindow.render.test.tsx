// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcDrawsWindow, type DrawWrites } from './GcDrawsWindow'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import type { ChangeOrder, GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function setup({
  project: change,
  chargeId = null,
  emailTick = null,
}: {
  project?: (p: GcProject) => GcProject
  chargeId?: string | null
  emailTick?: { on: boolean; onChange: (on: boolean) => void } | null
} = {}) {
  const base = initialGcState()
  const fairOaks = base.projects.find((p) => p.id === 'fairoaksd')!
  const project = change ? change(fairOaks) : fairOaks
  const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes: { [K in keyof DrawWrites]: ReturnType<typeof vi.fn> } = {
    onCameIn: vi.fn(),
    onApprove: vi.fn(),
    onApproveLess: vi.fn(),
    onSendBack: vi.fn(),
    onPay: vi.fn(),
    onWaiverIn: vi.fn(),
    onCharge: vi.fn(),
    onSettleCharge: vi.fn(),
    onTakeCharge: vi.fn(),
    onSendChange: vi.fn(),
  }
  render(<GcDrawsWindow state={state} project={project} chargeId={chargeId} emailTick={emailTick} writes={writes} onClose={() => undefined} />)
  return { writes }
}

const trade = (id: string) => document.querySelector(`[data-draw-trade="${id}"]`) as HTMLElement
const draw = (id: string) => document.querySelector(`[data-draw="${id}"]`) as HTMLElement

/** One trade's draw at another status, its days to match. */
const drawAt = (pkgId: string, drawId: string, status: 'approved' | 'paid') => (p: GcProject): GcProject => ({
  ...p,
  packages: p.packages.map((k) =>
    k.id === pkgId && k.sow
      ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.id === drawId ? { ...d, status, approvedOn: '2026-10-01', ...(status === 'paid' ? { paidOn: '2026-10-02' } : {}) } : d)) } }
      : k,
  ),
})

/** A change order the customer signed, on the steel. */
const signedChange: ChangeOrder = {
  id: 'co-steel-1',
  number: 4,
  description: 'Add a lintel over the new storefront opening.',
  reason: 'owner',
  schedule: 'none',
  packageId: 'fsteel',
  cost: 2400,
  price: 2640,
  status: 'signed',
  sentOn: '2026-09-25',
  answeredOn: '2026-09-28',
  pctDone: 0,
}

describe('GcDrawsWindow', () => {
  it('reads Fair Oaks D: a card for each trade with a signed statement of work, its money and its lines', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Fair Oaks Shops, Building D: Draws' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-draw-trade]')].map((el) => (el as HTMLElement).dataset.drawTrade)).toEqual(['fsite', 'fconc', 'fsteel', 'felec', 'froof', 'fhvac'])
    const steel = trade('fsteel')
    expect(steel.textContent).toContain('Iron Horse Fabrication')
    expect(steel.querySelector('[data-draw-line="fsteel-2"]')!.textContent).toContain('reported 100%, billed 0%')
    expect(draw('fsteel-draw-2').dataset.drawStatus).toBe('requested')
    expect(draw('fsteel-draw-2').textContent).toContain('waiting on us')
  })

  it('approves a waiting draw, or sends it back with what we see on the lines we doubt', () => {
    const { writes } = setup()
    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Approve' }))
    expect(writes.onApprove).toHaveBeenCalledWith('fsteel', 'fsteel-draw-2')

    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Send back' }))
    const form = document.querySelector('[data-draw-form="back"]') as HTMLElement
    const send = within(form).getByRole('button', { name: 'Send it back' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('We see, Erection'), { target: { value: '50' } })
    fireEvent.change(within(form).getByPlaceholderText('The break room ceiling is not hung yet.'), { target: { value: 'The east bay is not erected yet.' } })
    fireEvent.click(send)
    expect(writes.onSendBack).toHaveBeenCalledWith('fsteel', 'fsteel-draw-2', { 'fsteel-3': 50 }, 'The east bay is not erected yet.')
  })

  it('approves one for less, with why', () => {
    const { writes } = setup()
    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Approve less' }))
    const form = document.querySelector('[data-draw-form="less"]') as HTMLElement
    fireEvent.change(within(form).getByLabelText('We approve, Erection'), { target: { value: '50' } })
    fireEvent.change(within(form).getByPlaceholderText('Two cabinets are still on order.'), { target: { value: 'The east bay waits on its bolts.' } })
    fireEvent.click(within(form).getByRole('button', { name: /^Approve \$/ }))
    expect(writes.onApproveLess).toHaveBeenCalledWith('fsteel', 'fsteel-draw-2', { 'fsteel-3': 50 }, 'The east bay waits on its bolts.')
  })

  it('holds Approve on the company’s papers and says which', () => {
    setup()
    const elec = draw('felec-draw-2')
    expect((within(elec).getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(elec).getByRole('button', { name: 'Approve less' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(elec).getByRole('button', { name: 'Send back' }) as HTMLButtonElement).disabled).toBe(false)
    expect(elec.querySelector('[data-draw-blockers]')!.textContent).toBe('Their insurance expired Sep 15.')
  })

  it('marks an approved draw paid, and records the unconditional waiver on a paid one', () => {
    const { writes } = setup({ project: drawAt('fsteel', 'fsteel-draw-2', 'approved') })
    expect(document.querySelector('[data-draws-to-pay]')!.textContent).toContain('Iron Horse Fabrication, Structural steel draw 2')
    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Mark paid' }))
    expect(writes.onPay).toHaveBeenCalledWith('fsteel', 'fsteel-draw-2')
    fireEvent.click(within(draw('felec-draw-1')).getByRole('button', { name: 'Their unconditional waiver came in' }))
    expect(writes.onWaiverIn).toHaveBeenCalledWith('felec', 'felec-draw-1')
  })

  it('records a pay application that came by email, once it has its day and who signed it', () => {
    const { writes } = setup()
    // The steel waits on draw 2, so no second one comes in until it is answered.
    expect(trade('fsteel').querySelector('[data-draw-came-in-waits]')!.textContent).toBe('Pay application 2 is waiting on us. Approve it or send it back before the next one.')
    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'A pay application came by email' }))
    const form = trade('fhvac').querySelector('[data-draw-came-in]') as HTMLElement
    // Ductwork starts at their report, 80%, past the 60% billed: there is work to pay.
    expect((within(form).getByLabelText('Percent done, Ductwork') as HTMLInputElement).value).toBe('80')
    expect(form.querySelector('[data-draw-came-in-sum]')!.textContent).toContain('Pay application 2 comes to')
    const record = within(form).getByRole('button', { name: 'Record it' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(form.querySelector('input[type="date"]')!, { target: { value: '2026-09-30' } })
    fireEvent.change(within(form).getByText('Signed by').parentElement!.querySelector('input')!, { target: { value: 'Dana Ruiz' } })
    fireEvent.change(within(form).getByLabelText('Its Drive link'), { target: { value: 'https://drive.google.com/file/d/abc' } })
    expect(record.disabled).toBe(false)
    fireEvent.click(record)
    expect(writes.onCameIn).toHaveBeenCalledTimes(1)
    const sent = writes.onCameIn.mock.calls[0]![0]
    expect(sent).toMatchObject({ packageId: 'fhvac', periodTo: '2026-09-30', signedBy: 'Dana Ruiz', driveUrl: 'https://drive.google.com/file/d/abc' })
    expect(sent.lines.find((l: { sovId: string }) => l.sovId === 'fhvac-2')).toMatchObject({ toPct: 80, stored: 0 })
  })

  it('opens at the charge a link names, drops it with why, and sends a new one', () => {
    const { writes } = setup({ chargeId: 'fsteel-bc-1' })
    const charge = document.querySelector('[data-charge="fsteel-bc-1"]') as HTMLElement
    expect(charge.style.border).toContain('var(--border-blue)')
    fireEvent.click(within(charge).getByRole('button', { name: 'Drop it' }))
    fireEvent.change(within(charge).getByLabelText('Why we drop it'), { target: { value: 'Our crew cut it.' } })
    fireEvent.click(within(charge).getByRole('button', { name: 'Drop it' }))
    expect(writes.onSettleCharge).toHaveBeenCalledWith('fsteel', 'fsteel-bc-1', false, 'Our crew cut it.')

    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'Charge them' }))
    fireEvent.change(within(trade('fhvac')).getByLabelText('Amount'), { target: { value: '1,250' } })
    fireEvent.change(within(trade('fhvac')).getByLabelText('What it is for'), { target: { value: 'Patch the roof they cut' } })
    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'Send the charge' }))
    expect(writes.onCharge).toHaveBeenCalledWith('fhvac', { amount: 1250, reason: 'Patch the roof they cut', photoUrl: '' })
  })

  it('sends a change the customer signed to its trade, and says the portal takes no signature yet', () => {
    const { writes } = setup({ project: (p) => ({ ...p, changeOrders: [signedChange] }) })
    const change = document.querySelector('[data-draw-change="co-steel-1"]') as HTMLElement
    expect(change.textContent).toContain('signed by the customer')
    fireEvent.click(within(change).getByRole('button', { name: 'Send the change to Iron Horse Fabrication' }))
    expect(writes.onSendChange).toHaveBeenCalledWith('fsteel', 'co-steel-1')
    expect(document.querySelector('[data-draw-change-hint]')!.textContent).toBe('Their portal does not take signatures yet. Call them to sign it.')
  })

  it('records a change they signed on paper with They signed it, the file it came as beside it (U6d)', () => {
    const base = initialGcState()
    const sent: ChangeOrder = { ...signedChange, tradeChange: { status: 'sent', sentOn: '2026-10-01', signedOn: null, sovLineId: '' } }
    const project = { ...base.projects.find((p) => p.id === 'fairoaksd')!, changeOrders: [sent] }
    const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
    const onChangeSignedIn = vi.fn()
    const writes = { onCameIn: vi.fn(), onApprove: vi.fn(), onApproveLess: vi.fn(), onSendBack: vi.fn(), onPay: vi.fn(), onWaiverIn: vi.fn(), onCharge: vi.fn(), onSettleCharge: vi.fn(), onTakeCharge: vi.fn(), onSendChange: vi.fn(), onChangeSignedIn }
    render(<GcDrawsWindow state={state} project={project} writes={writes} onClose={() => undefined} />)
    const change = document.querySelector('[data-draw-change="co-steel-1"]') as HTMLElement
    expect(change.textContent).toContain('waiting on their signature')
    const hint = document.querySelector('[data-draw-change-hint]')!.textContent!
    expect(hint).toBe('Their portal does not take signatures yet. Call them to sign it. Once they sign on paper or by email, press They signed it.')
    expect(plainWordsFailures(hint)).toEqual([])
    fireEvent.click(within(change).getByRole('button', { name: 'They signed it' }))
    const form = change.querySelector('[data-draw-change-signed-form]') as HTMLElement
    expect(plainWordsFailures(form.querySelector('span')!.textContent!)).toEqual([])
    fireEvent.change(within(form).getByLabelText("The signed file's name"), { target: { value: 'CO 4 signed.pdf' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Record their signature' }))
    expect(onChangeSignedIn).toHaveBeenCalledWith('fsteel', 'co-steel-1', { fileName: 'CO 4 signed.pdf', driveUrl: '' })
    expect(change.querySelector('[data-draw-change-signed-form]')).toBeNull()
  })

  it('offers no They signed it without the press, as before U6d', () => {
    setup({ project: (p) => ({ ...p, changeOrders: [{ ...signedChange, tradeChange: { status: 'sent', sentOn: '2026-10-01', signedOn: null, sovLineId: '' } }] }) })
    expect(screen.queryByRole('button', { name: 'They signed it' })).toBeNull()
  })

  it('shows the email tick only to someone who may email a trade, off until they turn it on', () => {
    setup()
    expect(document.querySelector('[data-draw-email-tick]')).toBeNull()
    document.body.innerHTML = ''
    const onChange = vi.fn()
    setup({ emailTick: { on: false, onChange } })
    const tick = within(document.querySelector('[data-draw-email-tick]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('says the email goes only with the tick on, in the less form and the charge’s hint', () => {
    setup({ emailTick: { on: false, onChange: () => undefined } })
    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Approve less' }))
    expect(document.querySelector('[data-draw-note-hint]')!.textContent).toBe('Tell them why too. With the email tick off, no email goes.')
    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'Charge them' }))
    expect(trade('fhvac').querySelector('[data-draw-charge-hint]')!.textContent).toContain('With the email tick off, tell them yourself.')
    document.body.innerHTML = ''
    setup({ emailTick: { on: true, onChange: () => undefined } })
    fireEvent.click(within(draw('fsteel-draw-2')).getByRole('button', { name: 'Approve less' }))
    expect(document.querySelector('[data-draw-note-hint]')!.textContent).toBe('It goes in the email we send them about this pay application.')
    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'Charge them' }))
    expect(trade('fhvac').querySelector('[data-draw-charge-hint]')!.textContent).toContain('Cool Breeze Mechanical gets an email and has')
  })

  it('says each thing a first-timer reads in plain words', () => {
    setup({ project: drawAt('fsteel', 'fsteel-draw-2', 'approved') })
    fireEvent.click(within(trade('fhvac')).getByRole('button', { name: 'Charge them' }))
    const said = [
      document.querySelector('[data-draw-lede]')!.textContent!,
      document.querySelector('[role="dialog"] p')?.textContent ?? '',
      document.querySelector('[data-draws-to-pay-rule]')!.textContent!,
      trade('fhvac').querySelector('[data-draw-charge-hint]')!.textContent!,
      'Email the trade about what I press here',
      'Pay application 2 is waiting on us. Approve it or send it back before the next one.',
      'Their portal does not take signatures yet. Call them to sign it.',
      'Tell them why too. With the email tick off, no email goes.',
      'No approved draw can take it yet. It can come off their next one once we approve it.',
      'Only people given access can open this link. Our office may not be one of them.',
      'Stored materials are paid once. They come out of stored as they are built.',
      'No trade we hire has a signed statement of work on this job yet.',
    ].filter((s) => s !== '')
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
