import { describe, expect, it } from 'vitest'
import { lienNextActFor, type LienNextActFacts } from './lienNextAct'
import { buildLienTimeline, type LienTimelineInput } from './lienTimeline'
import { plainWordsFailures } from '../plainWords'

const facts = (over: Partial<LienNextActFacts> = {}): LienNextActFacts => ({ next: { kind: 'notice' }, waitingOn: { who: 'ours' }, noticeState: 'to_draft', missingKeys: [], paid: false, ...over })

describe('lienNextActFor — what pressing the band does (v2.7321)', () => {
  it('a notice that needs the owner opens the property record at the owner; a drafted one goes to the footer', () => {
    expect(lienNextActFor(facts({ noticeState: 'needs_owner' }))).toEqual({ kind: 'gate:owner', label: 'Find the owner ›' })
    expect(lienNextActFor(facts())).toEqual({ kind: 'footer', label: 'Send for approval ›' })
    expect(lienNextActFor(facts({ noticeState: 'awaiting' }))).toEqual({ kind: 'footer', label: 'Approve it ›' })
    expect(lienNextActFor(facts({ noticeState: 'ready' }))).toEqual({ kind: 'footer', label: 'Print and mail ›' })
    expect(lienNextActFor(facts({ noticeState: 'printed' }))).toEqual({ kind: 'footer', label: 'Enter mail numbers ›' })
    expect(lienNextActFor(facts({ noticeState: 'held' }))).toEqual({ kind: 'footer', label: 'Lift the hold ›' })
  })

  it('an affidavit held by a fact opens the one gate that holds it, in the gate rows’ order; counsel’s facts are not our move', () => {
    const aff = (missingKeys: LienNextActFacts['missingKeys']) => lienNextActFor(facts({ next: { kind: 'affidavit', affidavitState: 'needs_property' }, missingKeys }))
    expect(aff(['owner', 'legal', 'notice'])).toEqual({ kind: 'gate:owner', label: 'Find the owner ›' })
    expect(aff(['legal'])).toEqual({ kind: 'gate:legal', label: 'Fill in the legal description ›' })
    expect(aff(['contractor'])).toEqual({ kind: 'gate:contractor', label: 'Add the GC’s address ›' })
    expect(aff(['notice'])).toEqual({ kind: 'gate:notice', label: 'Send the notice first ›' })
    expect(aff(['homestead_answer'])).toEqual({ kind: 'gate:homestead', label: 'Answer the homestead question ›' })
    expect(aff(['public_owner'])).toEqual({ kind: 'none', waiting: 'counsel' })
    expect(aff(['homestead', 'owner'])).toEqual({ kind: 'none', waiting: 'counsel' })
  })

  it('the notice gate’s press says what the notice still needs: mailed when it is approved, sent first only when none was started', () => {
    const aff = (noticeStanding: LienNextActFacts['noticeStanding']) => lienNextActFor(facts({ next: { kind: 'affidavit', affidavitState: 'needs_property' }, missingKeys: ['notice'], noticeStanding }))
    expect(aff('approved')).toEqual({ kind: 'gate:notice', label: 'Mail the notice first ›' })
    expect(aff('printed')).toEqual({ kind: 'gate:notice', label: 'Mail the notice first ›' })
    expect(aff('awaiting')).toEqual({ kind: 'gate:notice', label: 'Open the notice ›' })
    expect(aff('to_send')).toEqual({ kind: 'gate:notice', label: 'Open the notice ›' })
    expect(aff('late')).toEqual({ kind: 'gate:notice', label: 'Send the notice first ›' })
    expect(aff(null)).toEqual({ kind: 'gate:notice', label: 'Send the notice first ›' })
    // A property fact still leads the notice, whatever the notice is doing.
    expect(lienNextActFor(facts({ next: { kind: 'affidavit', affidavitState: 'needs_property' }, missingKeys: ['legal', 'notice'], noticeStanding: 'approved' }))).toEqual({ kind: 'gate:legal', label: 'Fill in the legal description ›' })
  })

  it('an affidavit on the desk goes to the footer’s press for its step; filed, the copy and the release are the Lien window’s', () => {
    const aff = (affidavitState: NonNullable<LienNextActFacts['next']['affidavitState']>) => lienNextActFor(facts({ next: { kind: 'affidavit', affidavitState } }))
    expect(aff('to_draft')).toEqual({ kind: 'footer', label: 'Send for approval ›' })
    expect(aff('awaiting')).toEqual({ kind: 'footer', label: 'Approve it ›' })
    expect(aff('ready')).toEqual({ kind: 'footer', label: 'File it ›' })
    expect(aff('held')).toEqual({ kind: 'footer', label: 'Lift the hold ›' })
    expect(aff('')).toEqual({ kind: 'footer', label: 'Send for approval ›' })
    // A filed lien's copies: the band's press reads its stage's name (`lienServeStage.ts`).
    expect(lienNextActFor(facts({ next: { kind: 'serve' } }))).toEqual({ kind: 'serve', label: 'Print the copies to mail ›' })
    expect(lienNextActFor(facts({ next: { kind: 'serve' }, serveStage: 'record' }))).toEqual({ kind: 'serve', label: 'Enter mail numbers ›' })
    expect(lienNextActFor(facts({ next: { kind: 'release' } }))).toEqual({ kind: 'release', label: 'File the release ›' })
    expect(lienNextActFor(facts({ next: { kind: 'late_notice' } }))).toEqual({ kind: 'gate:notice', label: 'Send the late notice ›' })
    expect(lienNextActFor(facts({ next: { kind: 'retainage' } }))).toEqual({ kind: 'retainage', label: 'Send the retainage notice ›' })
  })

  it('not our move: the owner’s reply, counsel on the suit, nothing due — a tag or nothing, never a press', () => {
    expect(lienNextActFor(facts({ waitingOn: { who: 'owner' } }))).toEqual({ kind: 'none', waiting: 'owner' })
    expect(lienNextActFor(facts({ next: { kind: 'suit' }, waitingOn: { who: 'counsel' } }))).toEqual({ kind: 'none', waiting: 'counsel' })
    expect(lienNextActFor(facts({ next: { kind: 'none' }, waitingOn: null }))).toEqual({ kind: 'none', waiting: null })
    expect(lienNextActFor(facts({ next: { kind: 'lien_gone' } }))).toEqual({ kind: 'legal_desk', label: 'Open the Legal desk ›' })
    expect(lienNextActFor(facts({ next: { kind: 'lien_gone' }, paid: true }))).toEqual({ kind: 'none', waiting: null })
  })

  it('every label is plain words', () => {
    const labels = new Set<string>()
    const all: LienNextActFacts[] = [
      facts({ noticeState: 'needs_owner' }), facts(), facts({ noticeState: 'awaiting' }), facts({ noticeState: 'ready' }), facts({ noticeState: 'printed' }), facts({ noticeState: 'held' }),
      facts({ next: { kind: 'late_notice' } }), facts({ next: { kind: 'retainage' } }), facts({ next: { kind: 'serve' } }), facts({ next: { kind: 'release' } }), facts({ next: { kind: 'lien_gone' } }),
      ...(['owner', 'legal', 'contractor', 'notice', 'homestead_answer'] as const).map((k) => facts({ next: { kind: 'affidavit', affidavitState: 'needs_property' }, missingKeys: [k] })),
      ...(['to_draft', 'awaiting', 'ready', 'held'] as const).map((s) => facts({ next: { kind: 'affidavit', affidavitState: s } })),
    ]
    for (const f of all) {
      const act = lienNextActFor(f)
      if (act.kind !== 'none') labels.add(act.label)
    }
    expect(labels.size).toBeGreaterThan(10)
    for (const label of labels) {
      expect(label.endsWith(' ›')).toBe(true)
      expect(plainWordsFailures(label.replace(/ ›$/, '.'))).toEqual([])
    }
  })
})

