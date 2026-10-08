// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcSubmittalsWindow, type LinkAccess } from './GcSubmittalsWindow'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { submittalRoundKey, type SubmittalRoundExtra } from '../../lib/gc/submittalRows'
import { plainWordsFailures } from '../../lib/plainWords'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const LINK = 'https://drive.google.com/file/d/sheet-metal/view'

function setup({
  extras = [],
  sections = {},
  checkLink,
  project: change,
}: {
  extras?: [string, SubmittalRoundExtra][]
  sections?: Record<string, string[]>
  checkLink?: (url: string) => Promise<LinkAccess>
  project?: (p: GcProject) => GcProject
} = {}) {
  const base = initialGcState()
  const fairOaks = base.projects.find((p) => p.id === 'fairoaksd')!
  const project = change ? change(fairOaks) : fairOaks
  const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = { onAdd: vi.fn(), onCameIn: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer: vi.fn() }
  render(<GcSubmittalsWindow state={state} project={project} extras={new Map(extras)} sections={sections} checkLink={checkLink} writes={writes} onClose={() => undefined} />)
  return { writes }
}

const row = (id: string) => document.querySelector(`[data-submittal="${id}"]`) as HTMLElement

describe('GcSubmittalsWindow', () => {
  it('reads Fair Oaks D’s register: the counts, a card for each awarded trade, and whose move each one is', () => {
    setup()
    const counts = document.querySelector('[data-submittal-counts]') as HTMLElement
    expect(counts.textContent).toContain('1 waiting on trades')
    expect(counts.textContent).toContain('1 waiting on us')
    expect(counts.textContent).toContain('1 with the architect')
    expect(counts.textContent).toContain('3 approved')
    expect(document.querySelectorAll('[data-submittal-trade]')).toHaveLength(6)
    expect(document.querySelector('[data-submittal-trade="fplumb"]')).toBeNull()
    expect(row('fairoaksd-sub-4').dataset.submittalState).toBe('trade')
    expect(row('fairoaksd-sub-6').dataset.submittalState).toBe('us')
    expect(row('fairoaksd-sub-6').textContent).toContain('needed today')
    expect(row('fairoaksd-sub-2').dataset.submittalState).toBe('architect')
    expect(row('fairoaksd-sub-1').textContent).toContain('approved Sep 8, 15 days after it was needed')
  })

  it('records a round that came by email with its file, its Drive link and the note', () => {
    const { writes } = setup()
    fireEvent.click(within(row('fairoaksd-sub-4')).getByRole('button', { name: 'It came by email' }))
    const record = within(row('fairoaksd-sub-4')).getByRole('button', { name: 'Record it' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("The file's name"), { target: { value: 'CBM-controls.pdf' } })
    fireEvent.change(screen.getByLabelText('Its Drive link'), { target: { value: LINK } })
    fireEvent.change(screen.getByLabelText('Their note'), { target: { value: 'Sequence of operations included.' } })
    fireEvent.click(record)
    expect(writes.onCameIn).toHaveBeenCalledWith({ submittalId: 'fairoaksd-sub-4', file: 'CBM-controls.pdf', driveUrl: LINK, note: 'Sequence of operations included.' })
  })

  it('warns when only people given access can open the link, and still records it', async () => {
    const checkLink = vi.fn(async () => 'restricted' as LinkAccess)
    const { writes } = setup({ checkLink })
    fireEvent.click(within(row('fairoaksd-sub-4')).getByRole('button', { name: 'It came by email' }))
    fireEvent.change(screen.getByLabelText("The file's name"), { target: { value: 'CBM-controls.pdf' } })
    fireEvent.change(screen.getByLabelText('Its Drive link'), { target: { value: LINK } })
    fireEvent.blur(screen.getByLabelText('Its Drive link'))
    expect(await screen.findByText('Only people given access can open this link. The architect may not be one of them.')).toBeTruthy()
    expect(checkLink).toHaveBeenCalledWith(LINK)
    fireEvent.click(within(row('fairoaksd-sub-4')).getByRole('button', { name: 'Record it' }))
    expect(writes.onCameIn).toHaveBeenCalledTimes(1)
  })

  it('emails ours to the architect only when its round has a Drive link, and marks it sent another way either way', () => {
    const without = setup()
    const send = within(row('fairoaksd-sub-6')).getByRole('button', { name: 'Send to Marsh & Vale Architects' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.click(within(row('fairoaksd-sub-6')).getByRole('button', { name: 'We sent it another way' }))
    expect(without.writes.onMarkSent).toHaveBeenCalledWith('fairoaksd-sub-6')
    document.body.innerHTML = ''
    const linked = setup({ extras: [[submittalRoundKey('fairoaksd-sub-6', 1), { driveUrl: LINK, sentBy: 'office', emailSendLogId: null }]] })
    fireEvent.click(within(row('fairoaksd-sub-6')).getByRole('button', { name: 'Send to Marsh & Vale Architects' }))
    expect(linked.writes.onSendToArchitect).toHaveBeenCalledWith('fairoaksd-sub-6')
    expect(within(row('fairoaksd-sub-6')).getByRole('link', { name: 'open the file' }).getAttribute('href')).toBe(LINK)
    expect(row('fairoaksd-sub-6').textContent).toContain('came by email')
  })

  it('records the architect’s answer, and revise only with what to change', () => {
    const { writes } = setup()
    fireEvent.click(within(row('fairoaksd-sub-2')).getByRole('button', { name: 'Revise and resubmit' }))
    const record = within(row('fairoaksd-sub-2')).getByRole('button', { name: 'Record it' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(within(row('fairoaksd-sub-2')).getByLabelText("The architect's note"), { target: { value: 'Show the device addresses.' } })
    fireEvent.click(record)
    expect(writes.onAnswer).toHaveBeenCalledWith('fairoaksd-sub-2', 'revise', 'Show the device addresses.')
  })

  it('adds a submittal on a trade’s own lines, with its sections suggested and a day asked only when none of its work is drawn', () => {
    const { writes } = setup({ sections: { fconc: ['03 30 00', '03 21 00'] } })
    const concrete = document.querySelector('[data-submittal-trade="fconc"]')!.closest('div[style]')!.parentElement as HTMLElement
    fireEvent.click(within(concrete).getByRole('button', { name: 'Add a submittal' }))
    const form = document.querySelector('[data-submittal-add]') as HTMLElement
    expect([...form.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['03 30 00', '03 21 00'])
    expect(within(form).getByLabelText('Needed by')).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('What the submittal covers'), { target: { value: 'Rebar shop drawings' } })
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'shop drawings' } })
    fireEvent.change(within(form).getByLabelText('Spec section'), { target: { value: '03 21 00' } })
    fireEvent.click(within(form).getAllByRole('checkbox')[0]!)
    expect(within(form).queryByLabelText('Needed by')).toBeNull()
    fireEvent.click(within(form).getByRole('button', { name: 'Add submittal' }))
    expect(writes.onAdd).toHaveBeenCalledWith({ packageId: 'fconc', title: 'Rebar shop drawings', kind: 'shop drawings', specSection: '03 21 00', lineIds: ['fconc-1'], leadDays: 14 })
  })

  it('reads the prototype’s line on a job with no trade awarded', () => {
    setup({ project: (p) => ({ ...p, submittals: [], packages: p.packages.map((k) => ({ ...k, awardedInviteId: null })) }) })
    expect(document.body.textContent).toContain('No trade is awarded yet. Submittals start once one is.')
    expect(document.querySelector('[data-submittal-trade]')).toBeNull()
  })

  it('says its own sentences in plain words', () => {
    setup()
    fireEvent.click(within(row('fairoaksd-sub-4')).getByRole('button', { name: 'It came by email' }))
    const said = [
      document.querySelector('[data-submittal-lede]')!.textContent!,
      document.querySelector('[role="dialog"] p')!.textContent!,
      document.querySelector('[data-submittal-link-hint]')!.textContent!,
      'No trade is awarded yet. Submittals start once one is.',
      'Only people given access can open this link. The architect may not be one of them.',
      'It came with no Drive link, so it cannot be emailed from here.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
