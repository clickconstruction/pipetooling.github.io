/**
 * A site's presses by person: each ledger row and box move becomes one act in the office's words,
 * a count reads what the ledger expected against what was found, the three kinds worth a look wear
 * their chip, and the list narrows by person, by kind and to the acts worth a look.
 */
import { describe, expect, it } from 'vitest'
import type { Container, ContainerMove, Movement, MovementReason, Place } from './onSite'
import { actDays, actPeople, actStampWords, actTiles, filterActs, localDayOf, openedNotPressed, outsideProcess, personKeyOf, sitePersonActs, withWatch } from './sitePersonActs'

// A made-up site, Cedar Ridge: two jobs, two places.
const day = (iso: string) => iso.slice(0, 10)
const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: '2026-11-01T00:00:00Z' })
const box = (id: string, jobId: string, label: string, locationId: string | null): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
let seq = 0
function row(p: { job?: string; reason: MovementReason; part?: string; qty: number; from?: string | null; to?: string | null; at: string; by: string; note?: string; source?: string | null }): Movement {
  seq += 1
  return { id: `m${String(seq).padStart(3, '0')}`, jobId: p.job ?? 'j1', partId: null, partName: p.part ?? '2" PVC 90', manufacturer: null, quantity: p.qty, reason: p.reason, fromContainerId: p.from ?? null, toContainerId: p.to ?? null, note: p.note ?? '', byUserId: null, byName: p.by, at: p.at, source: p.source ?? null, itemId: null }
}
const jobs = [{ id: 'j1', label: 'J101 · Rough in' }, { id: 'j2', label: 'J102 · Materials' }]
const places = [place('p1', 'j1', 'Arena'), place('p2', 'j1', 'Bunker')]
const containers = [box('g22', 'j1', 'G22', 'p1'), box('g40', 'j1', 'G40', 'p1'), box('b7', 'j2', 'B7', null)]

function site(movements: Movement[], containerMoves: ContainerMove[] = []) {
  return sitePersonActs({ jobs, movements, containerMoves, containers, places }, day)
}

