import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { COI_PORTAL_LIVE, coiAskLine, PAPER_EMAIL_WORDS, paperEmail, paperSendKey } from './paperEmail'
import { paperStep } from './paperSend'
import { pt, pWeekday } from './portalI18n'

const state = boardStateFromRows(clinicBoardRows())
const lonestar = state.partners.find((p) => p.id === 'lonestar')!
const BY = '2026-10-15'

describe('the email a send from Documents writes', () => {
  it('sends the master agreement to sign from its link, with the day and the office’s line', () => {
    const step = paperStep(state, lonestar, 'msa')!
    expect(paperEmail(state, lonestar, step, BY, '  Call me with questions.  ', 'en')).toEqual({
      how: 'sign',
      subject: 'Your master agreement with Click Construction',
      lines: [
        'Here is our master agreement. You sign it once, and it covers every job you do for us.',
        'After that, each job is a short statement of work.',
        `Please sign it by ${pWeekday('en', BY)}.`,
        'Call me with questions.',
      ],
      actionLabel: 'Read and sign',
    })
  })

  it('reminds them of the master agreement once it is out, in their language', () => {
    const out = { ...lonestar, msa: 'sent' as const, msaSentOn: '2026-10-01' }
    const step = paperStep(state, out, 'msa')!
    const en = paperEmail(state, out, step, BY, '', 'en')!
    expect([en.subject, en.lines[0]]).toEqual(['Reminder: Your master agreement with Click Construction', `Our master agreement is still waiting for your signature. Please sign it by ${pWeekday('en', BY)}.`])
    expect(paperEmail(state, out, step, BY, '', 'es')!.subject).toBe('Recordatorio: Su contrato maestro con Click Construction')
  })

  it('asks for the W-9 to fill in and sign from its link', () => {
    const step = paperStep(state, lonestar, 'w9')!
    expect(paperEmail(state, lonestar, step, BY, '', 'en')).toEqual({
      how: 'sign',
      subject: 'Your W-9 for Click Construction',
      lines: [`Please fill in and sign your W-9 by ${pWeekday('en', BY)}. We need it before we can pay you.`],
      actionLabel: 'Read and sign',
    })
  })

  it('asks for insurance by email and says to send it from the portal or reply, since the portal takes it (P5b-2)', () => {
    const hillside = state.partners.find((p) => p.id === 'hillside')!
    const none = paperEmail(state, hillside, paperStep(state, hillside, 'insurance')!, BY, '', 'en')!
    expect(none).toMatchObject({ how: 'email', kind: 'coi', projectId: null, subject: 'Your insurance certificate for Click Construction' })
    // Lonestar's open promise from the office counts as asked: this one is a reminder.
    expect(paperEmail(state, lonestar, paperStep(state, lonestar, 'insurance')!, BY, '', 'en')!.subject).toBe('Reminder: Your insurance certificate for Click Construction')
    expect(none.lines).toEqual([
      `Please send us your insurance certificate by ${pWeekday('en', BY)}. Nothing you do for us is covered until it comes.`,
      'Send it from your portal with the link below. Or reply to this email with it.',
    ])
    const running = { ...lonestar, coiExpires: '2026-10-20' }
    expect(paperEmail(state, running, paperStep(state, running, 'insurance')!, BY, '', 'es')!.lines).toEqual([
      `Por favor envíenos su certificado de seguro renovado a más tardar el ${pWeekday('es', BY)}.`,
      'Envíelo desde su portal con el enlace de abajo. O responda a este correo con él.',
    ])
  })

  it('names the portal only when the email carries the portal link, and says to reply otherwise (gc 2)', () => {
    expect(COI_PORTAL_LIVE).toBe(true)
    expect([coiAskLine('en', true), coiAskLine('en', false), coiAskLine('es', false)]).toEqual([
      'Send it from your portal with the link below. Or reply to this email with it.',
      'Reply to this email with the certificate.',
      'Responda a este correo con el certificado.',
    ])
  })

  it('reminds them of a statement of work since its sign screen is live (P2c-ii), and writes no email for a waiver', () => {
    const sow = { paper: 'sow' as const, docKey: 'sow-k1', mode: 'reminder' as const, verb: 'Remind them', title: '', sendLabel: '', dayWord: 'Sign by', history: '', promiseKind: 'sow' as const, what: '', projectId: 'p1', packageId: 'k1' }
    const project = state.projects.find((p) => p.id === 'p1')!
    const trade = project.packages.find((k) => k.id === 'k1')!.trade
    expect(paperEmail(state, lonestar, sow, BY, '', 'en')).toEqual({
      how: 'email',
      kind: 'sow',
      projectId: 'p1',
      subject: `Reminder: ${pt('en', 'mSowSubject', { trade, project: project.name })}`,
      lines: [`Your statement of work for ${trade} on ${project.name} is still waiting for your signature. Please sign it by ${pWeekday('en', BY)}.`, pt('en', 'mSowOpen')],
    })
    expect(paperEmail(state, lonestar, { ...sow, paper: 'waiver', docKey: 'waivers-k1', promiseKind: 'closeout' }, BY, '', 'en')).toBeNull()
  })

  it('keys each send by its own row, so a reminder is its own email', () => {
    expect(paperSendKey('send-1', 'msa')).toBe('send-1:msa')
  })

  it('has every line in English and in Spanish', () => {
    for (const [key, words] of Object.entries(PAPER_EMAIL_WORDS)) {
      expect(words.en.trim(), key).not.toBe('')
      expect(words.es.trim(), key).not.toBe('')
      expect(words.es, key).not.toBe(words.en)
    }
  })
})
