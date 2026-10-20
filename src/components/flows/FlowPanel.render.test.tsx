// @vitest-environment jsdom
/** The flow panel, its rail and a step's card (Messages cut 4) over the prototype's demo people. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { stepCard, type PressId } from '../../lib/flows/card'
import { demoPeople, demoPerson, NOW } from '../../lib/flows/demoPeople.fixture'
import { flowPanel } from '../../lib/flows/panel'
import { installDomShims } from '../../test/renderSmokeMocks'
import { FlowPanel } from './FlowPanel'
import { FlowRail } from './FlowRail'
import { FlowStepCard } from './FlowStepCard'

installDomShims()

const people = demoPeople()

describe('FlowPanel', () => {
  it('draws Greg’s flow: the lanes, his lapsed papers, Boerne’s late ask, how far along and their page', () => {
    const onStep = vi.fn()
    const onJob = vi.fn()
    render(<FlowPanel model={flowPanel(demoPerson('greg'), null, people)} onStep={onStep} onJob={onJob} pageHref="/t/tok?preview=1" />)
    const panel = screen.getByRole('region', { name: 'Trade partner flow' })
    expect(within(panel).getByText('Once')).toBeTruthy()
    const papers = within(panel).getByRole('button', { name: /^Papers in: lapsed/ })
    expect(papers.textContent).toContain('lapsed · insurance expired')
    expect(papers.textContent).toContain('W-9 ✓ · insurance !')
    expect(within(panel).getByRole('button', { name: /^Asked to quote: on now, their move, late 2 days/ })).toBeTruthy()
    expect(within(panel).getByText(/steps done\./)).toBeTruthy()
    expect((within(panel).getByRole('link', { name: /See their page/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/t/tok?preview=1')
    fireEvent.click(papers)
    expect(onStep).toHaveBeenCalledWith('papers', null)
    fireEvent.change(within(panel).getByRole('combobox', { name: 'Which job' }), { target: { value: 'boerne' } })
    expect(onJob).toHaveBeenCalledWith('boerne')
  })

  it('says once when they are off the flow, and offers no Take off then', () => {
    const onTakeOff = vi.fn()
    render(<FlowPanel model={flowPanel(demoPerson('marcus'), null, people)} onStep={() => undefined} onJob={() => undefined} onTakeOff={onTakeOff} />)
    expect(screen.getByRole('note').textContent).toMatch(/^Off the flow since /)
    expect(screen.queryByRole('button', { name: 'Take off the flow' })).toBeNull()
  })

  it('folds to its rail of marks, which open a step and the panel', () => {
    const onStep = vi.fn()
    const onOpen = vi.fn()
    render(<FlowRail model={flowPanel(demoPerson('greg'), null, people)} onStep={onStep} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Papers in: lapsed' }))
    expect(onStep).toHaveBeenCalledWith('papers', null)
    fireEvent.click(screen.getByRole('button', { name: 'Open the trade partner flow' }))
    expect(onOpen).toHaveBeenCalled()
  })
})

describe('FlowStepCard', () => {
  const handles = new Set<PressId>(['addNote', 'skip', 'holdUntilMon', 'remindNow'])
  const card = stepCard(demoPerson('tom'), 'papers', null, NOW)!

  it('reads Tom’s papers as a card at a desk, with the presses this screen can do', () => {
    const onPress = vi.fn()
    render(<FlowStepCard card={card} onPress={onPress} handles={handles} onClose={() => undefined} sheet={false} asking={null} onAnswer={() => undefined} onCancelAsk={() => undefined} busy={false} problem={null} />)
    const dialog = screen.getByRole('dialog', { name: card.title })
    fireEvent.click(within(dialog).getByRole('button', { name: '+ a note' }))
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'addNote' }))
    // A paper's press with no window send behind it reads greyed, not missing.
    const ask = within(dialog).queryByRole('button', { name: 'Ask for it' }) as HTMLButtonElement | null
    if (ask) expect(ask.disabled).toBe(true)
  })

  it('asks for the words a note needs, and keeps Save off until there are some', () => {
    const onAnswer = vi.fn()
    const press = { id: 'addNote' as const, label: 'Add the note' }
    render(<FlowStepCard card={card} onPress={() => undefined} handles={handles} onClose={() => undefined} sheet asking={{ press, label: 'The note, for the team', placeholder: 'x' }} onAnswer={onAnswer} onCancelAsk={() => undefined} busy={false} problem="That step is not on this person's flow." />)
    const save = screen.getByRole('button', { name: 'Add the note' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The note, for the team'), { target: { value: 'Their broker renews Nov 1.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the note' }))
    expect(onAnswer).toHaveBeenCalledWith('Their broker renews Nov 1.')
    expect(screen.getByRole('alert').textContent).toBe("That step is not on this person's flow.")
  })
})