describe('sitePersonActs', () => {
  it('reads each row in the office’s words, newest first', () => {
    const acts = site([
      row({ reason: 'delivered', qty: 40, to: 'g22', at: '2026-11-16T15:00:00Z', by: 'Dana K.', source: 'INV-10422' }),
      row({ reason: 'taken', qty: 30, from: 'g22', at: '2026-11-17T15:15:00Z', by: 'Sam R.', note: 'bunker drains' }),
      row({ reason: 'moved', qty: 4, from: 'g22', to: 'g40', at: '2026-11-17T16:00:00Z', by: 'Sam R.' }),
    ])
    expect(acts.map((a) => a.what)).toEqual(['Moved', 'Taken', 'Delivered'])
    expect(acts.map((a) => a.qty)).toEqual(['4', '−30', '+40'])
    expect(acts[0]?.where).toBe('G22 · Arena → G40 · Arena')
    expect(acts[1]).toMatchObject({ where: 'G22 · Arena', note: 'bunker drains', jobLabel: 'J101 · Rough in', who: 'Sam R.', pieces: 30, looks: [] })
    // A delivery's invoice stands in the note column when nobody wrote a note.
    expect(acts[2]).toMatchObject({ note: 'INV-10422', looks: [], pieces: 0 })
  })

  it('reads a count as what the ledger expected against what was found', () => {
    const acts = site([
      row({ reason: 'delivered', qty: 40, to: 'g22', at: '2026-11-16T15:00:00Z', by: 'Dana K.', source: 'PO-2211' }),
      row({ reason: 'taken', qty: 10, from: 'g22', at: '2026-11-17T15:00:00Z', by: 'Sam R.', note: 'lodge' }),
      row({ reason: 'counted', qty: 12, from: 'g22', at: '2026-11-18T19:52:00Z', by: 'Sam R.' }),
    ])
    expect(acts[0]).toMatchObject({ what: 'Count', qty: '30 → 12', looks: ['count_changed'], pieces: 0 })
  })

  it('leaves a first count and a count that found what was expected without a chip', () => {
    const acts = site([
      row({ reason: 'counted', qty: 40, from: 'g22', at: '2026-11-16T15:00:00Z', by: 'Dana K.' }),
      row({ reason: 'taken', qty: 10, from: 'g22', at: '2026-11-17T15:00:00Z', by: 'Sam R.', note: 'lodge' }),
      row({ reason: 'counted', qty: 30, from: 'g22', at: '2026-11-18T09:00:00Z', by: 'Dana K.' }),
      row({ reason: 'counted', qty: 0, from: 'g22', at: '2026-11-18T19:52:00Z', by: 'Sam R.' }),
    ])
    expect([...acts].reverse().map((a) => [a.qty, a.looks])).toEqual([
      ['0 → 40', []],
      ['−10', []],
      ['30 → 30', []],
      ['30 → 0', ['count_changed']],
    ])
  })

  it('keeps a count on one job from reading another job’s line', () => {
    const acts = site([
      row({ job: 'j1', reason: 'delivered', qty: 40, to: 'g22', at: '2026-11-16T15:00:00Z', by: 'Dana K.', source: 'PO-1' }),
      row({ job: 'j2', reason: 'counted', qty: 5, from: 'b7', at: '2026-11-18T10:00:00Z', by: 'Luis M.' }),
    ])
    expect(acts[0]).toMatchObject({ qty: '0 → 5', where: 'B7', jobLabel: 'J102 · Materials' })
  })

  it('marks the three kinds worth a look, and no other', () => {
    const acts = site([
      row({ reason: 'delivered', qty: 6, to: 'g40', at: '2026-11-18T10:00:00Z', by: 'Sam R.' }),
      row({ reason: 'delivered', qty: 6, to: 'g40', at: '2026-11-18T10:01:00Z', by: 'Dana K.', source: 'INV-7' }),
      row({ reason: 'taken', qty: 16, from: 'g40', at: '2026-11-18T11:02:00Z', by: 'Sam R.' }),
      row({ reason: 'used', qty: 3, from: 'g40', at: '2026-11-18T11:30:00Z', by: 'Sam R.', note: '  ' }),
      row({ reason: 'used', qty: 3, from: 'g40', at: '2026-11-18T11:31:00Z', by: 'Sam R.', note: 'decon room' }),
      row({ reason: 'returned', qty: 2, from: 'g40', at: '2026-11-18T11:32:00Z', by: 'Sam R.' }),
      row({ reason: 'damaged', qty: 1, from: 'g40', at: '2026-11-18T11:33:00Z', by: 'Sam R.' }),
      row({ reason: 'cannot_find', qty: 1, from: 'g40', at: '2026-11-18T11:34:00Z', by: 'Sam R.' }),
      row({ reason: 'delivered', qty: 9, to: 'g40', at: '2026-11-18T11:35:00Z', by: 'Sam R.' }),
      row({ reason: 'delivered', qty: 9, to: 'g40', at: '2026-11-18T11:36:00Z', by: 'Dana K.', source: 'PO-9' }),
    ])
    const looks = [...acts].reverse().map((a) => a.looks)
    // The first part added to a line is a box counted in. The ninth row adds by hand on top of a number.
    expect(looks).toEqual([[], [], ['no_note'], ['no_note'], [], [], [], [], ['no_source'], []])
  })

  it('reads a box move with both places, and a box or place that is gone in words', () => {
    const moves: ContainerMove[] = [
      { id: 'cm1', jobId: 'j1', containerId: 'g40', fromLocationId: 'p1', toLocationId: 'p2', byName: 'Sam R.', at: '2026-11-18T10:48:00Z' },
      { id: 'cm2', jobId: 'j1', containerId: 'gone', fromLocationId: null, toLocationId: 'p9', byName: '', at: '2026-11-18T10:49:00Z' },
    ]
    const acts = site([], moves)
    expect(acts[1]).toMatchObject({ kind: 'box_moved', what: 'Moved a box', part: null, qty: '', where: 'G40 · Arena → Bunker', boxId: 'g40' })
    expect(acts[0]).toMatchObject({ where: 'a box no longer listed · no place → a place no longer listed', who: 'No name on the row' })
  })
})

