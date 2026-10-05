import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  partnerActivity,
  partnerById,
  partnerDocuments,
  paperStep,
  portalMessages,
  promisesToChase,
  type GcState,
  type Partner,
} from './gcModel'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

const step = (state: GcState, id: string, key: string) => paperStep(state, partner(state, id), key)
const docMeta = (state: GcState, id: string, key: string) =>
  partnerDocuments(state, partner(state, id)).groups.flatMap((g) => g.docs).find((d) => d.key === key)?.meta

describe('send a paper from the company window (the owner, 2026-10-04)', () => {
  it('each paper has one next step, named for what happens', () => {
    const state = initialGcState()
    // Bluebonnet's master agreement went Sep 30 and is not signed: remind them.
    expect(step(state, 'bluebonnet', 'msa')).toMatchObject({
      mode: 'reminder',
      verb: 'Remind them',
      dayWord: 'Sign by',
      history: 'First sent Sep 30, 2 days ago. This is the first reminder.',
    })
    // Hillside has none: send it to sign. A signed one has nothing to send.
    expect(step(state, 'hillside', 'msa')).toMatchObject({ mode: 'first', verb: 'Send to sign' })
    expect(step(state, 'pecanvalley', 'msa')).toBeNull()
    // Insurance that ran out, a missing W-9, an owed waiver, a drafted statement of work.
    expect(step(state, 'pecanvalley', 'insurance')).toMatchObject({ mode: 'first', verb: 'Ask for it', dayWord: 'Send by', title: 'Ask for the renewed insurance certificate' })
    expect(step(state, 'hillside', 'w9')).toMatchObject({ mode: 'first', verb: 'Ask for it', title: 'Ask for their W-9' })
    expect(step(state, 'pecanvalley', 'waivers-felec')).toMatchObject({ verb: 'Ask for the waiver', draws: [1], what: 'the unconditional lien waiver on draw 1' })
    expect(step(state, 'kendall', 'sow-dhvac')).toMatchObject({ mode: 'first', verb: 'Send to sign' })
    // Insurance good for months has nothing to send.
    expect(step(state, 'ironhorse', 'insurance')).toBeNull()
  })

  it('a reminder is an email in their inbox, a promise Follow up chases after its day, and a line on the row and in Activity', () => {
    let state = initialGcState()
    const chaseBefore = promisesToChase(state)
    state = gcReducer(state, { type: 'sendPaper', partnerId: 'bluebonnet', paper: 'msa', by: '2026-10-09', note: 'We want you on Boerne.' })
    const email = portalMessages(state, 'bluebonnet').find((m) => m.key === 'send:send-1')
    expect(email?.subject).toBe('Reminder: Your master agreement with Click Construction')
    expect(email?.lines.slice(0, 3)).toEqual([
      'Hello Wes,',
      'Our master agreement is still waiting for your signature. Please sign it by Fri Oct 9.',
      'We want you on Boerne.',
    ])
    expect(state.tradePromises?.find((p) => p.partnerId === 'bluebonnet' && p.kind === 'msa')).toMatchObject({ by: '2026-10-09', from: 'office', what: 'the signed master agreement' })
    // Not chased until its day passes.
    expect(promisesToChase(state)).toBe(chaseBefore)
    expect(docMeta(state, 'bluebonnet', 'msa')).toBe('Reminded today · sign by Fri Oct 9. Sent Sep 30. Nothing is awarded on paper until it is signed.')
    expect(partnerActivity(state, partner(state, 'bluebonnet'))[0]).toMatchObject({ text: 'We reminded them to sign the master agreement, by Fri Oct 9. "We want you on Boerne."' })
    // The second reminder says so.
    expect(step(state, 'bluebonnet', 'msa')?.history).toBe('First sent Sep 30, 2 days ago. Reminded once, last Oct 2.')
    // Signing keeps the promise.
    state = gcReducer(state, { type: 'tradeSignMsa', partnerId: 'bluebonnet' })
    expect(state.tradePromises?.find((p) => p.partnerId === 'bluebonnet' && p.kind === 'msa')?.keptOn).toBe(state.today)
    expect(step(state, 'bluebonnet', 'msa')).toBeNull()
  })

  it('a first master agreement goes out as the Contracts tab sends it, with no second email', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'sendPaper', partnerId: 'hillside', paper: 'msa', by: '2026-10-09', note: '' })
    expect(partner(state, 'hillside')).toMatchObject({ msa: 'sent', msaSentOn: state.today })
    const inbox = portalMessages(state, 'hillside').filter((m) => m.kind === 'msa')
    expect(inbox.map((m) => m.key)).toEqual(['msa'])
    expect(state.log[0]?.text).toBe('Sent Hillside Excavation the master agreement to sign by Fri Oct 9.')
    expect(step(state, 'hillside', 'msa')?.mode).toBe('reminder')
  })

  it('an ask goes out in Spanish to a company that reads Spanish', () => {
    let state = gcReducer(initialGcState(), { type: 'tradeSetLanguage', partnerId: 'pecanvalley', lang: 'es' })
    state = gcReducer(state, { type: 'sendPaper', partnerId: 'pecanvalley', paper: 'waiver', projectId: 'fairoaksd', packageId: 'felec', by: '2026-10-09', note: '' })
    const email = portalMessages(state, 'pecanvalley').find((m) => m.key === 'send:send-1')
    expect(email?.lines[1]).toMatch(/^Pagamos el pago 1 de Fair Oaks Shops, Building D\. Por favor firme la renuncia de gravamen incondicional a más tardar el /)
  })
})
