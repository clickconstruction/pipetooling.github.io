// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcRfisWindow } from './GcRfisWindow'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import type { RfiExtra } from '../../lib/gc/rfiRows'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function setup({
  money = true,
  extras = [],
  lineSheets,
  project: change,
}: {
  money?: boolean
  extras?: [string, RfiExtra][]
  lineSheets?: Record<string, string[] | null>
  project?: (p: GcProject) => GcProject
} = {}) {
  const base = initialGcState()
  const fairOaks = base.projects.find((p) => p.id === 'fairoaksd')!
  const project = change ? change(fairOaks) : fairOaks
  const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = { onAsk: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer: vi.fn(), onStartChangeOrder: vi.fn() }
  render(<GcRfisWindow state={state} project={project} extras={new Map(extras)} lineSheets={lineSheets} canStartChangeOrders={money} writes={writes} onClose={() => undefined} />)
  return { writes, project }
}

const card = (id: string) => document.querySelector(`[data-rfi="${id}"]`) as HTMLElement

/** RFI-001's answer, changed: the prototype's is $3,800 and 2 days with no change order yet. */
const firstAnswer = (change: Partial<NonNullable<GcProject['rfis']>[number]>) => (p: GcProject): GcProject => ({
  ...p,
  rfis: (p.rfis ?? []).map((r) => (r.number === 1 ? { ...r, ...change } : r)),
})

