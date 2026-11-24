import { describe, expect, it } from 'vitest'
import { affidavitGates } from './lienDeskAffidavits'
import { LIEN_GATE_MARK_SLOTS, lienGateMarks } from './lienGateMarks'
import { LIEN_GATE_LANDING_BREATH_PX, lienGateLanding, lienGateLandingScrollTop, type LienGateLandingView } from './lienGateLanding'

const row = (key: string, ok: boolean, pressable = true) => ({ key, ok, pressable })

describe('the gate a row press lands on (punch list #364)', () => {
  it('is the first gate not clear, in the order the pane lists them', () => {
    expect(lienGateLanding([row('owner', true), row('legal', true), row('contractor', false), row('notice', false), row('homestead', true)])).toEqual({ key: 'contractor', focus: true })
    expect(lienGateLanding([row('owner', false), row('legal', false), row('contractor', true), row('notice', true), row('homestead', false)])).toEqual({ key: 'owner', focus: true })
  })

  it('is nothing when every gate is clear, so the row opens as it always did', () => {
    expect(lienGateLanding([row('owner', true), row('legal', true), row('contractor', true), row('notice', true), row('homestead', true)])).toBeNull()
    expect(lienGateLanding([])).toBeNull()
  })

  it('brings a gate with no door into view and leaves the keyboard where it was', () => {
    expect(lienGateLanding([row('owner', true), row('legal', true), row('contractor', false, false), row('notice', true), row('homestead', true)])).toEqual({ key: 'contractor', focus: false })
  })

  it('reads the gates in the order of the row’s marks: the first red mark is the gate landed on', () => {
    const gates = affidavitGates({ is_sub: true, noticed: false, has_owner: true, has_legal: true, homestead: false, has_contractor_address: false, owner_public: false, property_kind: 'non_residential' })
    const marks = lienGateMarks(gates, true)
    expect(marks.map((m) => m.slot)).toEqual([...LIEN_GATE_MARK_SLOTS])
    const firstRed = marks.find((m) => m.state === 'open')
    const landing = lienGateLanding(gates.map((g) => ({ key: g.key, ok: g.ok, pressable: true })))
    expect(firstRed?.slot).toBe('contractor')
    expect(landing?.key).toBe('contractor')
  })
})

describe('how far the pane scrolls to show the gate (punch list #364)', () => {
  // A computer's pane: 600 px tall, the path and gates heads pinned over the section (48), three heads to come under it (72).
  const desk: LienGateLandingView = { rowTop: 300, rowHeight: 24, scrollTop: 0, viewHeight: 600, topInset: 48, bottomInset: 72, sectionTop: 200 }

  it('stays put when the row is already clear of the pinned heads', () => {
    expect(lienGateLandingScrollTop(desk)).toBeNull()
    // Flush against the head over it and against the head under it both count as on the screen.
    expect(lienGateLandingScrollTop({ ...desk, scrollTop: 252 })).toBeNull()
    expect(lienGateLandingScrollTop({ ...desk, rowTop: 504 })).toBeNull()
  })

  it('lands the gates section under its own head when the row is under the heads to come', () => {
    expect(lienGateLandingScrollTop({ ...desk, rowTop: 520, sectionTop: 420 })).toBe(420)
  })

  it('lands the section when the pane has scrolled past the row', () => {
    expect(lienGateLandingScrollTop({ ...desk, scrollTop: 900 })).toBe(200)
  })

  it('on a phone, where the gates open a scroll under the path, lands the section under the one pinned head', () => {
    const phone: LienGateLandingView = { rowTop: 640, rowHeight: 44, scrollTop: 0, viewHeight: 420, topInset: 40, bottomInset: 0, sectionTop: 520 }
    expect(lienGateLandingScrollTop(phone)).toBe(520)
  })

  it('lands the row itself under the head when the section is taller than the window', () => {
    const tall: LienGateLandingView = { rowTop: 900, rowHeight: 44, scrollTop: 0, viewHeight: 300, topInset: 40, bottomInset: 0, sectionTop: 520 }
    expect(lienGateLandingScrollTop(tall)).toBe(900 - 40 - LIEN_GATE_LANDING_BREATH_PX)
  })

  it('moves nothing on a page with no layout', () => {
    expect(lienGateLandingScrollTop({ ...desk, viewHeight: 0, rowTop: 5000 })).toBeNull()
  })
})
