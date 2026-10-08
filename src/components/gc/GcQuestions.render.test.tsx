// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcQuestionsWindow, type AnswerReach } from './GcQuestions'
import { gcProjectFromRows, type GcProjectRows } from '../../lib/gc/projectRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const rows: GcProjectRows = {
  project: { id: 'p1', name: 'Clinic', address: null, customer_id: 'c1', plans_link: null },
  gc: { stage: 'bidding', bid_due: '2026-10-20', sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: 'a1', project_manager_user_id: null, general_conditions: 0, contingency_pct: 0, fee_pct: 0, drive_folder_url: '', lost_on: null },
  packages: [{ id: 'elec', trade: 'Electrical', position: 0, budget: 0, ours: false, own_bid_id: null }],
  scopeItems: [],
  exclusions: [],
  sets: [{ id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null }],
  setItems: [],
  questions: [
    { id: 'q1', package_id: 'elec', asked_by_name: 'Pecan Valley Electric', text: 'Is the panel a 400 A?', sheets: ['E-101'], asked_on: '2026-10-02', sent_to_architect_on: null, answered_on: null, answer: '', in_set_id: null },
    { id: 'q2', package_id: 'elec', asked_by_name: 'Pecan Valley Electric', text: 'Which fixtures in bay 2?', sheets: [], asked_on: '2026-10-01', sent_to_architect_on: '2026-10-02', answered_on: '2026-10-03', answer: 'Type F2.', in_set_id: null },
  ],
}

describe('GcQuestionsWindow', () => {
  it('lists the open question with its sends, the answered one with the note it will carry, and records an answer through the write it is given', () => {
    const onAnswer = vi.fn()
    const onSendToArchitect = vi.fn()
    render(
      <GcQuestionsWindow
        project={gcProjectFromRows(rows)}
        architectName="Marsh & Vale Architects"
        today="2026-10-06"
        onClose={() => undefined}
        writes={{ onRecord: vi.fn(), onSendToArchitect, onMarkSent: vi.fn(), onAnswer }}
      />,
    )
    expect(screen.getByText('Waiting on an answer (1)')).toBeTruthy()
    expect(screen.getByText('Is the panel a 400 A?')).toBeTruthy()
    expect(document.body.textContent).toContain('Questions close Sat, Oct 17.')
    expect(document.body.textContent).toContain('1 answer is not in a set yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Email it to Marsh & Vale Architects' }))
    expect(onSendToArchitect).toHaveBeenCalledWith('q1')
    fireEvent.change(screen.getByLabelText('The answer to Is the panel a 400 A?'), { target: { value: 'Yes, 400 A.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record the answer' }))
    expect(onAnswer).toHaveBeenCalledWith('q1', 'Yes, 400 A.', [])
    expect(document.body.textContent).toContain('Emails to the companies go out once the portal opens.')
  })

  const reach = (canSend: boolean): AnswerReach => ({
    canSend,
    recipients: (packageId) =>
      packageId === 'elec'
        ? [
            { companyId: 'c1', company: 'Pecan Valley Electric' },
            { companyId: 'c2', company: 'Sample Electric Co.' },
          ]
        : [],
    companyName: (id) => ({ c1: 'Pecan Valley Electric', c2: 'Sample Electric Co.' })[id] ?? null,
  })
  const answeredTo = (sentTo: string[]): GcProjectRows => ({
    ...rows,
    questions: [rows.questions![0]!, { ...rows.questions![1]!, company_id: 'c1', answer_sent_to: sentTo }],
  })

  it('ticks each company on the trade for a dev, and one press records the answer and emails the ones still ticked (P3-b)', () => {
    const onAnswer = vi.fn()
    render(
      <GcQuestionsWindow
        project={gcProjectFromRows({ ...rows, questions: [{ ...rows.questions![0]!, company_id: 'c2' }, rows.questions![1]!] })}
        architectName="Marsh & Vale Architects"
        today="2026-10-06"
        answerReach={reach(true)}
        onClose={() => undefined}
        writes={{ onRecord: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer, onSendAnswer: vi.fn() }}
      />,
    )
    expect(document.body.textContent).toContain('It goes to the companies ticked.')
    expect(screen.getByLabelText('Sample Electric Co. · asked it')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The answer to Is the panel a 400 A?'), { target: { value: 'Yes, 400 A.' } })
    fireEvent.click(screen.getByLabelText('Pecan Valley Electric'))
    fireEvent.click(screen.getByRole('button', { name: 'Send the answer to 1 company' }))
    expect(onAnswer).toHaveBeenCalledWith('q1', 'Yes, 400 A.', ['c2'])
  })

  it('says who an answer went to, and offers it to the companies that have not had it', () => {
    const onSendAnswer = vi.fn()
    const view = render(
      <GcQuestionsWindow
        project={gcProjectFromRows(answeredTo(['c1']))}
        architectName={null}
        today="2026-10-06"
        answerReach={reach(true)}
        onClose={() => undefined}
        writes={{ onRecord: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer: vi.fn(), onSendAnswer }}
      />,
    )
    expect(document.body.textContent).toContain('Sent to Pecan Valley Electric.')
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Sample Electric Co.' }))
    expect(onSendAnswer).toHaveBeenCalledWith('q2', ['c2'])
    view.unmount()

    render(
      <GcQuestionsWindow
        project={gcProjectFromRows(answeredTo(['c1', 'c2']))}
        architectName={null}
        today="2026-10-06"
        answerReach={reach(false)}
        onClose={() => undefined}
        writes={{ onRecord: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer: vi.fn(), onSendAnswer }}
      />,
    )
    expect(document.body.textContent).toContain('Sent to Pecan Valley Electric and Sample Electric Co. Not in a set yet.')
    expect(screen.queryByRole('button', { name: /Send it to/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Record the answer' })).toBeTruthy()
  })

  it('says why no email goes on a job that is ours with no company awarded the trade', () => {
    render(
      <GcQuestionsWindow
        project={gcProjectFromRows({ ...rows, gc: { ...rows.gc, stage: 'building' } })}
        architectName={null}
        today="2026-10-06"
        answerReach={{ ...reach(true), recipients: () => [] }}
        onClose={() => undefined}
        writes={{ onRecord: vi.fn(), onSendToArchitect: vi.fn(), onMarkSent: vi.fn(), onAnswer: vi.fn() }}
      />,
    )
    expect(document.body.textContent).toContain('The job is ours, and only the company awarded the trade hears it. None is awarded yet, so no email goes.')
    expect(screen.getByRole('button', { name: 'Record the answer' })).toBeTruthy()
  })
})