describe('GcRfisWindow', () => {
  it('reads Fair Oaks D’s four: the counts, open first, and whose move each one is', () => {
    setup()
    const counts = document.querySelector('[data-rfi-counts]') as HTMLElement
    expect(counts.textContent).toContain('1 waiting on us')
    expect(counts.textContent).toContain('1 with the architect')
    expect(counts.textContent).toContain('2 answered')
    expect([...document.querySelectorAll('[data-rfi]')].map((el) => (el as HTMLElement).dataset.rfiState)).toEqual(['us', 'architect', 'answered', 'answered'])
    expect(card('fairoaksd-rfi-4').textContent).toContain('Asked by Summit Roofing')
    expect(card('fairoaksd-rfi-3').textContent).toContain('To Marsh & Vale Architects')
    expect(card('fairoaksd-rfi-1').textContent).toContain('adds $3,800 and 2 days')
  })

  it('says one went to the architect by our email, and not one sent another way', () => {
    setup({ extras: [['fairoaksd-rfi-3', { emailSendLogId: 'log-3', recordedBy: null }]] })
    expect(card('fairoaksd-rfi-3').textContent).toContain('To Marsh & Vale Architects Wed Sep 30 by email')
    document.body.innerHTML = ''
    setup()
    expect(card('fairoaksd-rfi-3').textContent).not.toContain('by email')
  })

  it('sends ours to the architect, marks it sent another way, or answers it as us', () => {
    const { writes } = setup()
    fireEvent.click(within(card('fairoaksd-rfi-4')).getByRole('button', { name: 'Send to Marsh & Vale Architects' }))
    expect(writes.onSendToArchitect).toHaveBeenCalledWith('fairoaksd-rfi-4')
    fireEvent.click(within(card('fairoaksd-rfi-4')).getByRole('button', { name: 'We sent it another way' }))
    expect(writes.onMarkSent).toHaveBeenCalledWith('fairoaksd-rfi-4')
    fireEvent.click(within(card('fairoaksd-rfi-4')).getByRole('button', { name: 'Answer it ourselves' }))
    fireEvent.change(within(card('fairoaksd-rfi-4')).getByLabelText('Our answer'), { target: { value: 'Set the 54 by 72 curb.' } })
    fireEvent.click(within(card('fairoaksd-rfi-4')).getByRole('button', { name: 'Changes the plans' }))
    fireEvent.click(within(card('fairoaksd-rfi-4')).getByRole('button', { name: 'Save the answer' }))
    expect(writes.onAnswer).toHaveBeenCalledWith('fairoaksd-rfi-4', { text: 'Set the 54 by 72 curb.', by: 'us', impact: 'plans', cost: 0, days: 0 })
  })

  it('records the architect’s cost answer only with a cost or days', () => {
    const { writes } = setup()
    const rfi3 = card('fairoaksd-rfi-3')
    fireEvent.click(within(rfi3).getByRole('button', { name: 'Record their answer' }))
    fireEvent.change(within(rfi3).getByLabelText('Their answer'), { target: { value: 'Move the condensate line to bay 4.' } })
    fireEvent.click(within(rfi3).getByRole('button', { name: 'Adds cost or days' }))
    const save = within(rfi3).getByRole('button', { name: 'Save the answer' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(within(rfi3).getByLabelText('Cost to us'), { target: { value: '$1,250' } })
    fireEvent.change(within(rfi3).getByLabelText('Days it adds'), { target: { value: '1' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(writes.onAnswer).toHaveBeenCalledWith('fairoaksd-rfi-3', { text: 'Move the condensate line to bay 4.', by: 'architect', impact: 'cost', cost: 1250, days: 1 })
  })

  it('lets the money team start a change order from a cost answer, and nobody else', () => {
    const { writes } = setup()
    fireEvent.click(within(card('fairoaksd-rfi-1')).getByRole('button', { name: 'Start a change order' }))
    expect(writes.onStartChangeOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 'fairoaksd-rfi-1', number: 1 }))
    document.body.innerHTML = ''
    setup({ money: false })
    expect(within(card('fairoaksd-rfi-1')).queryByRole('button', { name: 'Start a change order' })).toBeNull()
  })

  it('says an answer that adds days only goes to Ask for the days, with no change order to start', () => {
    setup({ project: firstAnswer({ answer: { on: '2026-09-08', text: 'Wait for the new gas line survey.', by: 'architect', impact: 'cost', cost: 0, days: 2 } }) })
    expect(within(card('fairoaksd-rfi-1')).queryByRole('button', { name: 'Start a change order' })).toBeNull()
    expect(card('fairoaksd-rfi-1').querySelector('[data-rfi-days-only]')?.textContent).toBe('This answer adds days only. Ask for the days on the schedule instead.')
  })

  it('names the change order it started when the change orders are read, and says one was started when not', () => {
    setup({
      project: (p) => ({
        ...firstAnswer({ changeOrderId: 'co-3' })(p),
        changeOrders: [{ ...(p.changeOrders ?? [])[0]!, id: 'co-3', number: 3 }],
      }),
    })
    expect(card('fairoaksd-rfi-1').querySelector('[data-rfi-change-order]')?.textContent).toBe('Change order 3 was started from it.')
    expect(within(card('fairoaksd-rfi-1')).queryByRole('button', { name: 'Start a change order' })).toBeNull()
    document.body.innerHTML = ''
    setup({ money: false, project: (p) => ({ ...firstAnswer({ changeOrderId: 'co-3' })(p), changeOrders: [] }) })
    expect(card('fairoaksd-rfi-1').querySelector('[data-rfi-change-order]')?.textContent).toBe('A change order was started from it.')
  })

  it('asks a question about a trade by the company we awarded it, holding the lines its sheets name', () => {
    const lines = initialGcState().projects.find((p) => p.id === 'fairoaksd')!.packages.flatMap((k) => k.scope.map((l) => l.id))
    const { writes } = setup({ lineSheets: Object.fromEntries(lines.map((id) => [id, id === 'froof-4' ? ['A-501'] : id === 'fhvac-1' ? ['M-101'] : []])) })
    fireEvent.click(screen.getByRole('button', { name: 'Ask a question' }))
    const form = document.querySelector('[data-rfi-ask]') as HTMLElement
    const add = within(form).getByRole('button', { name: 'Add the question' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('The question'), { target: { value: 'Which curb size do we set?' } })
    fireEvent.change(within(form).getByLabelText('About'), { target: { value: 'froof' } })
    fireEvent.change(within(form).getByLabelText('Asked by'), { target: { value: 'summit' } })
    fireEvent.change(within(form).getByLabelText('Sheets'), { target: { value: 'a-501' } })
    const curbs = within(form).getByRole('checkbox', { name: /Roof curbs/ }) as HTMLInputElement
    expect(curbs.checked).toBe(true)
    // Unticked, it stays off while the sheets still name it; a sheet newly named ticks its own line.
    fireEvent.click(curbs)
    fireEvent.change(within(form).getByLabelText('Sheets'), { target: { value: 'a-501, M-101' } })
    expect(curbs.checked).toBe(false)
    expect((within(form).getByRole('checkbox', { name: /Rooftop units/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.change(within(form).getByLabelText('Needed this many days before the work'), { target: { value: '5' } })
    fireEvent.click(add)
    expect(writes.onAsk).toHaveBeenCalledWith({
      projectId: 'fairoaksd',
      question: 'Which curb size do we set?',
      sheets: ['a-501', 'M-101'],
      packageId: 'froof',
      askedByCompanyId: 'summit',
      holds: ['fhvac-1'],
      neededDays: 5,
    })
  })

  it('offers only the company awarded the trade as who asked, and only the job’s scope lines to hold', () => {
    setup({ lineSheets: { 'froof-4': null } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask a question' }))
    const form = document.querySelector('[data-rfi-ask]') as HTMLElement
    const askedBy = () => [...(within(form).getByLabelText('Asked by') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(askedBy()).toEqual(['Our superintendent'])
    fireEvent.change(within(form).getByLabelText('About'), { target: { value: 'froof' } })
    expect(askedBy()).toEqual(['Our superintendent', 'Summit Roofing'])
    expect(within(form).getAllByRole('checkbox').map((b) => b.closest('label')!.textContent)).toEqual([expect.stringContaining('Roof curbs')])
  })

  it('asks nothing on a job no longer being built', () => {
    setup({ project: (p) => ({ ...p, closedOn: '2026-10-01' }) })
    expect(screen.queryByRole('button', { name: 'Ask a question' })).toBeNull()
  })

  it('says its own sentences in plain words', () => {
    setup()
    fireEvent.click(within(card('fairoaksd-rfi-3')).getByRole('button', { name: 'Record their answer' }))
    fireEvent.click(within(card('fairoaksd-rfi-3')).getByRole('button', { name: 'Adds cost or days' }))
    const costHint = document.querySelector('[data-rfi-cost-hint]')!.textContent!
    fireEvent.click(within(card('fairoaksd-rfi-3')).getByRole('button', { name: 'Changes the plans' }))
    const said = [
      document.querySelector('[data-rfi-lede]')!.textContent!,
      document.querySelector('[role="dialog"] p')!.textContent!,
      document.querySelector('[data-rfi-change-hint]')!.textContent!,
      document.querySelector('[data-rfi-plans-hint]')!.textContent!,
      costHint,
      'This answer adds days only. Ask for the days on the schedule instead.',
      'Change order 3 was started from it.',
      'A change order was started from it.',
      'Nothing left on the schedule to hold.',
      'No questions yet.',
      'Type the question first.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
