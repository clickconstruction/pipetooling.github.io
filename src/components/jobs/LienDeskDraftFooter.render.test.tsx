// @vitest-environment jsdom
/**
 * The draft footer on its own (v2.7594): the blocked row's way to its gate, the office's Send for approval, and the
 * leader's Sign and approve, whose order of writes is pinned here. Inside the desk it is held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LienDeskDraftFooter, type LienDraftFooterContext } from './LienDeskDraftFooter'

const writes = vi.hoisted(() => [] as string[])
vi.mock('../../lib/jobs/lienPayOfferIo', () => ({
  setLienDeskItemOffer: (id: string, offer: unknown) => {
    writes.push(`offer:${id}:${offer == null ? 'none' : 'set'}`)
    return Promise.resolve()
  },
}))

const ctx = (over: Partial<LienDraftFooterContext> = {}): LienDraftFooterContext =>
  ({
    selected: { jobId: 'job-1', pile: 'to_draft', policy: 'ask', item: null, sentItem: null, dueMonths: ['2026-10'], missedMonths: [] },
    monthsList: ['2026-10'],
    todayYmd: '2026-11-17',
    authRole: 'assistant',
    authName: 'ZZ Test Office',
    leader: false,
    office: true,
    otherScreen: false,
    busy: false,
    run: async (_label: string, fn: () => Promise<void>) => {
      await fn()
      return true
    },
    leaderName: 'ZZ Test Leader',
    gc: { name: 'ZZ Test Builder' },
    promise: null,
    claimGate: null,
    wordOpen: false,
    setWordOpen: vi.fn(),
    wordNote: '',
    setWordNote: vi.fn(),
    wordChannel: 'phone',
    setWordChannel: vi.fn(),
    wordPreview: undefined,
    offerProblem: null,
    offerBox: () => <div data-test-offer-box />,
    offerSwitch: () => <span data-test-offer-switch />,
    byHandPane: null,
    penPane: null,
    sendOnWord: vi.fn(),
    setByHandOpen: vi.fn(),
    setPenOpen: vi.fn(),
    ready: true,
    readiness: { ready: true, reason: null },
    gates: [],
    pickGate: vi.fn(),
    paneRef: { current: null },
    askReason: null,
    ruleLive: false,
    offer: null,
    draftSignWay: 'type',
    setSignWay: vi.fn(),
    codeReady: false,
    signRef: { current: null },
    draftSignLine: () => <div data-test-draft-sign-line />,
    draftFields: () => ({ notice: {} }),
    ensureDraft: vi.fn(async () => {
      writes.push('ensureDraft')
      return 'draft-1'
    }),
    draftSave: 'idle',
    signItem: vi.fn(async (id: string, _fields: unknown, approveToo: boolean) => {
      writes.push(`signItem:${id}:${approveToo ? 'approve' : 'sign'}`)
    }),
    sendToLeader: vi.fn(() => {
      writes.push('sendToLeader')
    }),
    setPenDraft: vi.fn(),
    first: null,
    lt: undefined,
    courtesyUnrecordedBand: null,
    courtesyDoor: null,
    letterTwoDoor: null,
    ...over,
  }) as unknown as LienDraftFooterContext

afterEach(() => {
  cleanup()
  writes.length = 0
})

describe('LienDeskDraftFooter', () => {
  it('blocked, the one press goes to the gate that blocks', () => {
    const c = ctx({ ready: false, readiness: { ready: false, reason: 'no_owner' } as never, gates: [{ key: 'owner', n: 1, tone: 'blocker', label: 'Owner', value: 'missing', title: '' }] as never })
    render(<LienDeskDraftFooter ctx={c} />)
    expect(document.querySelector('[data-lien-desk-next]')?.getAttribute('data-blocked')).toBe('yes')
    expect(document.querySelector('[data-lien-desk-ask], [data-lien-desk-approve]')).toBeNull()
    const go = document.querySelector('[data-lien-desk-go-to-gate]') as HTMLButtonElement
    expect(go.textContent).toContain('Go to gate 1')
    expect(document.querySelector('.lienFootState')?.textContent).toContain('Enter the owner of record')
    fireEvent.click(go)
    expect(c.pickGate).toHaveBeenCalledWith('owner')
  })

  it('open, the office’s press sends the draft to the leader and writes nothing itself', () => {
    const c = ctx()
    render(<LienDeskDraftFooter ctx={c} />)
    expect(document.querySelector('[data-lien-desk-next]')?.getAttribute('data-blocked')).toBe('no')
    // With no rule and no reason to ask, the why names the GC (the words a missed prop once broke).
    expect(document.querySelector('.lienFootWhy')?.textContent).toContain('no standing rule for ZZ Test Builder')
    fireEvent.click(document.querySelector('[data-lien-desk-ask]') as HTMLButtonElement)
    expect(writes).toEqual(['sendToLeader'])
  })

  it('the leader’s Sign and approve saves the draft, saves the offer, then signs with the approval, and never sends for approval', async () => {
    const c = ctx({ leader: true, office: false, authRole: 'master_technician' })
    render(<LienDeskDraftFooter ctx={c} />)
    expect(document.querySelector('[data-test-offer-box]')).not.toBeNull()
    fireEvent.click(document.querySelector('[data-lien-desk-approve]') as HTMLButtonElement)
    await vi.waitFor(() => expect(writes).toHaveLength(3))
    expect(writes).toEqual(['ensureDraft', 'offer:draft-1:none', 'signItem:draft-1:approve'])
    expect(c.sendToLeader).not.toHaveBeenCalled()
  })

  it('a pay offer whose day cannot stand deadens the leader’s press', () => {
    render(<LienDeskDraftFooter ctx={ctx({ leader: true, office: false, authRole: 'master_technician', offerProblem: 'The day is past the affidavit’s.' })} />)
    expect((document.querySelector('[data-lien-desk-approve]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says the autosave’s word beside the state', () => {
    render(<LienDeskDraftFooter ctx={ctx({ draftSave: 'saved' })} />)
    expect(document.querySelector('[data-lien-desk-saved="saved"]')?.textContent).toContain('Saved')
  })

  it('an open by-hand record stands in for the row', () => {
    render(<LienDeskDraftFooter ctx={ctx({ byHandPane: <div data-test-by-hand /> })} />)
    expect(document.querySelector('[data-test-by-hand]')).not.toBeNull()
    expect(document.querySelector('[data-lien-desk-next]')).toBeNull()
  })
})
