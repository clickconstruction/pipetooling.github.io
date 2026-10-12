import { describe, expect, it } from 'vitest'
import { ELENA_CHANGES, ELENA_STEPS, MARCUS_STEPS, PRIYA_CHANGES, PRIYA_STEPS, customerFlow } from '../portal/portalTestPeople'
import { customerMove, customerMoveWords } from './customerMove'
import type { PortalStepIn } from './portalPage'

const withStep = (steps: PortalStepIn[], id: string, over: Partial<PortalStepIn>) => steps.map((s) => (s.id === id ? { ...s, ...over } : s))

describe("the customer's Your move", () => {
  it("puts Priya's open change order first, with what it adds and its days", () => {
    expect(customerMove('en', { off: false, steps: customerFlow(PRIYA_STEPS), changes: PRIYA_CHANGES })).toEqual({
      kind: 'change',
      changeId: 'co-priya-2',
      title: 'Change order 2 waits on your answer',
      detail: ['a sink in exam 3', '+$2,150', 'adds no days'],
      buttons: [
        { label: 'Read and sign', primary: true, press: 'signChange' },
        { label: 'Decline', primary: false, press: 'declineChange' },
      ],
    })
    expect(customerMove('es', { off: false, steps: customerFlow(PRIYA_STEPS), changes: PRIYA_CHANGES })).toMatchObject({
      title: 'La orden de cambio 2 espera su respuesta',
      detail: ['un lavabo en el consultorio 3', '+$2,150', 'no agrega días'],
      buttons: [{ label: 'Leer y firmar' }, { label: 'Rechazar' }],
    })
  })

  it('reads a credit as a credit and says the days a change adds', () => {
    const changes = [{ id: 'c', number: 3, description: { en: 'drop the canopy', es: null }, price: -500, days: 3, state: 'open' as const }]
    expect(customerMove('en', { off: false, steps: customerFlow(PRIYA_STEPS), changes })).toMatchObject({
      title: 'Change order 3 waits on your answer',
      detail: ['drop the canopy', 'a credit of $500', 'adds 3 working days'],
    })
  })

  it('says nothing is owed today and which step we are on, for Elena', () => {
    expect(customerMove('en', { off: false, steps: customerFlow(ELENA_STEPS), changes: ELENA_CHANGES })).toEqual({ kind: 'none', line: 'Nothing from you today. We are on Pay application.' })
    expect(customerMove('es', { off: false, steps: customerFlow(ELENA_STEPS), changes: ELENA_CHANGES })).toEqual({
      kind: 'none',
      line: 'Hoy no necesitamos nada de usted. Estamos en Solicitud de pago.',
    })
  })

  it('thanks a customer off the flow', () => {
    expect(customerMove('en', { off: true, steps: customerFlow(MARCUS_STEPS), changes: [] })).toEqual({ kind: 'off', line: 'Thank you for considering us. If you need us again, text us.' })
  })

  it('asks for their yes or no while the decision is on now, before any change order', () => {
    const steps = withStep(withStep(customerFlow(PRIYA_STEPS), 'yes', { where: 'now' }), 'start', { where: 'notYet' })
    expect(customerMove('en', { off: false, steps, changes: PRIYA_CHANGES })).toEqual({
      kind: 'decide',
      title: 'Tell us yes or no',
      sub: 'Said yes',
      buttons: [
        { label: 'Accept the bid', primary: true, press: 'accept' },
        { label: 'Not this time', primary: false, press: 'decline' },
      ],
    })
  })

  it('asks them to sign a paper of ours that waits on their signature, with its day', () => {
    const steps = withStep(withStep(customerFlow(PRIYA_STEPS), 'contract', { where: 'now', papers: [{ id: 'contract', ours: true, mark: 'wait' }], day: { on: '2026-10-09', late: false } }), 'start', {
      where: 'notYet',
    })
    expect(customerMove('en', { off: false, steps, changes: [] })).toEqual({
      kind: 'paper',
      paper: 'contract',
      title: 'Sign the contract',
      due: 'due Fri Oct 9',
      late: false,
      sub: 'Read it and sign it here.',
      buttons: [{ label: 'Sign the contract', primary: true, press: 'sign' }],
    })
    expect(customerMove('es', { off: false, steps, changes: [] })).toMatchObject({ title: 'Firme el contrato', due: 'para el vie 9 oct' })
  })

  it('never asks them yes or no on a decision of ours', () => {
    const ours: PortalStepIn = { id: 'review', name: { en: 'We review it', es: 'Lo revisamos' }, who: 'us', where: 'now', decision: true }
    expect(customerMove('en', { off: false, steps: [ours], changes: [] })).toEqual({ kind: 'none', line: 'Nothing from you today. We are on We review it.' })
  })

  it('never makes a step waiting on someone else, or a contract not sent yet, their move', () => {
    const notSent = withStep(withStep(customerFlow(PRIYA_STEPS), 'contract', { where: 'now', papers: [{ id: 'contract', ours: true, mark: 'no' }] }), 'start', { where: 'notYet' })
    expect(customerMove('en', { off: false, steps: notSent, changes: [] })).toEqual({ kind: 'none', line: 'Nothing from you today. We are on Contract signed.' })
  })

  it('words the move for the office in one line', () => {
    expect(customerMoveWords(customerMove('en', { off: false, steps: customerFlow(PRIYA_STEPS), changes: PRIYA_CHANGES }))).toBe('Change order 2 waits on your answer.')
    expect(customerMoveWords({ kind: 'paper', paper: 'contract', title: 'Sign the contract', due: 'due Fri Oct 9', late: false, sub: '', buttons: [] })).toBe('Sign the contract, due Fri Oct 9.')
    expect(customerMoveWords({ kind: 'decide', title: 'Tell us yes or no', sub: 'Said yes', buttons: [] })).toBe('Tell us yes or no: Said yes.')
  })
})
