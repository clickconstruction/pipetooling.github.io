// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcWeeklyReportCard, type WeeklyReportWrites } from './GcWeeklyReport'
import { weeklyReportRefusal } from '../../lib/gc/weeklyReportRows'
import { GcDailyLogWindow } from './GcDailyLog'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import type { CustomerEmailAnswer } from '../../lib/gc/customerEmail'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const went: CustomerEmailAnswer = { ok: true, to: 'Cibolo Creek Partners', email: 'elena@cibolo.test' }

function writesFn(answer: CustomerEmailAnswer = went): { [K in keyof WeeklyReportWrites]: ReturnType<typeof vi.fn> } {
  return { onSentFromMe: vi.fn(), onSendFromCompany: vi.fn(() => Promise.resolve(answer)), onTest: vi.fn(() => Promise.resolve({ ...went, test: true })) }
}

/** Fair Oaks D on the test state's Friday, Oct 2: the week's logs are in, nothing sent for it yet. */
function setup({ me = 'Rosa' as string | null, project: change, answer }: { me?: string | null; project?: (p: GcProject) => GcProject; answer?: CustomerEmailAnswer } = {}) {
  const base = initialGcState()
  const found = base.projects.find((p) => p.id === 'fairoaksd')!
  const project = change ? change(found) : found
  const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = writesFn(answer)
  render(<GcWeeklyReportCard state={state} project={project} me={me} writes={writes} />)
  return { writes }
}
const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Weekly report' }))
  return screen.getByRole('dialog', { name: 'Weekly report, Fair Oaks Shops, Building D' })
}
const footer = () => document.querySelector('[data-weekly-footer]')!.textContent!

describe('GcWeeklyReportCard', () => {
  it('is ready on Friday from the week’s logs, and opens the report as Elena reads it', () => {
    setup()
    expect((document.querySelector('[data-weekly-card]') as HTMLElement).dataset.weeklyCard).toBe('ready')
    const dialog = open()
    const preview = dialog.querySelector('[data-weekly-preview]')!.textContent!
    expect(preview).toContain('Hi Elena,')
    expect(preview).toContain('At a glance')
    expect(preview).toContain('Thanks,\nRosa')
  })

  it('reads as sent once a report for the week is kept', () => {
    setup({ project: (p) => ({ ...p, weeklyReports: [{ weekOf: '2026-09-28', sentOn: '2026-10-02', from: 'company', by: 'Click Construction', to: 'Elena at Cibolo Creek Partners', copiedArchitect: false, subject: 'S', body: 'B' }] }) })
    expect((document.querySelector('[data-weekly-card]') as HTMLElement).dataset.weeklyCard).toBe('sent')
    expect(document.querySelector('[data-weekly-card-words]')!.textContent).toBe('It went to Elena at Cibolo Creek Partners. It is kept on the job.')
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }))
    expect(footer()).toBe('Sent Oct 2. Sending again sends a new email. The newest one is the one kept for the week.')
  })

  it('leaves a section out when it is unticked, and adds a line of my own in the short one', () => {
    setup()
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /At a glance/ }))
    expect(dialog.querySelector('[data-weekly-preview]')!.textContent).not.toContain('At a glance')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Short' }))
    fireEvent.change(within(dialog).getByPlaceholderText('Anything they should hear from you'), { target: { value: 'The crane comes Tuesday' } })
    expect(dialog.querySelector('[data-weekly-preview]')!.textContent).toContain('The crane comes Tuesday.')
  })

  it('from me: the link opens my own mail filled in, and the report is kept as from me', () => {
    const { writes } = setup()
    const dialog = open()
    expect(footer()).toBe('Opens your email with this filled in, under your name. Replies come to you. It is kept on the job.')
    const link = within(dialog).getByRole('link', { name: 'Send to Elena' }) as HTMLAnchorElement
    expect(link.href).toMatch(/^mailto:/)
    expect(decodeURIComponent(link.href)).toContain('Hi Elena,')
    fireEvent.click(link)
    expect(writes.onSentFromMe).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'fairoaksd', weekOf: '2026-09-28', from: 'me', by: 'Rosa', copyArchitect: false }))
    expect(within(dialog).queryByRole('button', { name: 'Email me a test' })).toBeNull()
  })

  it('from the company: a test first, then the send, each saying what happened', async () => {
    const { writes } = setup()
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Click Construction' }))
    expect(footer()).toBe('Goes from Click Construction to Elena. Replies go to the project manager. It is kept on the job.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(footer()).toBe('A test went to your email. It says TEST, and nobody else got it.'))
    expect(writes.onTest).toHaveBeenCalledWith(expect.objectContaining({ from: 'company', by: 'Click Construction' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Elena' }))
    await waitFor(() => expect(footer()).toBe('It went to Elena. It is kept on the job.'))
    const sent = writes.onSendFromCompany.mock.calls[0]![0]
    expect(sent.body).toMatch(/^Hello Elena,/)
    expect(sent.body).toMatch(/Thank you,\nClick Construction$/)
  })

  it('sends the text as I edited it', async () => {
    const { writes } = setup({ me: null })
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit the text' }))
    fireEvent.change(within(dialog).getByRole('textbox', { name: "The report's text" }), { target: { value: 'Hello Elena,\n\nShort week. More Monday.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Elena' }))
    await waitFor(() => expect(writes.onSendFromCompany).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hello Elena,\n\nShort week. More Monday.' })))
  })

  it('says a refusal in the report’s own words', async () => {
    setup({ me: null, answer: { ok: false, key: 'alreadySent' } })
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Elena' }))
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toBe('This report went already. Press Send again to send a new one.'))
    expect(weeklyReportRefusal({ ok: false, key: 'noEmail' })).toContain('no email address on file')
  })

  it('says each thing a first-timer reads in plain words', () => {
    setup()
    const dialog = open()
    const said = [
      document.querySelector('[data-weekly-card-words]')!.textContent!,
      footer(),
      'Goes from Click Construction to Elena. Replies go to the project manager. It is kept on the job.',
      'Sent Oct 2. Sending again sends a new email. The newest one is the one kept for the week.',
      'A test went to your email. It says TEST, and nobody else got it.',
      'It went to Elena. It is kept on the job.',
      'Your email opened with the report to Elena. It is kept on the job.',
      'This report went already. Press Send again to send a new one.',
      'No daily log for Sep 30. The report skips that day. Add the log first and it fills in.',
      'Off, it says their trade, like Electrical.',
    ]
    expect(dialog).toBeTruthy()
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('the weekly report on the Daily log window', () => {
  it('shows this week’s card, and Escape closes the report before the log', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const onClose = vi.fn()
    render(
      <GcDailyLogWindow
        state={state}
        project={project}
        today="2026-10-02"
        onSave={vi.fn(() => Promise.resolve(true))}
        weekly={{ state, project, me: 'Rosa', writes: writesFn() }}
        onClose={onClose}
      />,
    )
    expect(document.querySelector('[data-weekly-card]')).toBeTruthy()
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Weekly report, Fair Oaks Shops, Building D' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