describe('the list’s figures and filters', () => {
  const acts = site(
    [
      row({ reason: 'taken', qty: 30, from: 'g22', at: '2026-11-17T15:15:00Z', by: 'Sam R.', note: 'bunker drains' }),
      row({ reason: 'taken', qty: 16, from: 'g40', at: '2026-11-18T11:02:00Z', by: 'sam r. ' }),
      row({ reason: 'counted', qty: 12, from: 'g22', at: '2026-11-18T19:52:00Z', by: 'Sam R.' }),
      row({ job: 'j2', reason: 'used', qty: 3, from: 'b7', at: '2026-11-18T20:00:00Z', by: 'Luis M.', note: 'lodge' }),
    ],
    [{ id: 'cm1', jobId: 'j1', containerId: 'g40', fromLocationId: 'p1', toLocationId: 'p2', byName: 'Sam R.', at: '2026-11-18T10:48:00Z' }],
  )

  it('lists the people, the one who pressed last first, a name in two cases as one person', () => {
    expect(actPeople(acts).map((p) => [p.key, p.acts])).toEqual([['luis m.', 1], ['sam r.', 4]])
    expect(personKeyOf('  Sam R. ')).toBe('sam r.')
  })

  it('narrows by person, by kind and to the acts worth a look', () => {
    const sam = filterActs(acts, { person: 'sam r.', kind: null, lookOnly: false })
    expect(sam).toHaveLength(4)
    expect(filterActs(acts, { person: 'sam r.', kind: 'taken', lookOnly: false })).toHaveLength(2)
    expect(filterActs(acts, { person: 'sam r.', kind: null, lookOnly: true }).map((a) => a.kind)).toEqual(['counted', 'taken'])
    expect(filterActs(acts, { person: null, kind: 'box_moved', lookOnly: false })).toHaveLength(1)
  })

  it('counts the presses, the days, the pieces that left, the boxes and the acts worth a look', () => {
    const sam = filterActs(acts, { person: 'sam r.', kind: null, lookOnly: false })
    expect(actTiles(sam)).toEqual({ presses: 4, days: 2, pieces: 46, boxes: 2, look: 2, markedPieces: 0, outside: 0 })
    expect(actTiles([])).toEqual({ presses: 0, days: 0, pieces: 0, boxes: 0, look: 0, markedPieces: 0, outside: 0 })
  })

  it('groups the acts by day, newest day first', () => {
    const days = actDays(filterActs(acts, { person: 'sam r.', kind: null, lookOnly: false }))
    expect(days.map((d) => [d.day, d.acts.length])).toEqual([['2026-11-18', 3], ['2026-11-17', 1]])
  })

  it('reads a time as the device’s own day, and nothing for a time that is not one', () => {
    expect(localDayOf('2026-11-18T12:00:00')).toBe('2026-11-18')
    expect(localDayOf('not a time')).toBe('')
  })

  it('names a press by its day and minute, so two a minute apart read apart, and nothing for a time that is not one', () => {
    const first = actStampWords('2026-11-19T13:25:00')
    const second = actStampWords('2026-11-19T13:26:00')
    expect(first).toContain('Nov 19')
    expect(first).toContain('1:25')
    expect(second).toContain('1:26')
    expect(first).not.toBe(second)
    expect(actStampWords('not a time')).toBe('')
  })
})