describe('buildLienTimeline carries the act beside the words', () => {
  const base = (over: Partial<LienTimelineInput> = {}): LienTimelineInput => ({
    todayYmd: '2026-11-15',
    isSub: true,
    propertyKind: 'non_residential',
    lastMonth: '2026-09',
    lastMonthFromCreation: false,
    months: [{ key: '2026-09', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' }],
    noticeState: 'needs_owner',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
    ...over,
  })

  it('JP372’s shape: the owner missing on the Sep notice reads Find the owner, then send — and the act is the owner gate', () => {
    const t = buildLienTimeline(base())
    expect(t.next.words).toBe('Find the owner, then send the Sep notice — tomorrow.')
    expect(t.next.act).toEqual({ kind: 'gate:owner', label: 'Find the owner ›' })
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the owner’s name for the notice' })
  })

  it('an affidavit ready to file carries the footer act; a demand letter out to the owner carries none', () => {
    const ready = buildLienTimeline(base({ isSub: false, months: [], noticeState: '', affidavit: { deadline: '2027-01-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [], state: 'ready', missingKeys: [], holdUntil: null } }))
    expect(ready.next.kind).toBe('affidavit')
    expect(ready.next.act).toEqual({ kind: 'footer', label: 'File it ›' })
    const letter = buildLienTimeline(base({ demandLetters: [{ sentAt: '2026-11-10', deadlineDate: '2026-11-24', amount: 8940, openRemaining: 8940, debtorParty: 'owner' }] }))
    expect(letter.waitingOn?.who).toBe('owner')
    expect(letter.next.act).toEqual({ kind: 'none', waiting: 'owner' })
  })
})
