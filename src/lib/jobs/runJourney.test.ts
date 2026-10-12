import { describe, expect, it } from 'vitest'
import { runEnvelopeProblems, runEnvelopeSigned, runEnvelopeStage, runLaneOf, runStageLabels } from './runEnvelopeStage'
import { runJourney } from './runJourney'
import { runFootAction } from './runFootAction'
import { runChecklistRows, runChecklistWords } from './runChecklist'
import type { RunEnvelope } from './runEnvelopes'
import type { RunNotice, RunRecipient, RunSendMethod } from './lienDeskRun'

/** A notice with two recipients, signed unless told otherwise; the run's problems come from the real `runNoticeProblems`. */
function notice(itemId: string, jobNumber: string, over: Partial<RunNotice> = {}): RunNotice {
  const owner: RunRecipient = { key: 'owner', label: 'Owner of record', name: 'ATI Schertz Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '' }
  const gc: RunRecipient = { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '4303 Thousand Oaks Dr, San Antonio, TX 78217', email: 'ap@loberg.example', method: 'certified_mail', tracking: '' }
  return {
    itemId,
    jobId: `j-${jobNumber}`,
    kind: 'notice_53_056',
    label: `${jobNumber} · ATI Schertz`,
    jobNumber,
    months: ['2026-06'],
    amount: 33500,
    fields: { claimantName: 'Click', contactPerson: 'Robert Douglas', originalContractorName: 'Loberg Contracting' } as RunNotice['fields'],
    extras: {} as RunNotice['extras'],
    coverNote: null,
    coverLetter: null,
    recipients: [owner, gc],
    ownerUnconfirmed: false,
    signature: { mode: 'type', printedName: 'Robert Douglas', pngDataUrl: null, signedAtIso: '2026-10-09T19:14:00Z', recordId: 'L650-1', signedWords: 'Signed', auditLine: '', onDeviceOf: null } as unknown as RunNotice['signature'],
    ...over,
  }
}

function envelope(n: number, who: 'owner' | 'original_contractor', notices: RunNotice[], over: Partial<RunEnvelope> = {}): RunEnvelope {
  const r = notices[0]!.recipients.find((x) => x.key === who)!
  return { key: `${n}`, n, label: r.label, name: r.name, address: r.address, email: r.email, method: r.method, tracking: r.tracking, contents: notices.map((nt, i) => ({ notice: nt, recipient: nt.recipients.find((x) => x.key === who)!, noticeIndex: i, recipientIndex: who === 'owner' ? 0 : 1 })), ...over }
}

describe('an envelope’s stage (Run-1)', () => {
  it('lanes by method, and labels the mailed stage for the lane', () => {
    expect(runLaneOf('certified_mail')).toBe('certified')
    expect(runLaneOf('traceable_courier')).toBe('courier')
    expect(runLaneOf('hand')).toBe('hand')
    expect(runLaneOf('email')).toBe('email')
    expect(runStageLabels('hand').mailed).toBe('Handed over')
    expect(runStageLabels('email').mailed).toBe('Emailed')
    expect(runStageLabels('certified').mailed).toBe('Mailed')
  })

  it('an envelope that is built, checked and signed but not printed is open and waits on nothing', () => {
    const s = runEnvelopeStage(envelope(1, 'owner', [notice('a', '650')]), { printed: false })
    expect(s.lane).toBe('certified')
    expect(s.stages.map((x) => `${x.key}:${x.done ? 1 : 0}`)).toEqual(['built:1', 'checked:1', 'signed:1', 'printed:0', 'mailed:0', 'recorded:0'])
    expect(s.current).toBe('printed')
    expect(s.waiting).toBeNull()
    expect(s.glyph).toBe('open')
  })

  it('an unsigned notice makes the envelope wait, with the run’s own words; a drawn or pen signature does not', () => {
    const env = envelope(2, 'original_contractor', [notice('a', '650'), notice('b', '712', { signature: null })])
    expect(runEnvelopeSigned(env)).toBe(false)
    const s = runEnvelopeStage(env, { printed: false })
    expect(s.current).toBe('signed')
    expect(s.waiting).toMatch(/^Unsigned:/)
    expect(runEnvelopeProblems(env)).toHaveLength(1)
    // A builder that never looked (undefined) is not a hold.
    expect(runEnvelopeSigned(envelope(3, 'owner', [notice('c', '688', { signature: undefined })]))).toBe(true)
  })

  it('a recipient’s own problem belongs to its envelope only', () => {
    const n = notice('a', '650')
    n.recipients[0] = { ...n.recipients[0]!, address: '' }
    expect(runEnvelopeProblems(envelope(1, 'owner', [n], { address: '' }))).toEqual(['Owner of record: no mailing address'])
    expect(runEnvelopeProblems(envelope(2, 'original_contractor', [n]))).toEqual([])
    expect(runEnvelopeStage(envelope(1, 'owner', [n], { address: '' }), { printed: false }).current).toBe('checked')
  })

  it('printed seals it, a number postmarks it, recording records it, a delivery scan delivers it', () => {
    const base = envelope(1, 'owner', [notice('a', '650')])
    expect(runEnvelopeStage(base, { printed: true }).glyph).toBe('sealed')
    const numbered = runEnvelopeStage({ ...base, tracking: '9407 1118 9876 5432 1001' }, { printed: true })
    expect(numbered.glyph).toBe('postmarked')
    expect(numbered.current).toBe('recorded')
    const recorded = runEnvelopeStage({ ...base, tracking: '9407 1118 9876 5432 1001' }, { printed: true, recorded: true })
    expect(recorded.current).toBe('done')
    const delivered = runEnvelopeStage({ ...base, tracking: '9407 1118 9876 5432 1001' }, { printed: true, recorded: true, delivered: true })
    expect(delivered.glyph).toBe('delivered')
    expect(delivered.stages[delivered.stages.length - 1]!.key).toBe('delivered')
    // A number typed before printing does not count as mailed.
    expect(runEnvelopeStage({ ...base, tracking: '9407 1118 9876 5432 1001' }, { printed: false }).glyph).toBe('open')
  })

  it('a hand delivery is mailed once it names who took it; an email once the run records', () => {
    const hand = envelope(3, 'owner', [notice('c', '688')], { method: 'hand' as RunSendMethod, tracking: 'Dr. Harlan' })
    expect(runEnvelopeStage(hand, { printed: true }).current).toBe('recorded')
    const email = envelope(2, 'original_contractor', [notice('a', '650')], { method: 'email' as RunSendMethod })
    expect(runEnvelopeStage(email, { printed: false }).stages.find((s) => s.key === 'mailed')!.done).toBe(false)
    expect(runEnvelopeStage(email, { printed: false, recorded: true }).current).toBe('done')
  })
})

describe('the journey across the top (Run-1)', () => {
  const states = (printed: boolean) => [
    runEnvelopeStage(envelope(1, 'owner', [notice('a', '650'), notice('b', '712', { signature: null })]), { printed }),
    runEnvelopeStage(envelope(2, 'original_contractor', [notice('a', '650'), notice('b', '712', { signature: null })]), { printed }),
    runEnvelopeStage(envelope(3, 'owner', [notice('c', '688')], { method: 'hand' as RunSendMethod }), { printed }),
  ]

  it('six nodes with counts; the blocker sits on the Signed node and names the leader', () => {
    const j = runJourney(states(false), { leaderName: 'Robert' })
    expect(j.nodes.map((n) => `${n.key} ${n.count} ${n.state}`)).toEqual(['built 3 of 3 done', 'signed 1 of 3 blocked', 'sent 0 of 3 todo', 'mailed 0 of 3 todo', 'recorded 0 of 3 todo', 'delivered 0 of 3 todo'])
    expect(j.nodes[1]!.note).toBe('2 wait on Robert')
    expect(j.fillRatio).toBe(0)
  })

  it('once everyone has signed, Sent is the node that is now; the fill moves with the done nodes', () => {
    const signedStates = [runEnvelopeStage(envelope(1, 'owner', [notice('a', '650')]), { printed: false })]
    const j = runJourney(signedStates)
    expect(j.nodes[1]!.state).toBe('done')
    expect(j.nodes[2]!.state).toBe('now')
    expect(j.fillRatio).toBeCloseTo(1 / 5)
    const printedStates = [runEnvelopeStage({ ...envelope(1, 'owner', [notice('a', '650')]), tracking: '9407 1118 9876 5432 1001' }, { printed: true, recorded: true })]
    const done = runJourney(printedStates)
    expect(done.nodes.map((n) => n.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'now'])
    expect(done.fillRatio).toBeCloseTo(4 / 5)
  })

  it('an empty run has no now node and no fill', () => {
    const j = runJourney([])
    expect(j.total).toBe(0)
    expect(j.nodes.every((n) => n.state === 'todo')).toBe(true)
    expect(j.fillRatio).toBe(0)
  })
})

describe('the one button at the foot (Run-1)', () => {
  it('prints what can print and says who waits; records once numbers are in; waits while they are owed; closes when all are recorded', () => {
    const unsigned = notice('b', '712', { signature: null })
    const s1 = [runEnvelopeStage(envelope(1, 'owner', [notice('a', '650')]), { printed: false }), runEnvelopeStage(envelope(2, 'original_contractor', [unsigned]), { printed: false })]
    const print = runFootAction(s1, { leaderName: 'Robert' })
    expect(print.kind).toBe('print')
    expect(print.label).toBe('Print the packet · 1 envelope ▸')
    expect(print.line1).toBe('1 prints here · 1 waits on Robert')
    expect(print.line2).toContain('joins the next packet once Robert signs')
    const s2 = [runEnvelopeStage(envelope(1, 'owner', [notice('a', '650')]), { printed: true }), runEnvelopeStage(envelope(2, 'original_contractor', [unsigned]), { printed: false })]
    const wait = runFootAction(s2, { leaderName: 'Robert' })
    expect(wait.kind).toBe('wait')
    expect(wait.disabled).toBe(true)
    expect(wait.line1).toBe('1 envelope owes a number · 1 waits on Robert')
    const s3 = [runEnvelopeStage({ ...envelope(1, 'owner', [notice('a', '650')]), tracking: '9407 1118 9876 5432 1001' }, { printed: true }), runEnvelopeStage(envelope(3, 'owner', [notice('c', '688')]), { printed: true })]
    const record = runFootAction(s3)
    expect(record.kind).toBe('record')
    expect(record.label).toBe('Record the mailing · 1 (1 stays in the pile) ▸')
    expect(record.line1).toBe('1 ready to record · 1 still owes a number')
    const s4 = [runEnvelopeStage({ ...envelope(1, 'owner', [notice('a', '650')]), tracking: '9407 1118 9876 5432 1001' }, { printed: true, recorded: true })]
    expect(runFootAction(s4).kind).toBe('done')
    expect(runFootAction([]).kind).toBe('nothing')
    expect(runFootAction([runEnvelopeStage(envelope(2, 'original_contractor', [unsigned]), { printed: false })]).line1).toBe('Every envelope waits on the leader')
  })

  it('an email copy records without printing', () => {
    const s = [runEnvelopeStage(envelope(2, 'original_contractor', [notice('a', '650')], { method: 'email' as RunSendMethod }), { printed: false })]
    expect(runFootAction(s).kind).toBe('record')
  })
})

describe('the checklist, live (Run-1)', () => {
  it('one row per printed paper envelope with the lane’s boxes and placeholder; email has no row; nothing before the print', () => {
    const envs = [
      envelope(1, 'owner', [notice('a', '650'), notice('b', '712')]),
      envelope(2, 'original_contractor', [notice('a', '650')], { method: 'email' as RunSendMethod }),
      envelope(3, 'owner', [notice('c', '688')], { method: 'hand' as RunSendMethod, tracking: 'Dr. Harlan' }),
    ]
    expect(runChecklistRows(envs, false)).toEqual([])
    const rows = runChecklistRows(envs, true)
    expect(rows.map((r) => r.n)).toEqual([1, 3])
    expect(rows[0]!.inside).toBe('650 owner, 712 owner')
    expect(rows[0]!.boxes).toEqual(['stuffed', 'slip on', 'mailed'])
    expect(rows[0]!.placeholder).toBe('9407 1118 …')
    expect(rows[0]!.done).toBe(false)
    expect(rows[1]!.boxes).toEqual(['stuffed', 'in the truck', 'handed over'])
    expect(rows[1]!.placeholder).toBe('who signed for it')
    expect(rows[1]!.done).toBe(true)
    expect(runChecklistWords(rows)).toBe('1 of 2 has their number')
    expect(runChecklistWords(rows.map(() => ({ done: true })))).toBe('Every envelope has its number')
    expect(runChecklistWords([{ done: true }])).toBe('The envelope has its number')
    expect(runChecklistWords([])).toBe('')
  })
})
