import { describe, expect, it } from 'vitest'
import { BILL, ELENA_STEPS, GREG, JONAH, MARCUS_STEPS, PRIYA_STEPS, TOM, TRADE_PAGES } from '../portal/portalTestPeople'
import { customerWhere, portalPage, portalStep, type PortalPage, type PortalStepIn } from './portalPage'

const section = (page: PortalPage, title: string) => page.sections.find((s) => s.title === title)
const row = (page: PortalPage, title: string, id: string) => section(page, title)?.rows.find((r) => r.id === id)

const step = (over: Partial<PortalStepIn>): PortalStepIn => ({ id: 'x', name: { en: 'A step', es: 'Un paso' }, who: 'them', where: 'now', ...over })

describe("a trade partner's first page", () => {
  it("reads Greg's: the certificate that ran out, the late quote, the draw with its month", () => {
    const page = portalPage('en', GREG)
    expect(page.title).toBe('Where you are with Click Construction')
    expect(page.off).toBeNull()
    expect(page.questions).toBe('Questions: text or call (210) 555-0100.')
    expect(page.sections.map((s) => s.title)).toEqual(['Getting set up', 'Boerne Retail Shell', 'Stone Oak Pharmacy'])
    expect(section(page, 'Getting set up')?.rows).toEqual([
      { id: 'invited', name: 'Invited', kind: 'done', when: 'Tue Sep 8' },
      { id: 'portal', name: 'Portal opened', kind: 'done', when: 'Wed Sep 9' },
      {
        id: 'papers',
        name: 'Papers in',
        kind: 'ranOut',
        line: 'Your certificate of insurance ran out. Upload the new one here. A photo of it is fine.',
        button: 'Upload your certificate',
        paper: 'coi',
      },
      { id: 'msa', name: 'MSA signed', kind: 'done', when: 'Mon Sep 14' },
    ])
    expect(row(page, 'Boerne Retail Shell', 'ask')).toEqual({
      id: 'ask',
      name: 'Asked to quote',
      kind: 'yours',
      due: 'late since Wed Sep 30',
      late: true,
      line: 'Per the plans and the addenda.',
      button: 'Enter your quote',
      button2: 'Open the plans',
      paper: 'quote',
      signs: false,
    })
    expect(section(page, 'Boerne Retail Shell')?.rows.map((r) => [r.id, r.kind, 'line' in r ? r.line : ''])).toEqual([
      ['ask', 'yours', 'Per the plans and the addenda.'],
      ['sow', 'later', 'Later. If we carry your quote.'],
      ['draws', 'later', 'Later. Monthly, once you are on site.'],
      ['closeout', 'later', 'Later. At the end of your work.'],
    ])
    expect(row(page, 'Stone Oak Pharmacy', 'draws')).toMatchObject({
      kind: 'yours',
      due: 'due Mon Oct 19',
      line: 'Send your pay application for October by Mon Oct 19, with its conditional waiver.',
      button: 'Enter a draw',
      signs: false,
    })
    expect(row(page, 'Stone Oak Pharmacy', 'ask')).toEqual({ id: 'ask', name: 'Asked to quote', kind: 'done', when: 'done' })
  })

  it("reads Greg's in Spanish, the days and the paper names too", () => {
    const page = portalPage('es', GREG)
    expect(page.title).toBe('Dónde está con Click Construction')
    expect(page.sections[0]?.title).toBe('Para empezar')
    expect(row(page, 'Para empezar', 'invited')).toMatchObject({ name: 'Invitado', when: 'mar 8 sep' })
    expect(row(page, 'Para empezar', 'papers')).toMatchObject({ line: 'Su certificado de seguro venció. Suba el nuevo aquí. Una foto basta.', button: 'Suba su certificado' })
    expect(row(page, 'Boerne Retail Shell', 'ask')).toMatchObject({ name: 'Cotización pedida', due: 'atrasado desde el mié 30 sep' })
    expect(row(page, 'Stone Oak Pharmacy', 'draws')).toMatchObject({
      line: 'Envíe su solicitud de pago de octubre antes del lun 19 oct, con su renuncia condicional.',
      button: 'Pida un pago',
    })
    expect(page.questions).toBe('Preguntas: escriba o llame al (210) 555-0100.')
  })

  it("never shows our Compared on Bill's page, even while it is on now (the prototype drew it with Accept the bid)", () => {
    const page = portalPage('en', BILL)
    const rows = page.sections.flatMap((s) => s.rows)
    expect(rows.some((r) => r.id === 'compare')).toBe(false)
    expect(rows.some((r) => r.kind === 'decide')).toBe(false)
    expect(section(page, 'Boerne Retail Shell')?.rows.map((r) => [r.id, r.kind])).toEqual([
      ['ask', 'done'],
      ['sow', 'later'],
      ['draws', 'later'],
      ['closeout', 'later'],
    ])
    expect(row(page, 'Boerne Retail Shell', 'ask')).toMatchObject({ when: 'Tue Sep 29' })
  })

  it("asks Tom for his certificate with why, and tells him when the agreement comes", () => {
    const page = portalPage('en', TOM)
    expect(page.sections.map((s) => s.title)).toEqual(['Getting set up'])
    expect(row(page, 'Getting set up', 'papers')).toEqual({
      id: 'papers',
      name: 'Papers in',
      kind: 'yours',
      due: null,
      late: false,
      line: 'We need it before we can send you an agreement. A photo of it is fine.',
      button: 'Upload your certificate',
      button2: null,
      paper: 'coi',
      signs: false,
    })
    expect(row(page, 'Getting set up', 'msa')).toMatchObject({ kind: 'later', line: 'Later. We send it once your certificate is in. You sign it here.' })
  })

  it("reads Jonah's: the open question, the addendum on us, the certificate on him", () => {
    const page = portalPage('en', JONAH)
    expect(section(page, 'Boerne Retail Shell')?.rows.map((r) => [r.id, r.kind, 'line' in r ? r.line : r.when])).toEqual([
      ['plans', 'done', 'Tue Sep 15'],
      ['questions', 'yours', 'Your move.'],
      ['addenda', 'onIt', 'We are on it. We send it to the trades.'],
      ['submittals', 'later', 'Later. After Addenda.'],
      ['certify', 'yours', 'Certify it or send it back with a note.'],
    ])
    expect(row(page, 'Boerne Retail Shell', 'questions')).toMatchObject({ due: 'due Mon Oct 5', button: null })
    expect(row(page, 'Boerne Retail Shell', 'certify')).toMatchObject({ button: 'Certify the pay application', paper: 'certificate' })
  })

  it('thanks someone off the flow first, and keeps their steps under it', () => {
    const page = portalPage('en', { ...BILL, off: true })
    expect(page.off).toBe('Thank you for considering us. If you need us again, text us.')
    expect(page.sections.length).toBeGreaterThan(0)
    expect(portalPage('es', { ...BILL, off: true }).off).toBe('Gracias por considerarnos. Si vuelve a necesitarnos, escríbanos.')
  })

  it('shows an aside step and an Any time step only while one of their rounds is open', () => {
    const aside = step({ id: 'co', aside: true, loop: true, where: 'now', papers: [{ id: 'co', ours: true, mark: 'wait' }] })
    const shut = portalPage('en', { company: 'C', phone: 'P', off: false, lanes: [{ lane: 'perJob', jobs: [{ name: 'Job', steps: [aside] }] }, { lane: 'anyTime', steps: [step({ id: 'any' })] }] })
    expect(shut.sections).toEqual([])
    const open = portalPage('en', {
      company: 'C',
      phone: 'P',
      off: false,
      lanes: [
        { lane: 'perJob', jobs: [{ name: 'Job', steps: [{ ...aside, roundNow: true }] }] },
        { lane: 'anyTime', steps: [step({ id: 'any', roundNow: true })] },
      ],
    })
    expect(open.sections.map((s) => [s.title, s.rows.map((r) => r.id)])).toEqual([
      ['Job', ['co']],
      ['Open', ['any']],
    ])
    expect(open.sections[0]?.rows[0]).toMatchObject({ kind: 'yours', signs: true, button: 'See the change order' })
  })

  it('reads every demo step in both languages with every blank filled', () => {
    for (const [who, page] of Object.entries(TRADE_PAGES)) {
      for (const lang of ['en', 'es'] as const) {
        const text = JSON.stringify(portalPage(lang, page))
        expect(text, `${who} ${lang}`).not.toMatch(/\{\w+\}|undefined/)
      }
    }
  })
})

