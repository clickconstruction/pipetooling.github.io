import { describe, expect, it } from 'vitest'
import {
  computeEstimateDraftSteps,
  type EstimateDraftStepsInput,
} from './estimateDraftSteps'

function input(overrides: Partial<EstimateDraftStepsInput>): EstimateDraftStepsInput {
  return {
    isCO: false,
    customerSelected: false,
    customerEmailPresent: false,
    changeDescriptionFilled: false,
    lineCount: 0,
    totalCents: 0,
    termsFilled: false,
    attachmentFilled: false,
    notifyCount: 1,
    ...overrides,
  }
}

describe('step lists per doc kind', () => {
  it('estimate: 4 steps, no "The change", contiguous numbering', () => {
    const { steps } = computeEstimateDraftSteps(input({}))
    expect(steps.map((s) => s.key)).toEqual(['customer', 'cost', 'paper_extras', 'delivery'])
    expect(steps.map((s) => s.number)).toEqual([1, 2, 3, 4])
    expect(steps.find((s) => s.key === 'cost')?.label).toBe('Line items')
  })

  it('CO: 5 steps including "The change", Impact-on-cost wording', () => {
    const { steps } = computeEstimateDraftSteps(input({ isCO: true }))
    expect(steps.map((s) => s.key)).toEqual(['customer', 'change', 'cost', 'paper_extras', 'delivery'])
    expect(steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5])
    expect(steps.find((s) => s.key === 'cost')?.label).toBe('Impact on cost')
  })

  it('delivery is the only backstage step', () => {
    const { steps } = computeEstimateDraftSteps(input({ isCO: true }))
    expect(steps.filter((s) => s.group === 'backstage').map((s) => s.key)).toEqual(['delivery'])
  })
})

describe('step states', () => {
  it('customer: attention until selected AND email present, with staged sublabels', () => {
    const customerStep = (i: Partial<EstimateDraftStepsInput>) =>
      computeEstimateDraftSteps(input(i)).steps.find((s) => s.key === 'customer')
    expect(customerStep({})).toMatchObject({ status: 'attention', sublabel: 'pick a customer' })
    expect(customerStep({ customerSelected: true })).toMatchObject({
      status: 'attention',
      sublabel: 'email needed for the accept link',
    })
    expect(customerStep({ customerSelected: true, customerEmailPresent: true })?.status).toBe('done')
  })

  it('cost: attention with no lines; done shows the signed net for COs', () => {
    const empty = computeEstimateDraftSteps(input({ isCO: true }))
    expect(empty.steps.find((s) => s.key === 'cost')).toMatchObject({ status: 'attention', sublabel: 'no lines yet' })
    const credit = computeEstimateDraftSteps(input({ isCO: true, lineCount: 2, totalCents: -39000 }))
    expect(credit.steps.find((s) => s.key === 'cost')).toMatchObject({ status: 'done', sublabel: 'net −$390.00' })
  })

  it('terms & attachments: optional when untouched, done when either is set', () => {
    const untouched = computeEstimateDraftSteps(input({}))
    expect(untouched.steps.find((s) => s.key === 'paper_extras')).toMatchObject({ status: 'optional', sublabel: 'optional' })
    const both = computeEstimateDraftSteps(input({ termsFilled: true, attachmentFilled: true }))
    expect(both.steps.find((s) => s.key === 'paper_extras')).toMatchObject({ status: 'done', sublabel: 'terms · attachment' })
  })

  it('delivery: attention when nobody is notified', () => {
    const nobody = computeEstimateDraftSteps(input({ notifyCount: 0 }))
    expect(nobody.steps.find((s) => s.key === 'delivery')).toMatchObject({ status: 'attention', sublabel: 'no one notified' })
    const two = computeEstimateDraftSteps(input({ notifyCount: 2 }))
    expect(two.steps.find((s) => s.key === 'delivery')?.sublabel).toBe('2 notified')
  })
})

describe('send gate', () => {
  it('mirrors the existing hard rule: customer + email, nothing else blocks', () => {
    const gate = computeEstimateDraftSteps(
      input({ customerSelected: true, customerEmailPresent: true, lineCount: 0, notifyCount: 0 }),
    ).sendGate
    expect(gate.ready).toBe(true)
    expect(gate.remaining).toEqual(['cost lines', 'delivery'])
    expect(gate.sentence).toBe('2 steps left: cost lines · delivery')
  })

  it('not ready without a deliverable customer', () => {
    const gate = computeEstimateDraftSteps(input({ customerSelected: true })).sendGate
    expect(gate.ready).toBe(false)
    expect(gate.remaining[0]).toBe('customer')
  })

  it('confirmZeroNet flags a $0 document; ready sentence says so', () => {
    const gate = computeEstimateDraftSteps(
      input({ isCO: true, customerSelected: true, customerEmailPresent: true, changeDescriptionFilled: true, lineCount: 1, totalCents: 0 }),
    ).sendGate
    expect(gate.confirmZeroNet).toBe(true)
    expect(gate.sentence).toBe('Ready — net change is $0.00')
  })

  it('all-clear CO sentence states the WYSIWYG promise', () => {
    const gate = computeEstimateDraftSteps(
      input({ isCO: true, customerSelected: true, customerEmailPresent: true, changeDescriptionFilled: true, lineCount: 1, totalCents: 245000 }),
    ).sendGate
    expect(gate.ready).toBe(true)
    expect(gate.sentence).toBe("Ready — this is exactly what they'll sign.")
  })

  it('singular step wording', () => {
    const gate = computeEstimateDraftSteps(
      input({ customerSelected: true, customerEmailPresent: true, lineCount: 1, totalCents: 100, notifyCount: 0 }),
    ).sendGate
    expect(gate.sentence).toBe('1 step left: delivery')
  })
})
