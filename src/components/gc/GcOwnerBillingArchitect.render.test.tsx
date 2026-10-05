// @vitest-environment jsdom
/**
 * Render smoke for the architect's answer box (the owner, 2026-10-05: finish the prototype): a
 * question waiting on Marsh & Vale has a box; Send stays shut until there is an answer, and the
 * answer goes to every company on the trade through answerQuestion, as the office's does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { gcReducer, initialGcState, questionRecipients, type GcAction } from '../../lib/gcMode/gcModel'
import { GcOwnerBillingArchitectPortal } from './GcOwnerBillingArchitect'

afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.questions.some((q) => q.id === 'q-elec-1'))

describe("the architect's portal answers the trades' questions", () => {
  it('sends the typed answer to every company on the trade', () => {
    if (!project) throw new Error('no project with the electrical question')
    const q = project.questions.find((x) => x.id === 'q-elec-1')
    if (!q) throw new Error('no question')
    const dispatch = vi.fn<(a: GcAction) => void>()
    render(<GcOwnerBillingArchitectPortal state={state} project={project} dispatch={dispatch} />)
    const box = screen.getByLabelText(`Your answer to ${q.text}`)
    const sends = screen.getAllByRole('button', { name: 'Send your answer' }) as HTMLButtonElement[]
    expect(sends.every((b) => b.disabled)).toBe(true)
    fireEvent.change(box, { target: { value: '520 amps is right. A revised E-301 comes in the next addendum.' } })
    const ready = sends.find((b) => !b.disabled)
    if (!ready) throw new Error('send did not open')
    fireEvent.click(ready)
    const to = questionRecipients(state, project, q).map((r) => r.partner.id)
    expect(to.length).toBeGreaterThan(0)
    expect(dispatch).toHaveBeenCalledWith({ type: 'answerQuestion', projectId: project.id, questionId: 'q-elec-1', answer: '520 amps is right. A revised E-301 comes in the next addendum.', recipients: to })
  })

  it('lists what it answered once the answer is in', () => {
    if (!project) throw new Error('no project')
    const q = project.questions.find((x) => x.id === 'q-elec-1')
    if (!q) throw new Error('no question')
    const to = questionRecipients(state, project, q).map((r) => r.partner.id)
    const next = gcReducer(state, { type: 'answerQuestion', projectId: project.id, questionId: q.id, answer: '520 amps.', recipients: to })
    const after = next.projects.find((p) => p.id === project.id)
    if (!after) throw new Error('no project after')
    render(<GcOwnerBillingArchitectPortal state={next} project={after} dispatch={vi.fn()} />)
    expect(screen.getByText('You answered')).toBeTruthy()
    expect(screen.queryByLabelText(`Your answer to ${q.text}`)).toBeNull()
  })
})
