// @vitest-environment jsdom
/**
 * Render smoke for the By person look of a site's materials: every press on the site by day with
 * who made it, one person picked from the list with their last press, the acts worth a look
 * wearing their chip and narrowing the list, a box opening from its row, and the two empty states.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerMove, Movement, MovementReason, Place } from '../../lib/materials/onSite'
import type { SiteTrail } from '../../lib/materials/sitePeopleTrailIo'
import { actStampWords } from '../../lib/materials/sitePersonActs'
import SitePeopleView from './SitePeopleView'

afterEach(() => cleanup())

// A made-up site, Cedar Ridge.
let seq = 0
function row(reason: MovementReason, qty: number, boxId: string, at: string, by: string, note = '', source: string | null = null): Movement {
  seq += 1
  const into = reason === 'delivered'
  return { id: `m${String(seq).padStart(3, '0')}`, jobId: 'j1', partId: null, partName: '2" PVC 90', manufacturer: null, quantity: qty, reason, fromContainerId: into ? null : boxId, toContainerId: into ? boxId : null, note, byUserId: null, byName: by, at, source, itemId: null }
}
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Arena', createdAt: '2026-11-01T12:00:00' }, { id: 'p2', jobId: 'j1', name: 'Bunker', createdAt: '2026-11-01T12:00:00' }]
const containers: Container[] = [{ id: 'g22', jobId: 'j1', label: 'G22', kind: 'cage', where: '', locationId: 'p1', lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00' }]
const movements: Movement[] = [
  row('delivered', 40, 'g22', '2026-11-16T10:00:00', 'Dana K.', '', 'INV-10422'),
  row('taken', 30, 'g22', '2026-11-17T09:15:00', 'Sam R.', 'bunker drains'),
  row('taken', 4, 'g22', '2026-11-18T11:02:00', 'Sam R.'),
  row('counted', 2, 'g22', '2026-11-18T13:52:00', 'Sam R.'),
]
const moves: ContainerMove[] = [{ id: 'cm1', jobId: 'j1', containerId: 'g22', fromLocationId: 'p1', toLocationId: 'p2', byName: 'Sam R.', at: '2026-11-18T10:48:00' }]
const jobs = [{ id: 'j1', label: 'J101 · Rough in' }]
const boxHref = (jobId: string, boxId: string) => `/jobs?tab=materials&job=${jobId}&box=${boxId}`

const noTrail: SiteTrail = { boxChanges: [], boxRenames: [], removedAnswers: [] }
const readNothing = async () => noTrail
const readNoAnswers = async () => ({ answers: [], takenBack: [] })
const readNoWatches = async () => []
const readNoOpens = async () => []

function draw(over: Partial<Parameters<typeof SitePeopleView>[0]> = {}) {
  return renderWithProviders(<SitePeopleView siteId="dev1" readTrail={readNothing} readAnswers={readNoAnswers} readWatches={readNoWatches} readOpens={readNoOpens} jobs={jobs} movements={movements} containerMoves={moves} containers={containers} places={places} boxHref={boxHref} {...over} />)
}

describe('SitePeopleView', () => {
  it('draws every press by day with who made it, and the figures over them', () => {
    draw()
    const rows = within(screen.getByTestId('site-people')).getAllByRole('row')
    // The head, three day lines and five acts.
    expect(rows).toHaveLength(9)
    expect(screen.getByRole('columnheader', { name: 'Who' })).toBeTruthy()
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('5presses over 3 days')
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('34pieces taken or used')
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('2worth a look')
    // The count reads what the ledger expected against what was found.
    expect(screen.getByText('6 → 2')).toBeTruthy()
  })

  it('narrows to one person, says their last press and drops the Who column', () => {
    draw()
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'sam r.' } })
    expect(screen.getByTestId('site-people-last').textContent).toContain('Sam R. · last press')
    expect(screen.queryByRole('columnheader', { name: 'Who' })).toBeNull()
    expect(screen.queryByText('INV-10422')).toBeNull()
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('4presses over 2 days')
  })

  it('narrows to the presses worth a look, each with its chip, and to one kind', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Worth a look only' }))
    expect(screen.getByText('count changed the number')).toBeTruthy()
    expect(screen.getByText('no note')).toBeTruthy()
    expect(screen.queryByText('bunker drains')).toBeNull()
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'counted' } })
    expect(screen.queryByText('no note')).toBeNull()
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'box_moved' } })
    // Nothing is both a box move and worth a look: the way out is one press.
    fireEvent.click(screen.getByRole('button', { name: 'Show every press' }))
    expect(screen.getByText('bunker drains')).toBeTruthy()
  })

  it('opens a box from its row', () => {
    draw()
    const door = screen.getAllByRole('link', { name: 'G22 · Arena' })[0]
    expect(door?.getAttribute('href')).toBe('/jobs?tab=materials&job=j1&box=g22')
    expect(screen.getByRole('link', { name: 'G22 · Arena → Bunker' })).toBeTruthy()
  })

  it('says what fills an empty site, and that it is still reading', () => {
    draw({ movements: [], containerMoves: [] })
    expect(screen.getByText('No press is on record on this site yet.')).toBeTruthy()
    cleanup()
    draw({ movements: [], containerMoves: [], loading: true })
    expect(screen.getByText('Reading the boxes…')).toBeTruthy()
  })

  it('adds the changes that are not ledger rows once their read answers', async () => {
    const readTrail = vi.fn(async () => ({
      boxChanges: [{ id: 'c1', containerId: 'g22', what: 'retired' as const, oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-18T13:50:00' }],
      boxRenames: [{ id: 'n1', containerId: 'g22', oldLabel: 'G2', newLabel: 'G22', byName: 'Dana K.', at: '2026-11-15T09:00:00' }],
      removedAnswers: [{ id: 'r1', answer: 'price' as const, jobId: 'j1', words: '2 PVC 90, $4.50', byName: 'Sam R.', at: '2026-11-18T08:00:00' }],
    }))
    draw({ readTrail })
    // The picker offers the same words, so the rows are read inside the table.
    const table = () => within(screen.getByRole('table'))
    await waitFor(() => expect(table().getByText('Retired a box')).toBeTruthy())
    expect(table().getByText('Renamed a box')).toBeTruthy()
    expect(table().getByText('G2 → G22')).toBeTruthy()
    expect(table().getByText('Removed a price')).toBeTruthy()
    expect(table().getByText('2 PVC 90, $4.50')).toBeTruthy()
    expect(readTrail).toHaveBeenCalledWith({ siteId: 'dev1', jobIds: ['j1'], containerIds: ['g22'] })
    fireEvent.change(screen.getByLabelText('Kind of press'), { target: { value: 'box_retired' } })
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('1press over 1 day')
  })

  it('says so when the trail did not load, keeps the presses, and reads again on Try again', async () => {
    let fail = true
    const readTrail = vi.fn(async () => {
      if (fail) throw { message: 'permission denied for table job_container_changes' }
      return { ...noTrail, boxChanges: [{ id: 'c1', containerId: 'g22', what: 'brought_back' as const, oldValue: '', newValue: '', byName: 'Dana K.', at: '2026-11-18T14:00:00' }] }
    })
    draw({ readTrail })
    const line = await screen.findByTestId('site-people-trail-error')
    expect(line.textContent).toContain('Box changes and answers taken off are not in this list.')
    expect(line.textContent).toContain('permission denied for table job_container_changes')
    expect(screen.getByText('bunker drains')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Brought a box back')).toBeTruthy())
    await waitFor(() => expect(screen.queryByTestId('site-people-trail-error')).toBeNull())
  })
})

describe('SitePeopleView, answers to a press', () => {
  const dialog = () => within(screen.getByRole('dialog'))

  it('lets a dev pick presses, shows what a take-back does to the number, and writes each answer with the reason', async () => {
    const give = vi.fn(async () => {})
    const readAnswers = vi.fn(async () => ({ answers: [], takenBack: [] }))
    const onLedgerChanged = vi.fn()
    draw({ canAnswer: true, give, readAnswers, onLedgerChanged })
    // A box move is not a ledger row: it takes no answer.
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    fireEvent.click(screen.getByLabelText('Pick Count 2" PVC 90'))
    fireEvent.click(screen.getAllByLabelText('Pick Taken 2" PVC 90')[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Answer 2 presses…' }))
    // The window offers a second count for the count and a mark for the take. The dev takes the count back instead.
    const picks = dialog().getAllByRole('combobox') as HTMLSelectElement[]
    expect(picks.map((p) => p.value)).toEqual(['second_count', 'mark'])
    fireEvent.change(picks[0] as HTMLSelectElement, { target: { value: 'take_back' } })
    expect(screen.getByTestId('answer-plan').textContent).toContain('2" PVC 90 in G22')
    expect(screen.getByTestId('answer-plan').textContent).toContain('2 → 6')
    const go = dialog().getByRole('button', { name: 'Take back 1, mark 1' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(dialog().getByRole('textbox'), { target: { value: 'counted without the office' } })
    fireEvent.click(go)
    await waitFor(() => expect(give).toHaveBeenCalledTimes(2))
    expect(give).toHaveBeenCalledWith('m004', 'taken_back', 'counted without the office')
    expect(give).toHaveBeenCalledWith('m003', 'marked', 'counted without the office')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onLedgerChanged).toHaveBeenCalledWith(['j1'])
    await waitFor(() => expect(readAnswers).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('site-people-answer-bar')).toBeNull()
  })

  it('tells two presses that read alike apart in the window, by their day and minute and by their note', () => {
    const alike = [row('used', 1, 'g22', '2026-11-19T13:25:00', 'Sam R.'), row('used', 1, 'g22', '2026-11-19T13:26:00', 'Sam R.', 'for the bunker sink')]
    draw({ canAnswer: true, movements: [...movements, ...alike] })
    for (const pick of screen.getAllByLabelText('Pick Used 2" PVC 90')) fireEvent.click(pick)
    fireEvent.click(screen.getByRole('button', { name: 'Answer 2 presses…' }))
    const rows = screen.getAllByTestId('answer-row')
    expect(rows).toHaveLength(2)
    // The list's order, newest first: the use with a note, then the one with none.
    expect(rows[0]?.textContent).toContain(actStampWords('2026-11-19T13:26:00'))
    expect(rows[0]?.textContent).toContain('Note: for the bunker sink')
    expect(rows[1]?.textContent).toContain(actStampWords('2026-11-19T13:25:00'))
    expect(rows[1]?.textContent).not.toContain('Note:')
    const labels = (dialog().getAllByRole('combobox') as HTMLSelectElement[]).map((s) => s.getAttribute('aria-label'))
    expect(new Set(labels).size).toBe(2)
  })

  it('keeps a press picked when its answer is refused', async () => {
    const give = vi.fn(async () => {
      throw { message: 'new row violates row-level security policy' }
    })
    draw({ canAnswer: true, give })
    fireEvent.click(screen.getAllByLabelText('Pick Taken 2" PVC 90')[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Answer 1 press…' }))
    fireEvent.change(dialog().getByRole('textbox'), { target: { value: 'no note' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Mark 1' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Answer 1 press…' })).toBeTruthy()
  })

  const answered = async () => ({
    answers: [
      { id: 'a1', movementId: 'm003', answer: 'marked' as const, why: 'taken with no note', byName: 'Dana K.', at: '2026-11-18T15:05:00' },
      { id: 'a2', movementId: 'm900', answer: 'taken_back' as const, why: 'added by mistake', byName: 'Dana K.', at: '2026-11-18T15:06:00' },
    ],
    takenBack: [{ ...movements[1], id: 'm900', quantity: 7, at: '2026-11-18T12:00:00', note: '' } as Movement],
  })

  it('shows the office each answer and the press taken back, struck through, with no press to change them', async () => {
    draw({ readAnswers: answered })
    await waitFor(() => expect(screen.getByText('marked not allowed by Dana K.')).toBeTruthy())
    expect(screen.getByText('taken back by Dana K.')).toBeTruthy()
    const row = screen.getByText('taken back by Dana K.').closest('tr') as HTMLElement
    expect(row.getAttribute('data-answer')).toBe('taken_back')
    expect(within(row).getByText('−7').style.textDecoration).toBe('line-through')
    // The press taken back is in no figure: 30 and 4 taken, as before.
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('34pieces taken or used · 4 marked not allowed')
    expect(screen.queryByRole('button', { name: 'Let it stand…' })).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('lets a dev let a press stand again, with a reason', async () => {
    const withdraw = vi.fn(async () => {})
    const onLedgerChanged = vi.fn()
    draw({ canAnswer: true, readAnswers: answered, withdraw, onLedgerChanged })
    fireEvent.click(await screen.findByRole('button', { name: 'Let it stand…' }))
    const go = dialog().getByRole('button', { name: 'Let the press stand' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(dialog().getByRole('textbox'), { target: { value: 'it was right' } })
    fireEvent.click(go)
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith('a2', 'it was right'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onLedgerChanged).toHaveBeenCalledWith(['j1'])
    // An answered press takes no second answer: only the three with none can be picked.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })
})

describe('SitePeopleView, a watched person', () => {
  // The same site, with the logins behind the names: a watch is on a login.
  const withLogins = movements.map((m) => ({ ...m, byUserId: m.byName === 'Sam R.' ? 'u-sam' : 'u-dana' }))
  const watch = { id: 'w1', userId: 'u-sam', why: 'back on site alone', tellUserIds: [], setByName: 'Dana K.', setAt: '2026-11-18T00:00:00' }
  const secondBox: Container = { id: 'g40', jobId: 'j1', label: 'G40', kind: 'cage', where: '', locationId: 'p1', lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00' }

  it('marks what the watched person does outside the process in red, and nothing for anyone else', async () => {
    draw({ movements: withLogins, readWatches: async () => [watch] })
    // In the list of everyone, the watched person's count and no-note take read in red.
    await waitFor(() => expect(screen.getByText('a count is the office’s')).toBeTruthy())
    expect(screen.getByText('no note')).toBeTruthy()
    expect(screen.queryByText('count changed the number')).toBeNull()
    expect(screen.queryByTestId('site-people-watched')).toBeNull()
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'sam r.' } })
    expect(screen.getByTestId('site-people-watched').textContent).toContain('Watched since')
    expect(screen.getByRole('button', { name: 'Outside the process only' })).toBeTruthy()
    expect(screen.getByTestId('site-people-tiles').textContent).toContain('2outside the process')
    // The other person keeps the words everyone has.
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'dana k.' } })
    expect(screen.queryByTestId('site-people-watched')).toBeNull()
    expect(screen.getByRole('button', { name: 'Worth a look only' })).toBeTruthy()
  })

  it('names the boxes the watched person opened and pressed nothing on', async () => {
    const readOpens = vi.fn(async () => [
      { containerId: 'g40', at: '2026-11-18T09:00:00' },
      { containerId: 'g22', at: '2026-11-18T09:05:00' },
    ])
    draw({ movements: withLogins, containers: [...containers, secondBox], readWatches: async () => [watch], readOpens })
    fireEvent.change(await screen.findByLabelText('Person'), { target: { value: 'sam r.' } })
    const strip = await screen.findByTestId('site-people-quiet-boxes')
    expect(strip.textContent).toContain('Sam R. opened 1 box and pressed nothing:')
    expect(within(strip).getByRole('link', { name: 'G40' }).getAttribute('href')).toBe('/jobs?tab=materials&job=j1&box=g40')
    expect(readOpens).toHaveBeenCalledWith('w1')
  })
})

describe('SitePeopleView, a box change put back', () => {
  const retiredBox: Container = { ...containers[0] as Container, retiredAt: '2026-11-18T13:50:00' }
  const trail = async () => ({ ...noTrail, boxChanges: [{ id: 'c1', containerId: 'g22', what: 'retired' as const, oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-18T13:50:00' }] })

  it('offers a dev the way back, asks first, and writes it through the screen’s own store', async () => {
    const putBack = vi.fn()
    draw({ canAnswer: true, containers: [retiredBox], readTrail: trail, putBack })
    fireEvent.click(await screen.findByRole('button', { name: 'Put it back…' }))
    // The confirm window's press names the act.
    fireEvent.click(await screen.findByRole('button', { name: 'Bring G22 back' }))
    await waitFor(() => expect(putBack).toHaveBeenCalledWith({ containerId: 'g22', act: 'unretire', words: 'Bring G22 back' }))
  })

  it('offers nothing to the office, and nothing once the box has changed again', async () => {
    draw({ containers: [retiredBox], readTrail: trail, putBack: vi.fn() })
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Retired a box')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Put it back…' })).toBeNull()
    cleanup()
    // The box is live again: the retire has nothing left to put back.
    draw({ canAnswer: true, readTrail: trail, putBack: vi.fn() })
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Retired a box')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Put it back…' })).toBeNull()
  })
})

