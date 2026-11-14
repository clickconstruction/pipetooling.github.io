import { describe, expect, it } from 'vitest'
import type { Container } from './onSite'
import { BOX_NAME_MAX, BOX_WHERE_MAX, boxDraftOf, boxKindWords, cleanBoxName, editBoxPressLabel, editBoxTitle, editBoxVerdict, editedBoxWords, renameLabelNote } from './editBox'

const box = (over: Partial<Container> = {}): Container => ({ id: 'c1', jobId: 'j1', label: 'R70 NO CONTAINER', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00Z', ...over })

describe('editBoxVerdict', () => {
  const site = [box(), box({ id: 'c2', label: 'R71' }), box({ id: 'c3', label: 'R72', retiredAt: '2026-11-02T12:00:00Z' }), box({ id: 'c4', jobId: 'j2', label: 'R73' }), box({ id: 'u', label: 'Unsorted', kind: 'unsorted' })]

  it('saves only what changed', () => {
    expect(editBoxVerdict(site, 'c1', { label: 'r70', kind: 'cage', where: '' })).toEqual({ ok: true, patch: { label: 'R70' }, renamed: true })
    expect(editBoxVerdict(site, 'c1', { label: 'R70 NO CONTAINER', kind: 'loose', where: '' })).toEqual({ ok: true, patch: { kind: 'loose' }, renamed: false })
    expect(editBoxVerdict(site, 'c1', { label: ' r70 ', kind: 'loose', where: '  on a pallet   by the door ' })).toEqual({ ok: true, patch: { label: 'R70', kind: 'loose', where: 'on a pallet by the door' }, renamed: true })
  })

  it('is quiet when nothing changed', () => {
    expect(editBoxVerdict(site, 'c1', boxDraftOf(site[0]!))).toEqual({ ok: false, reason: 'same', words: '' })
    expect(editBoxVerdict(site, 'c1', { label: ' r70 no  container ', kind: 'cage', where: ' ' })).toMatchObject({ ok: false, reason: 'same' })
  })

  it('refuses a name a live box of the job carries, whatever its capitals', () => {
    expect(editBoxVerdict(site, 'c1', { label: 'r71', kind: 'cage', where: '' })).toEqual({ ok: false, reason: 'taken', words: 'R71 is already on this job. Pick another name.' })
  })

  it('lets a retired box’s name and another job’s name be taken', () => {
    expect(editBoxVerdict(site, 'c1', { label: 'R72', kind: 'cage', where: '' })).toMatchObject({ ok: true, patch: { label: 'R72' } })
    expect(editBoxVerdict(site, 'c1', { label: 'R73', kind: 'cage', where: '' })).toMatchObject({ ok: true, patch: { label: 'R73' } })
  })

  it('holds the database’s own limits', () => {
    expect(editBoxVerdict(site, 'c1', { label: '  ', kind: 'cage', where: '' })).toMatchObject({ ok: false, reason: 'no-name', words: 'Give it a name.' })
    expect(editBoxVerdict(site, 'c1', { label: 'X'.repeat(BOX_NAME_MAX), kind: 'cage', where: '' })).toMatchObject({ ok: true })
    expect(editBoxVerdict(site, 'c1', { label: 'X'.repeat(BOX_NAME_MAX + 1), kind: 'cage', where: '' })).toEqual({ ok: false, reason: 'long-name', words: 'A name holds 24 characters. This one is 25.' })
    expect(editBoxVerdict(site, 'c1', { label: 'R70', kind: 'cage', where: 'y'.repeat(BOX_WHERE_MAX + 1) })).toEqual({ ok: false, reason: 'long-where', words: 'The where line holds 120 characters. This one is 121.' })
  })

  it('never changes Unsorted, a retired box or a box that is not there', () => {
    expect(editBoxVerdict(site, 'u', { label: 'R90', kind: 'box', where: '' })).toMatchObject({ ok: false, reason: 'unsorted' })
    expect(editBoxVerdict(site, 'c3', { label: 'R90', kind: 'cage', where: '' })).toEqual({ ok: false, reason: 'retired', words: 'R72 is retired. Bring it back first.' })
    expect(editBoxVerdict(site, 'nope', { label: 'R90', kind: 'cage', where: '' })).toMatchObject({ ok: false, reason: 'gone' })
  })

  it('never saves Unsorted as a kind', () => {
    expect(editBoxVerdict(site, 'c1', { label: 'R70 NO CONTAINER', kind: 'unsorted', where: '' })).toMatchObject({ ok: false, reason: 'same' })
  })
})

describe('the words', () => {
  it('names the act on the press', () => {
    expect(editBoxPressLabel(box(), { label: 'r70', kind: 'cage', where: '' })).toBe('Rename to R70')
    expect(editBoxPressLabel(box(), { label: 'R70 NO CONTAINER', kind: 'loose', where: '' })).toBe('Save R70 NO CONTAINER')
    expect(editBoxPressLabel(box(), { label: ' ', kind: 'cage', where: '' })).toBe('Save')
  })

  it('says what a rename does to a label already stuck on', () => {
    expect(renameLabelNote(box())).toBe('A label printed as R70 NO CONTAINER still opens this box. Print it again to show the new name.')
    expect(editedBoxWords(box(), { label: 'R70', kind: 'loose' })).toBe('R70 NO CONTAINER is now R70. Its printed label still opens it.')
  })

  it('says the kind or just that it saved', () => {
    expect(editedBoxWords(box({ label: 'R70' }), { kind: 'loose' })).toBe('R70 is a loose pile now.')
    expect(editedBoxWords(box({ label: 'R70' }), { where: 'by the door' })).toBe('R70 saved.')
  })

  it('titles the sheet and words the kinds', () => {
    expect(editBoxTitle(box({ label: 'R70' }))).toBe('Edit R70')
    expect((['cage', 'box', 'loose'] as const).map(boxKindWords)).toEqual(['Cage', 'Box', 'Loose pile'])
    expect(cleanBoxName('  r70   toilets ')).toBe('R70 TOILETS')
  })
})
