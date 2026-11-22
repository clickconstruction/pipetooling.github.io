import { describe, expect, it } from 'vitest'
import { CHART_PANEL_DESK, CHART_PANEL_PHONE, chartPanelFrame, fixedTrackFloorPx } from './chartPanelFrame'

describe('chartPanelFrame', () => {
  it('keeps the desk frame as it was: two columns over two, and a four-column sources table', () => {
    expect(chartPanelFrame(false)).toBe(CHART_PANEL_DESK)
    expect(CHART_PANEL_DESK).toEqual({
      section: 'minmax(0, 2fr) minmax(260px, 1fr)',
      foot: 'minmax(0, 1fr) minmax(0, 1.2fr)',
      sources: '90px minmax(0, 1.1fr) minmax(0, 1fr) auto',
      stacked: false,
    })
  })

  it('cuts every grid to one column on a phone, with a source stacked under its name and door', () => {
    expect(chartPanelFrame(true)).toBe(CHART_PANEL_PHONE)
    expect(CHART_PANEL_PHONE.section).toBe('minmax(0, 1fr)')
    expect(CHART_PANEL_PHONE.foot).toBe('minmax(0, 1fr)')
    expect(CHART_PANEL_PHONE.sources).toBe('minmax(0, 1fr) auto')
    expect(CHART_PANEL_PHONE.stacked).toBe(true)
  })

  it('asks for no fixed width on a phone, where the desk frame asks for more than a phone has to give', () => {
    // A 375 px phone leaves the panel 323 px inside its border and padding.
    expect(fixedTrackFloorPx(CHART_PANEL_DESK.section)).toBe(260)
    expect(fixedTrackFloorPx(CHART_PANEL_DESK.sources)).toBe(90)
    for (const template of [CHART_PANEL_PHONE.section, CHART_PANEL_PHONE.foot, CHART_PANEL_PHONE.sources]) expect(fixedTrackFloorPx(template)).toBe(0)
  })
})
