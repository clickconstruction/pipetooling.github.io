// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcQuestionsWindow } from './GcQuestions'
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
    expect(onAnswer).toHaveBeenCalledWith('q1', 'Yes, 400 A.')
  })
})