describe('one step read from their side', () => {
  it('leaves out a skipped step, our decisions, and a decision not on now', () => {
    expect(portalStep('en', step({ where: 'skipped' }))).toBeNull()
    expect(portalStep('en', step({ who: 'us', decision: true }))).toBeNull()
    expect(portalStep('en', step({ decision: true, where: 'notYet' }))).toBeNull()
    expect(portalStep('en', step({ decision: true, where: 'done' }))).toBeNull()
  })

  it('asks for their yes or no on a decision of theirs', () => {
    expect(portalStep('en', step({ decision: true }))).toEqual({ id: 'x', name: 'A step', kind: 'decide', line: 'Say yes or no here.', accept: 'Accept the bid', decline: 'Not this time' })
    expect(portalStep('es', step({ decision: true }))).toMatchObject({ line: 'Diga sí o no aquí.', accept: 'Aceptar la oferta', decline: 'Esta vez no' })
  })

  it('names who a step waits on', () => {
    expect(portalStep('en', step({ waitingOn: { who: 'architect', forCertificate: true } }))).toMatchObject({ kind: 'waiting', line: 'Waiting on your architect for the certificate.' })
    expect(portalStep('en', step({ waitingOn: { who: 'architect', forCertificate: false } }))).toMatchObject({ line: 'Waiting on your architect.' })
    expect(portalStep('en', step({ waitingOn: { who: 'owner', forCertificate: false } }))).toMatchObject({ line: 'Waiting on the owner.' })
    expect(portalStep('es', step({ waitingOn: { who: 'other', forCertificate: false } }))).toMatchObject({ line: 'Esperando a otra persona primero.' })
  })

  it('reads a paper of ours not sent yet as ours, with the day we owe it when we owe it', () => {
    const contract = step({ papers: [{ id: 'contract', ours: true, mark: 'no' }] })
    expect(portalStep('en', contract)).toMatchObject({ kind: 'onIt', line: 'We are on it. We are getting it ready. You sign it here.' })
    expect(portalStep('en', { ...contract, owedBy: '2026-10-05' })).toMatchObject({ kind: 'onIt', line: 'We are on it. We send it to you by Mon Oct 5.' })
    expect(portalStep('es', { ...contract, owedBy: '2026-10-05' })).toMatchObject({ line: 'Estamos en ello. Se lo enviamos para el lun 5 oct.' })
  })

  it('opens our sign page for a paper of ours that waits on their signature', () => {
    expect(portalStep('en', step({ papers: [{ id: 'contract', ours: true, mark: 'wait' }], day: { on: '2026-10-09', late: false } }))).toMatchObject({
      kind: 'yours',
      due: 'due Fri Oct 9',
      line: 'Read it and sign it here.',
      button: 'Sign the contract',
      signs: true,
    })
  })

  it('reads a sent pay application on a shared step as theirs to pay', () => {
    expect(portalStep('en', step({ who: 'both', papers: [{ id: 'payapp', ours: true, mark: 'ok' }] }))).toMatchObject({ kind: 'yours', line: 'Pay by the day on it.', button: 'See the pay application', signs: false })
    expect(portalStep('en', step({ who: 'both', papers: [{ id: 'payapp', ours: true, mark: 'no' }] }))).toMatchObject({ kind: 'onIt', line: 'We are on it.' })
  })

  it('reads an our-move step on now as We are on it, with what to expect', () => {
    expect(portalStep('en', step({ who: 'us', papers: [{ id: 'bid', ours: true, mark: 'no' }] }))).toMatchObject({ kind: 'onIt', line: 'We are on it. We are working on your number.' })
    expect(portalStep('es', step({ who: 'us', papers: [{ id: 'schedule', ours: true, mark: 'no' }] }))).toMatchObject({ line: 'Estamos en ello. Estamos fijando su fecha de inicio.' })
  })

  it('says when a step not reached comes: its own line, else its paper, else after the step before it', () => {
    expect(portalStep('en', step({ where: 'notYet', later: { en: 'Once you say yes.', es: 'Cuando acepte.' } }))).toMatchObject({ kind: 'later', line: 'Later. Once you say yes.' })
    expect(portalStep('en', step({ where: 'notYet', papers: [{ id: 'contract', ours: true, mark: 'no' }] }))).toMatchObject({ line: 'Later. We send it once you say yes.' })
    expect(portalStep('es', step({ where: 'notYet' }), { en: 'Plans in', es: 'Planos recibidos' })).toMatchObject({ line: 'Después. Después de Planos recibidos.' })
    expect(portalStep('en', step({ where: 'notYet' }))).toMatchObject({ line: 'Later.' })
  })
})

