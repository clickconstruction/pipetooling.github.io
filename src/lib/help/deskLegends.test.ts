/**
 * Every desk's legend (punch list #187, PR 3) held in one place: each row in plain words and never a
 * command, the guide on the registry under the title the card prints, the rows a width shows, the
 * door's address and the pressed key. A new desk's legend joins `DESK_LEGENDS` here.
 */
import { describe, expect, it } from 'vitest'
import { HELP_GUIDES } from '../helpGuideRegistry'
import { LIEN_DESK_LEGEND } from '../jobs/lienDeskLegend'
import { JOB_WINDOW_LEGEND } from '../jobs/jobWindowLegend'
import { LEGAL_DESK_LEGEND } from '../legal/legalDeskLegend'
import { BANK_PAYMENTS_LEGEND } from '../jobs/bankPaymentsLegend'
import { PROJECT_BOARD_LEGEND } from '../gc/projectBoardLegend'
import { SUBS_BOARD_LEGEND } from '../prospects/subsBoardLegend'
import { allStationLegends, stationLegend } from '../quickfill/stationLegend'
import { QUICKFILL_SECTIONS } from '../quickfill/sections'
import { deskLegendFailures, legendGuideHref, legendOpenedTarget, legendRowsFor, type DeskLegend } from './deskLegend'
import { legendPressedPrefix } from './legendPressed'

export const DESK_LEGENDS: DeskLegend[] = [LIEN_DESK_LEGEND, JOB_WINDOW_LEGEND, LEGAL_DESK_LEGEND, BANK_PAYMENTS_LEGEND, PROJECT_BOARD_LEGEND, SUBS_BOARD_LEGEND, ...allStationLegends()]

const guides = new Map(HELP_GUIDES.map((g) => [g.slug, g.title]))

describe('the desks’ legends', () => {
  for (const legend of DESK_LEGENDS) {
    it(`${legend.key}: plain words, no commands, a guide on the registry`, () => {
      expect(deskLegendFailures(legend, guides)).toEqual([])
      expect(new Set(legend.rows.map((r) => r.key)).size).toBe(legend.rows.length)
    })
  }

  it('refuses a long row, a command, an empty label and a renamed guide', () => {
    const bad: DeskLegend = {
      key: 'Bad Key',
      label: 'x',
      rows: [
        { key: 'a', label: '', note: 'Press the button to open the thing and then do the next thing and the one after that too, every single time.' },
        { key: 'b', label: 'B', note: 'Open the estimate.' },
      ],
      guide: { slug: 'job-window-tabs', title: 'not its title' },
    }
    const f = deskLegendFailures(bad, guides)
    expect(f.some((x) => x.includes('lowercase slug'))).toBe(true)
    expect(f.some((x) => x.includes('no label'))).toBe(true)
    expect(f.some((x) => x.includes('over 20'))).toBe(true)
    expect(f.filter((x) => x.includes('opens on a command'))).toHaveLength(2)
    expect(f.some((x) => x.includes('not "not its title"'))).toBe(true)
    expect(deskLegendFailures({ ...bad, key: 'ok', guide: { slug: 'no-such-guide', title: 'x' } }, guides).some((x) => x.includes('no guide at no-such-guide'))).toBe(true)
  })

  it('the job window shows the icons on a desk and the bar on a phone', () => {
    expect(legendRowsFor(JOB_WINDOW_LEGEND, false).map((r) => r.key)).toEqual(['job', 'edit', 'bill', 'costs', 'history', 'documents', 'icons'])
    expect(legendRowsFor(JOB_WINDOW_LEGEND, true).map((r) => r.key)).toEqual(['job', 'edit', 'bill', 'costs', 'history', 'documents', 'bar'])
    expect(legendRowsFor(LIEN_DESK_LEGEND, true)).toHaveLength(7)
  })

  it('the door names the legend as its door, the press row names the desk, and the pressed key the person', () => {
    expect(legendGuideHref(LIEN_DESK_LEGEND)).toBe('/help?g=send-lien-notices-from-the-lien-desk&via=legend')
    expect(legendOpenedTarget('lien-desk')).toBe('#lien-desk')
    expect(legendPressedPrefix('lien-desk')).toBe('helpLegendPressed:lien-desk:')
  })

  it('every Quickfill station has a legend, its own guide where it has one, and one shared dot', () => {
    expect(allStationLegends()).toHaveLength(QUICKFILL_SECTIONS.length)
    expect(stationLegend('percent-complete').guide.slug).toBe('fix-a-jobs-percent-done-in-quickfill')
    expect(stationLegend('warnings').guide.slug).toBe('quickfill')
    expect(stationLegend('warnings').label).toBe('What this station holds: Warnings')
  })
})
