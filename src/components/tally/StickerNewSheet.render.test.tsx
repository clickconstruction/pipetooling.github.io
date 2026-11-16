// @vitest-environment jsdom
/**
 * Render smoke for the Sticker is new sheet (punch list #329, PR 3, v2.7298): the number large, the two branches, the
 * match list across the site with this job's boxes first and the ones with no sticker first, a search that finds a box
 * by its digits, the press that places through `place_sticker` and hands the outcome up; the new box named by the
 * site's next free name with the sticker's number beside it; the verdicts in words (someone else took it, out of
 * reach, lost, a name the rule refuses); and a dead press with the reason when there is no signal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerLine, Place } from '../../lib/materials/onSite'
import type { StickerFacts } from '../../lib/materials/stickers'
import type { SiteMaterialsRows } from '../../lib/materials/siteMaterialsReport'

vi.mock('../../lib/materials/onSiteStore', () => ({ newId: () => 'new-box-1', sayBoxLine: vi.fn() }))

import StickerNewSheet from './StickerNewSheet'

afterEach(cleanup)

const box = (over: Partial<Container> & { id: string; label: string }): Container => ({ jobId: 'job-a', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over })
const line = (containerId: string, partName: string): ContainerLine => ({ containerId, partKey: `text:${partName}`, partId: null, partName, manufacturer: null, onHand: 3, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 })
const places: Place[] = [{ id: 'barn', jobId: 'job-a', name: 'Barn', createdAt: '2026-10-01T00:00:00Z' }]
const containers = [box({ id: 'r76', label: 'R76', locationId: 'barn' }), box({ id: 'r12', label: 'R12' }), box({ id: 'uns', label: 'Unsorted', kind: 'unsorted' })]
const lines = [line('r76', 'Gas valves')]
const jobs = [
  { id: 'job-a', hcp_number: '1204', job_name: 'Juniper Ridge, phase 2', job_address: '1 Ridge Rd' },
  { id: 'job-b', hcp_number: '1205', job_name: 'Juniper Ridge, phase 1', job_address: '2 Ridge Rd' },
]
const siteRows: SiteMaterialsRows = { places: [], containers: [box({ id: 'b1', jobId: 'job-b', label: 'R1' })], movements: [] }
const siteBoxes = [...containers, siteRows.containers[0]!].map((c) => ({ id: c.id, label: c.label, kind: c.kind, retiredAt: c.retiredAt, createdAt: c.createdAt }))

const blank: StickerFacts = { id: 's-147', number: 147, code: '4F2A9C18', state: 'blank', containerId: null, containerLabel: null, containerKind: null, containerRetiredAt: null, jobId: null, placedByName: null, placedAt: null, lostAt: null, runId: 'run-1', runJobId: 'job-a' }
const onR76: StickerFacts = { ...blank, state: 'on_box', containerId: 'r76', containerLabel: 'R76', containerKind: 'cage', jobId: 'job-a', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' }

function mount(over: Partial<Parameters<typeof StickerNewSheet>[0]> = {}) {
  const place = over.place ?? vi.fn(async () => ({ ok: true as const, already: false, created: false, containerId: 'r76', sticker: onR76 }))
  const onDone = vi.fn()
  const onClose = vi.fn()
  const onChangeJob = vi.fn()
  renderWithProviders(
    <StickerNewSheet
      sticker={blank}
      jobId="job-a"
      jobs={jobs}
      containers={containers}
      lines={lines}
      places={places}
      siteJobIds={['job-a', 'job-b']}
      siteBoxes={siteBoxes}
      stickersByBox={new Map([['r12', [152]]])}
      onClose={onClose}
      onChangeJob={onChangeJob}
      onDone={onDone}
      place={place}
      readSite={async () => siteRows}
      readStickers={async () => []}
      online={() => true}
      now={() => '2026-11-14T15:01:10Z'}
      {...over}
    />,
  )
  return { place, onDone, onClose, onChangeJob }
}

describe('StickerNewSheet · a box I know', () => {
  it('shows the sticker’s code with no number, opens on the known boxes, lists the site with this job first and no sticker first', async () => {
    mount()
    // a sticker with no name is *this sticker*, shown by its code as the tape prints it (v2.7438: no running number)
    expect(screen.getByRole('dialog', { name: 'This sticker is new' })).toBeTruthy()
    expect(screen.getByTestId('sticker-code').textContent).toBe('4F2A-9C18')
    expect(screen.queryByTestId('sticker-number')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'This sticker is new' }).textContent).not.toContain('0147')
    expect(screen.getByTestId('sticker-branch-known').getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row')).toHaveLength(3))
    const rows = screen.getAllByTestId('sticker-match-row').map((r) => r.textContent ?? '')
    expect(rows[0]).toContain('R76')
    expect(rows[0]).toContain('no sticker')
    expect(rows[0]).toContain('Barn')
    expect(rows[1]).toContain('R1')
    expect(rows[1]).toContain('1205 · Juniper Ridge, phase 1')
    expect(rows[2]).toContain('R12')
    // its sticker carries no news: no number beside the name, and it is not marked as having none
    expect(rows[2]).not.toContain('0152')
    expect(rows[2]).not.toContain('no sticker')
    expect(screen.getByTestId('sticker-no-sticker-count').textContent).toBe('2 boxes on this site have no sticker yet.')
    // Nothing picked: the press waits.
    expect((screen.getByTestId('sticker-place-known') as HTMLButtonElement).disabled).toBe(true)
  })

  it('two digits and two presses: the search finds R76, the row is picked, the press places and hands the outcome up', async () => {
    const { place, onDone } = mount()
    fireEvent.change(screen.getByTestId('sticker-match-search'), { target: { value: '76' } })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row')).toHaveLength(1))
    fireEvent.click(screen.getByTestId('sticker-match-row'))
    const press = screen.getByTestId('sticker-place-known') as HTMLButtonElement
    expect(press.textContent).toBe('Put this sticker on R76')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(place).toHaveBeenCalledWith({ kind: 'known', stickerId: 's-147', containerId: 'r76' })
    expect(onDone.mock.calls[0]![0]).toMatchObject({ kind: 'placed', words: 'The sticker is on R76.', containerId: 'r76' })
  })

  it('someone else took it first: who and when, with the box to open', async () => {
    const { onDone } = mount({ place: vi.fn(async () => ({ ok: false as const, sticker: onR76 })) })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByTestId('sticker-match-row')[0]!)
    fireEvent.click(screen.getByTestId('sticker-place-known'))
    const said = await screen.findByTestId('sticker-said')
    expect(said.textContent).toBe('Marcus put this sticker on R76 a minute ago.')
    expect(said.getAttribute('data-kind')).toBe('taken')
    fireEvent.click(screen.getByTestId('sticker-open-box'))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: 'taken', containerId: 'r76' }))
  })

  it('a sticker on another job’s box, and a lost one, say so with no box to open', async () => {
    mount({ place: vi.fn(async () => ({ ok: false as const, sticker: { ...onR76, jobId: 'job-z' } })) })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByTestId('sticker-match-row')[0]!)
    fireEvent.click(screen.getByTestId('sticker-place-known'))
    expect((await screen.findByTestId('sticker-said')).getAttribute('data-kind')).toBe('out_of_reach')
    expect(screen.queryByTestId('sticker-open-box')).toBeNull()
    cleanup()
    mount({ place: vi.fn(async () => ({ ok: false as const, sticker: { ...onR76, state: 'lost' as const, lostAt: '2026-11-14T00:00:00Z' } })) })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByTestId('sticker-match-row')[0]!)
    fireEvent.click(screen.getByTestId('sticker-place-known'))
    expect((await screen.findByTestId('sticker-said')).textContent).toBe('This sticker was on R76 and was marked lost.')
  })

  it('a refusal from the database is said in its words, and the sheet stays', async () => {
    mount({ place: vi.fn(async () => { throw { message: 'That box was retired. Bring it back first.', code: 'P0001' } }) })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByTestId('sticker-match-row')[0]!)
    fireEvent.click(screen.getByTestId('sticker-place-known'))
    expect((await screen.findByTestId('sticker-failure')).textContent).toContain('That box was retired. Bring it back first.')
    expect(screen.getByTestId('sticker-place-known')).toBeTruthy()
  })

  it('a sticker printed for another job asks once, and still places here', async () => {
    mount({ sticker: { ...blank, runJobId: 'job-b' } })
    expect(screen.getByTestId('sticker-other-job').textContent).toBe('This sticker was printed for 1205 · Juniper Ridge, phase 1. Use it here?')
  })

  it('with no signal the press is dead and says why, never kept for later', async () => {
    const { place } = mount({ online: () => false })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByTestId('sticker-match-row')[0]!)
    const press = screen.getByTestId('sticker-place-known') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('sticker-no-signal').textContent).toContain('No signal.')
    fireEvent.click(press)
    expect(place).not.toHaveBeenCalled()
  })

  it('the site’s other jobs failing to read leaves this job’s boxes listed, and says so', async () => {
    mount({ readSite: async () => { throw new Error('offline') } })
    await screen.findByTestId('sticker-site-unread')
    expect(screen.getAllByTestId('sticker-match-row')).toHaveLength(2)
  })
})

describe('StickerNewSheet · a new box', () => {
  it('opens on a new box when every box has a sticker, named by the site’s next free name, never a number', async () => {
    const { place, onDone } = mount({ stickersByBox: new Map([['r12', [152]], ['r76', [150]]]), readSite: async () => ({ places: [], containers: [], movements: [] }), siteJobIds: ['job-a'], siteBoxes: siteBoxes.filter((b) => b.id !== 'b1'), place: vi.fn(async () => ({ ok: true as const, already: false, created: true, containerId: 'new-box-1', sticker: { ...onR76, containerId: 'new-box-1', containerLabel: 'R77' } })) })
    expect(screen.getByTestId('sticker-branch-new').getAttribute('aria-pressed')).toBe('true')
    const name = screen.getByTestId('sticker-new-name') as HTMLInputElement
    expect(name.value).toBe('R77')
    expect(screen.queryByTestId('sticker-beside-name')).toBeNull()
    expect(screen.getByTestId('sticker-new-say').textContent).toBe('R77 is the next free name on this site.')
    expect(screen.getByTestId('sticker-goes-on').textContent).toContain('Goes on 1204 · Juniper Ridge, phase 2.')
    const press = screen.getByTestId('sticker-place-new') as HTMLButtonElement
    expect(press.textContent).toBe('Save box R77')
    fireEvent.click(within(screen.getByRole('group', { name: 'How it sits' })).getByText('Box'))
    fireEvent.click(press)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(place).toHaveBeenCalledWith({ kind: 'new', stickerId: 's-147', containerId: 'new-box-1', jobId: 'job-a', label: 'R77', boxKind: 'box', where: '', placeId: 'barn' })
    expect(onDone.mock.calls[0]![0]).toMatchObject({ kind: 'created', words: 'R77 is made, with its sticker on it.', containerId: 'new-box-1' })
  })

  it('a name the rule refuses, or one the site already carries, is a dead press with the reason', async () => {
    mount()
    fireEvent.click(screen.getByTestId('sticker-branch-new'))
    const name = screen.getByTestId('sticker-new-name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'T8678' } })
    expect(screen.getByTestId('sticker-new-say').textContent).toBe('A number runs from 1 to 999. T8678 cannot be a name.')
    expect((screen.getByTestId('sticker-place-new') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: 'R1' } })
    expect(screen.getByTestId('sticker-new-say').textContent).toContain('R1 is already on this site.')
    expect((screen.getByTestId('sticker-place-new') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: 'R80 TOILETS' } })
    expect((screen.getByTestId('sticker-place-new') as HTMLButtonElement).textContent).toBe('Save box R80')
  })

  it('words typed after the name stand in What is in it, and are sent as the new box’s line once the database made it (punch list #351, PR 2)', async () => {
    const sayLine = vi.fn()
    const place = vi.fn(async () => ({ ok: true as const, already: false, created: true, containerId: 'new-box-1', sticker: { ...onR76, containerId: 'new-box-1', containerLabel: 'R80' } }))
    const { onDone } = mount({ place, sayLine })
    fireEvent.click(screen.getByTestId('sticker-branch-new'))
    fireEvent.change(screen.getByTestId('sticker-new-name'), { target: { value: 'R80 TOILETS' } })
    expect(screen.getByTestId('sticker-new-say').textContent).toBe('The name is R80. “Toilets” moved to What is in it.')
    expect((screen.getByTestId('sticker-new-line') as HTMLInputElement).value).toBe('Toilets')
    fireEvent.click(screen.getByTestId('sticker-place-new'))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    // The words are on no where line any more, and the line follows the box.
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new', label: 'R80', where: '' }))
    expect(sayLine).toHaveBeenCalledWith('job-a', 'new-box-1', 'R80', 'Toilets')
  })

  it('a new box nobody described sends no line, and a line past 80 characters is a dead press with the count', async () => {
    const sayLine = vi.fn()
    const place = vi.fn(async () => ({ ok: true as const, already: false, created: true, containerId: 'new-box-1', sticker: { ...onR76, containerId: 'new-box-1', containerLabel: 'R77' } }))
    const { onDone } = mount({ place, sayLine })
    fireEvent.click(screen.getByTestId('sticker-branch-new'))
    fireEvent.change(screen.getByTestId('sticker-new-line'), { target: { value: 'x'.repeat(81) } })
    expect((screen.getByTestId('sticker-place-new') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('The line holds 80 characters. This one is 81.')).toBeTruthy()
    fireEvent.change(screen.getByTestId('sticker-new-line'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('sticker-place-new'))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(sayLine).not.toHaveBeenCalled()
  })

  it('Change under the job hands the job picker up, and Close closes', () => {
    const { onChangeJob, onClose } = mount()
    fireEvent.click(screen.getByTestId('sticker-branch-new'))
    fireEvent.click(screen.getByTestId('sticker-change-job'))
    expect(onChangeJob).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('StickerNewSheet · a sticker that names its box (design section 10, PR 9, v2.7396)', () => {
  const g = (name: string): StickerFacts => ({ ...blank, id: 's-159', number: 159, boxName: name })
  const onBox = (name: string, id: string, label: string): StickerFacts => ({ ...g(name), state: 'on_box', containerId: id, containerLabel: label, containerKind: 'cage', jobId: 'job-a', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' })

  it('a name the site does not have opens on a new box with the name filled in, one press', async () => {
    const place = vi.fn(async () => ({ ok: true as const, already: false, created: true, containerId: 'new-box-1', sticker: onBox('R90', 'new-box-1', 'R90') }))
    const { onDone } = mount({ sticker: g('R90'), place })
    expect(screen.getByRole('dialog', { name: 'Sticker R90 is new' })).toBeTruthy()
    // the name on the tape large, and no number beside it (v2.7438)
    expect(screen.getByTestId('sticker-name').textContent).toBe('R90')
    expect(screen.queryByTestId('sticker-number')).toBeNull()
    // boxes with no sticker stand on the site, and the sheet still opens on the new box: the tape says which it is
    expect(screen.getByTestId('sticker-branch-new').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByTestId('sticker-new-name') as HTMLInputElement).value).toBe('R90')
    expect(screen.getByTestId('sticker-new-say').textContent).toBe('The name is R90.')
    expect(screen.queryByTestId('sticker-beside-name')).toBeNull()
    expect(screen.queryByTestId('sticker-twin-note')).toBeNull()
    const press = screen.getByTestId('sticker-place-new') as HTMLButtonElement
    expect(press.textContent).toBe('Save box R90')
    fireEvent.click(press)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new', stickerId: 's-159', label: 'R90', jobId: 'job-a' }))
    expect(onDone.mock.calls[0]![0]).toMatchObject({ kind: 'created', words: 'R90 is made, with its sticker on it.' })
  })

  it('a name the site already has opens on that box, picked, with the press that puts the sticker on it', async () => {
    const place = vi.fn(async () => ({ ok: true as const, already: false, created: false, containerId: 'r76', sticker: onBox('R76', 'r76', 'R76') }))
    const { onDone } = mount({ sticker: g('R76'), place })
    expect(screen.getByTestId('sticker-branch-known').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('sticker-name-here').textContent).toContain('R76 is a box on this site already.')
    expect((screen.getByTestId('sticker-match-search') as HTMLInputElement).value).toBe('R76')
    const rows = screen.getAllByTestId('sticker-match-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.getAttribute('aria-pressed')).toBe('true')
    const press = screen.getByTestId('sticker-place-known') as HTMLButtonElement
    expect(press.textContent).toBe('Put this sticker on R76')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(place).toHaveBeenCalledWith({ kind: 'known', stickerId: 's-159', containerId: 'r76' })
    expect(onDone.mock.calls[0]![0]).toMatchObject({ kind: 'placed', words: 'The sticker is on R76.' })
  })

  it('It is a different box offers the next letter at the spot, and says the tape and the box will differ', async () => {
    const place = vi.fn(async () => ({ ok: true as const, already: false, created: true, containerId: 'new-box-1', sticker: onBox('R76', 'new-box-1', 'R76B') }))
    const { onDone } = mount({ sticker: g('R76'), place })
    fireEvent.click(screen.getByTestId('sticker-different-box'))
    expect(screen.getByTestId('sticker-branch-new').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByTestId('sticker-new-name') as HTMLInputElement).value).toBe('R76B')
    expect(screen.getByTestId('sticker-twin-note').textContent).toBe('The sticker reads R76. This box will be R76B, and a scan will say so.')
    const press = screen.getByTestId('sticker-place-new') as HTMLButtonElement
    expect(press.textContent).toBe('Save box R76B')
    fireEvent.click(press)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new', label: 'R76B' }))
    expect(onDone.mock.calls[0]![0]).toMatchObject({ kind: 'created', words: 'R76B is made, with sticker R76 on it.' })
  })

  it('when R76B stands, the different box is R76C', () => {
    const withTwin = [...siteBoxes, { id: 'r76b', label: 'R76B', kind: 'cage', retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }]
    mount({ sticker: g('R76'), siteBoxes: withTwin })
    fireEvent.click(screen.getByTestId('sticker-different-box'))
    expect((screen.getByTestId('sticker-new-name') as HTMLInputElement).value).toBe('R76C')
  })

  it('the search and the pick are the person’s once they touch them, and the other branch is still one press', async () => {
    mount({ sticker: g('R76') })
    fireEvent.change(screen.getByTestId('sticker-match-search'), { target: { value: '' } })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row')).toHaveLength(3))
    expect((screen.getByTestId('sticker-place-known') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('sticker-branch-new'))
    // by the plain branch press the new box still opens on the site's next free name, since R76 is taken
    expect((screen.getByTestId('sticker-new-name') as HTMLInputElement).value).toBe('R77')
  })

  it('a row says of its stickers only what carries news', async () => {
    mount({ sticker: blank, stickersByBox: new Map([['r12', [152]], ['r76', [160]]]), marksByBox: new Map([['r12', [{ number: 152, boxName: 'G9' }]], ['r76', [{ number: 160, boxName: 'R76' }]]]) })
    await waitFor(() => expect(screen.getAllByTestId('sticker-match-row')).toHaveLength(3))
    const rows = screen.getAllByTestId('sticker-match-row').map((r) => r.textContent ?? '')
    const r76 = rows.find((r) => r.startsWith('R76'))!
    // its own sticker says nothing, and it is not marked as having none
    expect(r76).not.toContain('0160')
    expect(r76).not.toContain('no sticker')
    // a sticker printed for another name says so, never its number
    const r12 = rows.find((r) => r.startsWith('R12'))!
    expect(r12).toContain('· sticker reads G9')
    expect(r12).not.toContain('0152')
  })
})