describe('the trail that is not the ledger', () => {
  const acts = sitePersonActs({
    jobs, movements: [], containerMoves: [], containers, places,
    boxChanges: [
      { id: 'c1', containerId: 'g22', what: 'retired', oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-18T19:50:00Z' },
      { id: 'c2', containerId: 'g22', what: 'brought_back', oldValue: '', newValue: '', byName: 'Dana K.', at: '2026-11-18T21:05:00Z' },
      { id: 'c3', containerId: 'g40', what: 'where', oldValue: '', newValue: 'by the north fence', byName: 'Sam R.', at: '2026-11-18T12:00:00Z' },
      { id: 'c4', containerId: 'gone', what: 'kind', oldValue: 'box', newValue: 'cage', byName: '', at: '2026-11-18T11:00:00Z' },
    ],
    boxRenames: [{ id: 'n1', containerId: 'g40', oldLabel: 'G4', newLabel: 'G40', byName: 'Sam R.', at: '2026-11-18T10:00:00Z' }],
    removedAnswers: [
      { id: 'r1', answer: 'price', jobId: 'j1', words: '2 PVC 90, $4.50', byName: 'Sam R.', at: '2026-11-18T09:00:00Z' },
      { id: 'r2', answer: 'tie', jobId: null, words: '2 PVC 90 and 2 inch 90', byName: 'Sam R.', at: '2026-11-18T08:00:00Z' },
    ],
  }, day)

  it('reads each change to a box with who made it, newest first', () => {
    expect(acts.map((a) => [a.what, a.who, a.where, a.note])).toEqual([
      ['Brought a box back', 'Dana K.', 'G22 · Arena', ''],
      ['Retired a box', 'Sam R.', 'G22 · Arena', ''],
      ['Changed a box', 'Sam R.', 'G40 · Arena', 'where: nothing → by the north fence'],
      ['Changed a box', 'No name on the row', 'a box no longer listed', 'kind: box → cage'],
      ['Renamed a box', 'Sam R.', 'G40 · Arena', 'G4 → G40'],
      ['Removed a price', 'Sam R.', '', ''],
      ['Undid a join', 'Sam R.', '', ''],
    ])
  })

  it('opens a box that is still listed, names the job, and wears no chip', () => {
    expect(acts[1]).toMatchObject({ kind: 'box_retired', boxId: 'g22', jobId: 'j1', jobLabel: 'J101 · Rough in', looks: [], pieces: 0, qty: '' })
    expect(acts[3]).toMatchObject({ boxId: null, jobId: '' })
    expect(acts[5]).toMatchObject({ kind: 'answer_removed', part: '2 PVC 90, $4.50', jobLabel: 'J101 · Rough in', boxIds: [] })
    expect(acts[6]).toMatchObject({ part: '2 PVC 90 and 2 inch 90', jobLabel: '' })
  })

  it('narrows to one kind of change', () => {
    expect(filterActs(acts, { person: null, kind: 'box_changed', lookOnly: false })).toHaveLength(2)
    expect(filterActs(acts, { person: 'sam r.', kind: 'answer_removed', lookOnly: false })).toHaveLength(2)
  })
})

describe('outsideProcess', () => {
  it('says why an act is outside a watched person’s process, and nothing when it is inside', () => {
    const why = (kind: Parameters<typeof outsideProcess>[0]['kind'], note = '') => outsideProcess({ kind, note })
    expect(why('taken', 'lodge kitchen')).toBeNull()
    expect(why('used', 'decon room')).toBeNull()
    expect(why('returned')).toBeNull()
    expect(why('moved')).toBeNull()
    expect(why('box_moved')).toBeNull()
    expect(why('cannot_find')).toBeNull()
    expect(why('damaged')).toBeNull()
    expect(why('taken')).toBe('no note')
    expect(why('used', '  ')).toBe('no note')
    expect(why('counted')).toBe('a count is the office’s')
    expect(why('delivered')).toBe('adding a part is the office’s')
    expect(why('box_retired')).toBe('retired a box')
    expect(why('box_brought_back')).toBe('brought a box back')
    expect(why('box_changed')).toBe('changed a box')
    expect(why('box_renamed')).toBe('renamed a box')
    expect(why('answer_removed')).toBe('took an answer off')
  })
})

describe('answers to a press', () => {
  const take = row({ reason: 'taken', qty: 16, from: 'g40', at: '2026-11-18T11:02:00Z', by: 'Sam R.' })
  const count = row({ reason: 'counted', qty: 12, from: 'g22', at: '2026-11-18T19:52:00Z', by: 'Sam R.' })
  const acts = sitePersonActs({
    jobs, movements: [take], containerMoves: [], containers, places,
    takenBack: [count, take],
    answers: [
      { id: 'a1', movementId: take.id, answer: 'marked', why: 'no note', byName: 'Dana K.', at: '2026-11-18T21:05:00Z' },
      { id: 'a2', movementId: count.id, answer: 'taken_back', why: 'counted without the office', byName: 'Dana K.', at: '2026-11-18T21:05:00Z' },
    ],
  }, day)

  it('keeps a marked press in the figures and carries its answer', () => {
    expect(acts[1]).toMatchObject({ kind: 'taken', pieces: 16, looks: ['no_note'], answer: { answer: 'marked', why: 'no note', byName: 'Dana K.' } })
    expect(actTiles(acts)).toMatchObject({ presses: 2, pieces: 16, markedPieces: 16, look: 1 })
  })

  it('draws a press taken back once, in no figure and with no chip', () => {
    expect(acts).toHaveLength(2)
    expect(acts[0]).toMatchObject({ kind: 'counted', qty: '12', pieces: 0, looks: [], where: 'G22 · Arena', answer: { answer: 'taken_back', why: 'counted without the office' } })
  })
})

describe('a watch', () => {
  const u = (id: string, m: Movement): Movement => ({ ...m, byUserId: id })
  const acts = sitePersonActs({
    jobs, containers, places,
    movements: [
      u('u-sam', row({ reason: 'delivered', qty: 40, to: 'g22', at: '2026-11-16T15:00:00Z', by: 'Sam R.', source: 'INV-1' })),
      u('u-sam', row({ reason: 'taken', qty: 10, from: 'g22', at: '2026-11-17T15:00:00Z', by: 'Sam R.', note: 'lodge' })),
      u('u-sam', row({ reason: 'taken', qty: 4, from: 'g22', at: '2026-11-18T11:00:00Z', by: 'Sam R.' })),
      u('u-dana', row({ reason: 'counted', qty: 26, from: 'g22', at: '2026-11-18T12:00:00Z', by: 'Dana K.' })),
    ],
    containerMoves: [{ id: 'cm1', jobId: 'j1', containerId: 'g40', fromLocationId: 'p1', toLocationId: 'p2', byName: 'Sam R.', at: '2026-11-18T10:48:00Z' }],
    boxChanges: [{ id: 'c1', containerId: 'g40', what: 'retired', oldValue: '', newValue: '', byName: 'sam r.', at: '2026-11-18T13:00:00Z' }],
  }, day)

  it('collects the logins behind a name', () => {
    expect(actPeople(acts).map((p) => [p.key, p.userIds])).toEqual([['sam r.', ['u-sam']], ['dana k.', ['u-dana']]])
  })

  it('says what is outside the process for the watched person alone, a box change by name included', () => {
    const watched = withWatch(acts, new Set(['u-sam']))
    expect(watched.map((a) => [a.who, a.kind, a.outside])).toEqual([
      ['sam r.', 'box_retired', 'retired a box'],
      ['Dana K.', 'counted', null],
      ['Sam R.', 'taken', 'no note'],
      ['Sam R.', 'box_moved', null],
      ['Sam R.', 'taken', null],
      ['Sam R.', 'delivered', 'adding a part is the office’s'],
    ])
    expect(actTiles(watched)).toMatchObject({ outside: 3, look: 3 })
    expect(filterActs(watched, { person: 'sam r.', kind: null, lookOnly: true })).toHaveLength(3)
  })

  it('changes nothing when nobody on the site is watched', () => {
    expect(withWatch(acts, new Set()).every((a) => a.outside === null)).toBe(true)
    expect(withWatch(acts, new Set(['u-other'])).every((a) => a.outside === null)).toBe(true)
  })

  it('lists the boxes opened since the watch began and never pressed on', () => {
    const sam = filterActs(acts, { person: 'sam r.', kind: null, lookOnly: false })
    const opens = [
      { containerId: 'b7', at: '2026-11-18T09:00:00Z' },
      { containerId: 'g22', at: '2026-11-18T09:30:00Z' },
      { containerId: 'b7', at: '2026-11-18T14:00:00Z' },
      { containerId: 'g9', at: '2026-11-17T08:00:00Z' },
    ]
    // G22 and G40 were pressed on after the watch began. G9 was opened before it.
    expect(openedNotPressed(opens, sam, '2026-11-18T00:00:00Z')).toEqual(['b7'])
    expect(openedNotPressed(opens, sam, '2026-11-17T00:00:00Z')).toEqual(['g9', 'b7'])
  })
})

describe('the way back from a box change', () => {
  const retired: Container = { ...box('r1', 'j1', 'R1', 'p1'), retiredAt: '2026-11-18T19:50:00Z' }
  const edited: Container = { ...box('e1', 'j1', 'E1', 'p1'), kind: 'cage', where: 'by the north fence', said: 'drain fittings' }
  const acts = sitePersonActs({
    jobs, movements: [], containerMoves: [], places,
    containers: [...containers, retired, edited],
    boxChanges: [
      { id: 'c1', containerId: 'r1', what: 'retired', oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-18T19:50:00Z' },
      { id: 'c2', containerId: 'g22', what: 'retired', oldValue: '', newValue: '', byName: 'Sam R.', at: '2026-11-17T10:00:00Z' },
      { id: 'c3', containerId: 'g22', what: 'brought_back', oldValue: '', newValue: '', byName: 'Dana K.', at: '2026-11-17T11:00:00Z' },
      { id: 'c4', containerId: 'e1', what: 'kind', oldValue: 'box', newValue: 'cage', byName: 'Sam R.', at: '2026-11-16T10:00:00Z' },
      { id: 'c5', containerId: 'e1', what: 'where', oldValue: '', newValue: 'by the north fence', byName: 'Sam R.', at: '2026-11-16T09:00:00Z' },
      { id: 'c6', containerId: 'e1', what: 'said', oldValue: 'fittings', newValue: 'drain fittings', byName: 'Sam R.', at: '2026-11-16T08:00:00Z' },
      { id: 'c7', containerId: 'e1', what: 'where', oldValue: 'inside', newValue: 'outside', byName: 'Sam R.', at: '2026-11-15T08:00:00Z' },
      { id: 'c8', containerId: 'r1', what: 'kind', oldValue: 'box', newValue: 'cage', byName: 'Sam R.', at: '2026-11-14T08:00:00Z' },
    ],
    boxRenames: [
      { id: 'n1', containerId: 'e1', oldLabel: 'E0', newLabel: 'E1', byName: 'Sam R.', at: '2026-11-13T08:00:00Z' },
      { id: 'n2', containerId: 'g22', oldLabel: 'G2', newLabel: 'G21', byName: 'Sam R.', at: '2026-11-12T08:00:00Z' },
    ],
  }, day)
  const back = (id: string) => acts.find((a) => a.id === id)?.putBack ?? null

  it('offers to bring back a box that is still retired, and to retire again a box that is still live', () => {
    expect(back('c1')).toEqual({ containerId: 'r1', act: 'unretire', words: 'Bring R1 back' })
    // G22 was retired and then brought back: the retire has nothing left to undo, the bring-back does.
    expect(back('c2')).toBeNull()
    expect(back('c3')).toEqual({ containerId: 'g22', act: 'retire', words: 'Retire G22 again' })
  })

  it('offers an edit back only while the box still reads as the edit left it', () => {
    expect(back('c4')).toEqual({ containerId: 'e1', act: 'patch', patch: { kind: 'box' }, words: 'Make E1 a box again' })
    expect(back('c5')).toEqual({ containerId: 'e1', act: 'patch', patch: { where: '' }, words: 'Put the where line of E1 back' })
    expect(back('c6')).toEqual({ containerId: 'e1', act: 'patch', patch: { said: 'fittings' }, words: 'Put the words on E1 back' })
    // The where line was changed again after this one, and a retired box takes no edit.
    expect(back('c7')).toBeNull()
    expect(back('c8')).toBeNull()
  })

  it('offers a rename back while the box still carries the new name', () => {
    expect(back('n1')).toEqual({ containerId: 'e1', act: 'patch', patch: { label: 'E0' }, words: 'Rename E1 back to E0' })
    expect(back('n2')).toBeNull()
  })
})
