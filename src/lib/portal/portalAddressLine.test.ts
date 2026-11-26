import { describe, expect, it } from 'vitest'
import { portalAddressLine, portalAddressLineColor, portalAddressState, portalAddressTextColor } from './portalAddressLine'

describe('portalAddressState (#389, finding 180)', () => {
  it('is a suggestion while nothing was ever saved, saved once a row exists, locked once shared', () => {
    expect(portalAddressState({ saved: null, locked: false })).toBe('suggested')
    expect(portalAddressState({ saved: 'kestrin-contracting-x7kq', locked: false })).toBe('saved')
    expect(portalAddressState({ saved: 'kestrin-contracting-x7kq', locked: true })).toBe('locked')
  })
  it('a locked row with no saved address still reads locked, so the hero never offers to edit it', () => {
    expect(portalAddressState({ saved: null, locked: true })).toBe('locked')
  })
})

describe('portalAddressLine', () => {
  it('says the suggestion is not saved and what saves it', () => {
    expect(portalAddressLine('suggested')).toBe('Not saved yet. Copy link saves it.')
  })
  it('keeps the old line for a saved address that is not shared yet, and nothing once locked', () => {
    expect(portalAddressLine('saved')).toBe('Editable until first shared')
    expect(portalAddressLine('locked')).toBe('')
  })
  it('the suggestion reads as a notice in a muted address; a saved one reads faint under the box’s own colour', () => {
    expect(portalAddressLineColor('suggested')).toBe('var(--text-amber-700)')
    expect(portalAddressTextColor('suggested')).toBe('var(--text-muted)')
    expect(portalAddressLineColor('saved')).toBe('var(--text-faint)')
    expect(portalAddressTextColor('saved')).toBe('inherit')
    expect(portalAddressTextColor('locked')).toBe('inherit')
  })
})
