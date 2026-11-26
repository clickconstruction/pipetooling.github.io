import { describe, expect, it } from 'vitest'
import { PORTAL_LINK_DELETE_PRESS, PORTAL_LINK_DELETED_WORDS, portalLinkDeleteConfirm, portalLinkDeleteDrawn, portalLinkDeleteProblem, portalLinkNamedCounts, portalLinkNamedWords, type PortalLinkDeleteCandidate } from './portalLinkDelete'
import type { PortalTimelineEntry } from './portalLinkState'

const off = (over: Partial<PortalLinkDeleteCandidate> = {}): PortalLinkDeleteCandidate => ({ kind: 'link', linkId: 'l1', at: '2026-11-20T15:00:00Z', createdBy: null, audience: 'all', outcome: 'turned-off', revokedAt: '2026-11-21T15:00:00Z', ...over })

describe('deleting a turned-off portal link (punch list #443, row 11)', () => {
  it('is drawn for a dev and for nobody else', () => {
    expect(portalLinkDeleteDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, undefined]) expect(portalLinkDeleteDrawn(role)).toBe(false)
  })

  it('refuses, in a sentence, anything but a turned-off or rotated link of a test customer with an id', () => {
    expect(portalLinkDeleteProblem(off(), 'ZZ Test Portal Customer')).toBe('')
    expect(portalLinkDeleteProblem(off({ outcome: 'rotated' }), 'zz test lower')).toBe('')
    expect(portalLinkDeleteProblem(off({ outcome: 'active', revokedAt: null }), 'ZZ Test Portal Customer')).toBe('Turn this link off first. A live link is never deleted.')
    expect(portalLinkDeleteProblem(off({ revokedAt: null }), 'ZZ Test Portal Customer')).toBe('Turn this link off first. A live link is never deleted.')
    expect(portalLinkDeleteProblem(off(), 'Davenport Plumbing')).toBe('Only a test customer’s link can be deleted. The customer’s name must start with ZZ.')
    expect(portalLinkDeleteProblem(off(), 'ZZZ Corp')).toBe('')
    expect(portalLinkDeleteProblem(off({ linkId: null }), 'ZZ Test Portal Customer')).toBe('This link has no id to delete by. Read the window again.')
    const slug: PortalTimelineEntry = { kind: 'slug', at: '2026-11-20T15:00:00Z', createdBy: null, event: 'created', slug: 'zz-test' }
    expect(portalLinkDeleteProblem(slug, 'ZZ Test Portal Customer')).toBe('Only a link can be deleted.')
  })

  it('the confirm names the link and the customer, and its button names the act', () => {
    expect(portalLinkDeleteConfirm(off(), 'ZZ Test Portal Customer')).toEqual({
      title: 'Delete this turned-off link of ZZ Test Portal Customer?',
      message: 'It leaves the History for everyone, and it cannot be brought back. A link a GC proposal names stays.',
      confirmLabel: 'Delete the link',
    })
    expect(portalLinkDeleteConfirm(off({ audience: 'gc' }), 'ZZ Test GC').title).toBe('Delete this turned-off separate view (GC bills only) of ZZ Test GC?')
    expect(portalLinkDeleteConfirm(off({ audience: 'customer' }), 'ZZ Test GC').title).toBe('Delete this turned-off separate view (their own jobs) of ZZ Test GC?')
    expect(PORTAL_LINK_DELETE_PRESS).toBe('Delete…')
    expect(PORTAL_LINK_DELETED_WORDS).toBe('The turned-off link was deleted.')
  })

  it('a link a GC proposal names stays, in the function’s own sentence (punch list #443, finding 254)', () => {
    expect(portalLinkNamedWords(1)).toBe('1 GC proposal names this link. It stays.')
    expect(portalLinkNamedWords(3)).toBe('3 GC proposals name this link. It stays.')
    expect(portalLinkDeleteProblem(off(), 'ZZ Test Portal Customer', 1)).toBe('1 GC proposal names this link. It stays.')
    expect(portalLinkDeleteProblem(off(), 'ZZ Test Portal Customer', 0)).toBe('')
    // The older reasons come first: a real customer's link is refused for that, whatever names it.
    expect(portalLinkDeleteProblem(off(), 'Davenport Plumbing', 2)).toBe('Only a test customer’s link can be deleted. The customer’s name must start with ZZ.')
  })

  it('counts the proposals a link is named by, and skips a proposal that names none', () => {
    const counts = portalLinkNamedCounts([{ portal_link_id: 'l1' }, { portal_link_id: 'l2' }, { portal_link_id: 'l1' }, { portal_link_id: null }])
    expect([...counts]).toEqual([['l1', 2], ['l2', 1]])
    expect(portalLinkNamedCounts(null).size).toBe(0)
  })
})