describe("the customer's Where you are", () => {
  it("draws Priya's three rows around the step we are on", () => {
    const where = customerWhere('en', PRIYA_STEPS.perJob)
    expect(where).toMatchObject({ title: 'Where you are', count: '3 of 8 done', pct: 38, more: 'All 8 steps' })
    expect(where.rows).toEqual([
      { id: 'contract', name: 'Contract signed', kind: 'done', when: 'Sat Sep 19' },
      { id: 'start', name: 'Start date', kind: 'onIt', line: 'We are on it. We send it to you by Mon Oct 5.' },
      { id: 'onsite', name: 'On site', kind: 'later', line: 'Later. After your start date.' },
    ])
    const all = customerWhere('en', PRIYA_STEPS.perJob, true)
    expect(all.rows.map((r) => r.id)).toEqual(['asked', 'bid', 'contract', 'start', 'onsite', 'payapp', 'close', 'warranty'])
    expect(all.more).toBe('Fewer')
  })

  it("reads Elena's pay application as waiting on her architect, in Spanish too", () => {
    const where = customerWhere('en', ELENA_STEPS.perJob)
    expect(where).toMatchObject({ count: '5 of 8 done', pct: 63 })
    expect(where.rows.map((r) => [r.id, r.kind])).toEqual([
      ['onsite', 'done'],
      ['payapp', 'waiting'],
      ['close', 'later'],
    ])
    expect(customerWhere('es', ELENA_STEPS.perJob)).toMatchObject({
      title: 'Dónde está',
      count: '5 de 8 listos',
      more: 'Los 8 pasos',
      rows: [{ when: 'lun 14 sep' }, { name: 'Solicitud de pago', line: 'Esperando el certificado de su arquitecto.' }, { line: 'Después. Cuando la obra termine y usted la acepte.' }],
    })
  })

  it('counts the rows it can show, so All 8 steps lists eight', () => {
    for (const steps of [PRIYA_STEPS, ELENA_STEPS, MARCUS_STEPS]) {
      const all = customerWhere('en', steps.perJob, true)
      expect(all.more === 'Fewer' && all.rows.length).toBe(Number(customerWhere('en', steps.perJob).more.match(/\d+/)?.[0]))
    }
  })
})
