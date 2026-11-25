// @vitest-environment jsdom
/** Render smoke for the punch list's Waiting on me view (punch list #438). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PunchListWaiting, WAITING_WHO_KEY } from './PunchListWaiting'
import type { PickMap, PickRecord } from '../../lib/todos/punchListView'
import type { BoardItem } from '../../lib/todos/todoBoard'

const row = (over: Partial<BoardItem>): BoardItem => ({
  slug: 'a',
  number: 1,
  flagged: false,
  group: 'close',
  name: 'A row',
  file: 'to-dos/a.md',
  pointer: false,
  summary: 's',
  next: 'n',
  size: 'S',
  blocker: 'none',
  ver: '',
  opinion: '',
  mockups: [],
  artifacts: [],
  mockup: 'has',
  mockupNote: '',
  ...over,
})

const WALK = row({
  slug: 'pace-card-shown',
  number: 396,
  name: 'The pace card, shown',
  file: 'to-dos/pace-card-shown/README.md',
  ask: { who: 'owner', kind: 'walk', question: 'Walk the pace card with one superintendent, on his own phone.' },
  pictures: { page: 'to-dos/pace-card-shown/pictures.html', count: 5, drawn: '2026-11-24', drawnAt: '', stale: false, lead: { kind: 'built', path: 'to-dos/pace-card-shown/pictures-lead.webp' } },
})
const DECIDE = row({
  slug: 'stickers-before-boxes',
  number: 329,
  name: 'Stickers before boxes',
  file: 'to-dos/stickers-before-boxes/README.md',
  ask: { who: 'owner', kind: 'decide', question: 'Build PRs 4 to 6 of the stickers now, or after the site is walked?' },
  pictures: {
    page: 'to-dos/stickers-before-boxes/pictures.html',
    count: 9,
    drawn: '2026-11-24',
    drawnAt: '',
    stale: false,
    lead: { kind: 'pair', today: 'to-dos/stickers-before-boxes/pictures-today.webp', ifBuilt: 'to-dos/stickers-before-boxes/pictures-if-built.webp' },
  },
})
const COUNSEL = row({ slug: 'sub-papers', number: 350, name: 'Sub papers', ask: { who: 'counsel', kind: 'decide', question: 'Give the words for sentence 2.' } })
const PLAIN = row({ slug: 'plain', number: 100, name: 'A card that asks nothing' })
const ITEMS = [WALK, DECIDE, COUNSEL, PLAIN]

const rec = (pick: PickRecord['pick'], answersAsk: string, note = ''): PickRecord => ({ pick, note, answersAsk, at: '2026-11-24T15:00:00Z', by: 'u1', byName: 'Max Sample' })

function draw(picks: PickMap = {}, role: 'master_technician' | 'dev' = 'master_technician') {
  const onSave = vi.fn()
  render(<PunchListWaiting items={ITEMS} visible={() => true} picks={picks} onSave={onSave} role={role} firstName="Max" />)
  return { onSave }
}

describe('PunchListWaiting', () => {
  beforeEach(() => window.localStorage.clear())

  it("opens on the owner's own questions, the question first, the newest card first", () => {
    draw()
    expect(screen.getByTestId('punch-waiting-headline').textContent).toBe('2 cards wait on you, Max.')
    const rows = screen.getAllByRole('article')
    expect(rows.map((r) => r.getAttribute('data-number'))).toEqual(['396', '329'])
    const first = within(rows[0]!)
    expect(first.getByText('Walk')).toBeTruthy()
    expect(first.getByText('Walk the pace card with one superintendent, on his own phone.')).toBeTruthy()
    expect(first.getByRole('link', { name: 'The pace card, shown' }).getAttribute('href')).toContain('to-dos/pace-card-shown/README.md')
    // A card with no question is not a question.
    expect(screen.queryByText('A card that asks nothing')).toBeNull()
  })

  it('draws the built lead, and today beside if built for work not built, each a door to the pictures page', () => {
    draw()
    const built = within(screen.getByTestId('punch-waiting-row-396'))
    expect(built.getByAltText('Built: The pace card, shown').getAttribute('src')).toBe('/to-dos/pace-card-shown/pictures-lead.webp')
    expect(built.getByText('5 pictures, drawn Nov 24', { exact: false })).toBeTruthy()
    expect(built.getByRole('link', { name: 'See all' }).getAttribute('href')).toBe('/to-dos/pace-card-shown/pictures.html')
    const pair = within(screen.getByTestId('punch-waiting-row-329'))
    expect(pair.getByAltText('Today: Stickers before boxes')).toBeTruthy()
    expect(pair.getByAltText('If built, the mock-up: Stickers before boxes')).toBeTruthy()
    expect(pair.getByText('If built · a mock-up')).toBeTruthy()
  })

  it('saves Go ahead with the question it answers, and takes a pressed answer back', () => {
    const { onSave } = draw({ [DECIDE.slug]: rec('later', DECIDE.ask!.question) })
    fireEvent.click(within(screen.getByTestId('punch-answer-396')).getByRole('button', { name: 'Go ahead' }))
    expect(onSave).toHaveBeenLastCalledWith('pace-card-shown', { pick: 'do', answersAsk: WALK.ask!.question })
    // The answered card folded; open the fold and press its pressed answer again.
    fireEvent.click(screen.getByTestId('punch-waiting-answered'))
    const answered = within(screen.getByTestId('punch-answer-329'))
    expect(answered.getByRole('button', { name: 'Not now' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(answered.getByRole('button', { name: 'Not now' }))
    expect(onSave).toHaveBeenLastCalledWith('stickers-before-boxes', { pick: '', answersAsk: '' })
  })

  it('folds an answered card into one line, with the note under Change', () => {
    draw({ [WALK.slug]: rec('change', WALK.ask!.question, 'Fix the bar first.') })
    expect(screen.getByTestId('punch-waiting-headline').textContent).toBe('1 card waits on you, Max.')
    expect(screen.queryByTestId('punch-waiting-row-396')).toBeNull()
    const fold = screen.getByTestId('punch-waiting-answered')
    expect(fold.textContent).toContain('Answered')
    expect(fold.textContent).toContain('#396 Change')
    fireEvent.click(fold)
    const answer = within(screen.getByTestId('punch-answer-396'))
    expect((answer.getByLabelText('What should change?') as HTMLInputElement).value).toBe('Fix the bar first.')
    expect(answer.getByText('Max Sample')).toBeTruthy()
  })

  it('saves the note when the box is left', () => {
    const { onSave } = draw({ [WALK.slug]: rec('change', WALK.ask!.question) })
    fireEvent.click(screen.getByTestId('punch-waiting-answered'))
    const box = within(screen.getByTestId('punch-answer-396')).getByLabelText('What should change?')
    fireEvent.change(box, { target: { value: 'Label the two bars.' } })
    fireEvent.blur(box)
    expect(onSave).toHaveBeenLastCalledWith('pace-card-shown', { note: 'Label the two bars.' })
  })

  it('puts a card back in the list when its question changed after the answer', () => {
    draw({ [WALK.slug]: rec('do', 'An older question.') })
    expect(screen.getByTestId('punch-waiting-row-396')).toBeTruthy()
    expect(within(screen.getByTestId('punch-answer-396')).getByRole('button', { name: 'Go ahead' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('says so on a row whose pictures are older than the card\'s newest shipped work', () => {
    const old = { ...WALK, pictures: { ...WALK.pictures!, drawnAt: 'v2.8442', stale: true } }
    render(<PunchListWaiting items={[old, DECIDE]} visible={() => true} picks={{}} onSave={vi.fn()} role="master_technician" firstName="Max" />)
    expect(screen.getByTestId('punch-waiting-stale-396').textContent).toBe('The screen changed after these were drawn.')
    expect(screen.queryByTestId('punch-waiting-stale-329')).toBeNull()
  })

  it("shows one person's questions on their pill, and remembers the pill", () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: /Counsel/ }))
    expect(screen.getByTestId('punch-waiting-headline').textContent).toBe('1 card waits on counsel.')
    expect(screen.getAllByRole('article').map((r) => r.getAttribute('data-number'))).toEqual(['350'])
    expect(window.localStorage.getItem(WAITING_WHO_KEY)).toBe('counsel')
    fireEvent.click(screen.getByRole('button', { name: /Everyone/ }))
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('says nothing is waiting when every question of the reader is answered', () => {
    draw({ [WALK.slug]: rec('do', WALK.ask!.question), [DECIDE.slug]: rec('do', DECIDE.ask!.question) })
    expect(screen.getByTestId('punch-waiting-empty').textContent).toBe('Nothing waiting on you.')
    expect(screen.getByTestId('punch-waiting-answered').textContent).toContain('#396 Go ahead · #329 Go ahead')
  })

  it('gives a dev everyone\'s questions when none is their own', () => {
    draw({}, 'dev')
    expect(screen.getByTestId('punch-waiting-headline').textContent).toBe('3 cards wait on a person.')
    expect(screen.getByRole('button', { name: /Me/ }).textContent).toContain('0')
  })
})
