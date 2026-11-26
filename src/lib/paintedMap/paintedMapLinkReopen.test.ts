import { describe, expect, it } from 'vitest'
import { PAINTED_MAP_LINKS_ENDED_HEAD, PAINTED_MAP_LINK_REOPEN_PRESS, paintedMapLinkEndedWords, paintedMapLinkReopenConfirm, paintedMapLinkReopenDrawn, paintedMapLinkReopenProblem, paintedMapLinkReopenedWords, paintedMapLinksToReopen } from './paintedMapLinkReopen'
import type { PaintedMapLinkRow } from './paintedMapLink'

const NOW = '2026-11-26T03:00:00Z'
const link = (over: Partial<PaintedMapLinkRow>): PaintedMapLinkRow => ({ id: 'l1', made_at: '2026-11-20T16:00:00Z', expires_at: '2027-02-18T05:59:59Z', ended_at: '2026-11-25T18:00:00Z', open_count: 0, ...over })

describe('reopening an ended painted map link (punch list #443, row 14)', () => {
  it('is drawn for a dev and for nobody else', () => {
    expect(paintedMapLinkReopenDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, undefined]) expect(paintedMapLinkReopenDrawn(role)).toBe(false)
  })

  it('lists the ended links not past their day, newest ended first, and leaves open and expired ones out', () => {
    const rows = [
      link({ id: 'open', ended_at: null }),
      link({ id: 'old', ended_at: '2026-11-20T18:00:00Z' }),
      link({ id: 'new', ended_at: '2026-11-25T18:00:00Z' }),
      link({ id: 'past', ended_at: '2026-11-25T18:00:00Z', expires_at: '2026-11-25T05:59:59Z' }),
    ]
    expect(paintedMapLinksToReopen(rows, NOW).map((l) => l.id)).toEqual(['new', 'old'])
  })

  it('refuses, in the function’s own words, a live link, a link past its day and a real map’s link', () => {
    expect(paintedMapLinkReopenProblem(link({}), 'ZZ Test way in', NOW)).toBe('')
    expect(paintedMapLinkReopenProblem(link({ ended_at: null }), 'ZZ Test way in', NOW)).toBe('This link is still open.')
    expect(paintedMapLinkReopenProblem(link({ expires_at: '2026-11-25T05:59:59Z' }), 'ZZ Test way in', NOW)).toBe('This link is past its day. Make a new one.')
    expect(paintedMapLinkReopenProblem(link({}), 'The way in for deliveries', NOW)).toBe('Only a link of a test map can be reopened. The map’s name must start with ZZ.')
  })

  it('the confirm names the map and the act, the line says the days, and the words after say until when', () => {
    expect(paintedMapLinkReopenConfirm(link({}), 'ZZ Test way in')).toEqual({
      title: 'Reopen this ended link of ZZ Test way in?',
      message: 'The same address opens the map again, until Feb 17. Anyone who holds the old link can open it.',
      confirmLabel: 'Reopen the link',
    })
    expect(paintedMapLinkEndedWords(link({}))).toBe('Ended Nov 25. Would end on Feb 17.')
    expect(paintedMapLinkEndedWords(link({ ended_at: null }))).toBe('Ended. Would end on Feb 17.')
    expect(paintedMapLinkReopenedWords('2027-02-17')).toBe('The link is open again until Feb 17. Anyone who holds it can open the map.')
    expect(paintedMapLinkReopenedWords(null)).toBe('The link is open again. Anyone who holds it can open the map.')
    expect(PAINTED_MAP_LINK_REOPEN_PRESS).toBe('Reopen…')
    expect(PAINTED_MAP_LINKS_ENDED_HEAD).toBe('Ended links')
  })
})
