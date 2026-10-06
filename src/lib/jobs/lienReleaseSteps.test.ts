import { describe, expect, it } from 'vitest'
import { lienReleaseSteps, releaseStepLookNote, releaseStepPagePart, type ReleaseStepsInput } from './lienReleaseSteps'

// Job 650's draft as Grace had it on Oct 1: both bills, unconditional progress, $17,777.51, every detail filled.
const DRAFT: ReleaseStepsInput = { billCount: 2, billsPicked: 2, covered: false, amount: 17777.51, tooEarly: false, detailsMissing: 0, rowStatus: 'draft', sent: false }
const states = (i: ReleaseStepsInput) => lienReleaseSteps(i).steps.map((s) => s.state)

describe('lienReleaseSteps', () => {
  it('a filled draft: steps 1–4 done, step 5 is the one to do, step 6 waits for the signature (an ordinary wait)', () => {
    const r = lienReleaseSteps(DRAFT)
    expect(states(DRAFT)).toEqual(['done', 'done', 'done', 'done', 'now', 'wait'])
    expect(r.current?.n).toBe(5)
    expect(r.steps[5]).toMatchObject({ key: 'send', waitsFor: null, folded: false })
  })

  it('a fresh window with nothing picked: step 1 is the one to do and everything after waits for it', () => {
    const r = lienReleaseSteps({ ...DRAFT, billsPicked: 0, rowStatus: null })
    expect(r.steps.map((s) => s.state)).toEqual(['now', 'wait', 'wait', 'wait', 'wait', 'wait'])
    expect(r.current?.n).toBe(1)
    expect(r.steps.slice(1).map((s) => s.waitsFor)).toEqual([1, 1, 1, 1, 1])
  })

  it('the bill is already waived: step 1 needs a fix and holds the rest (job 650, bill #1, Oct 1)', () => {
    const r = lienReleaseSteps({ ...DRAFT, billsPicked: 1, covered: true, amount: 9022.49 })
    expect(r.steps.map((s) => s.state)).toEqual(['warn', 'wait', 'wait', 'wait', 'wait', 'wait'])
    expect(r.current).toMatchObject({ n: 1, state: 'warn' })
    expect(r.steps.slice(1).every((s) => s.waitsFor === 1)).toBe(true)
  })

  it('a job with no bills to pick covers the whole job: step 1 is done on its own', () => {
    expect(states({ ...DRAFT, billCount: 0, billsPicked: 0 })).toEqual(['done', 'done', 'done', 'done', 'now', 'wait'])
  })

  it('an empty amount makes step 3 the one to do; signing waits for it', () => {
    const r = lienReleaseSteps({ ...DRAFT, amount: 0 })
    expect(r.steps.map((s) => s.state)).toEqual(['done', 'done', 'now', 'done', 'wait', 'wait'])
    expect(r.current?.n).toBe(3)
    expect(r.steps[4]?.waitsFor).toBe(3)
  })

  it('an unconditional final while money is owed: step 3 needs a fix', () => {
    const r = lienReleaseSteps({ ...DRAFT, tooEarly: true })
    expect(r.current).toMatchObject({ n: 3, state: 'warn' })
    expect(r.steps[4]).toMatchObject({ state: 'wait', waitsFor: 3 })
  })

  it('a blank detail: step 4 needs a fix and signing waits for it', () => {
    const r = lienReleaseSteps({ ...DRAFT, detailsMissing: 2 })
    expect(r.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'warn', 'wait', 'wait'])
    expect(r.current?.n).toBe(4)
  })

  it('printed for a paper signature (issued): still step 5', () => {
    expect(lienReleaseSteps({ ...DRAFT, rowStatus: 'issued' }).current?.n).toBe(5)
  })

  it('a signature requested: steps 1–4 fold to one line, step 5 is still the one to do', () => {
    const r = lienReleaseSteps({ ...DRAFT, rowStatus: 'awaiting_signature' })
    expect(r.current?.n).toBe(5)
    expect(r.steps.map((s) => s.folded)).toEqual([true, true, true, true, false, false])
  })

  it('signed: steps 1–5 fold and done, step 6 is the one to do — whatever the draft checks said', () => {
    const r = lienReleaseSteps({ ...DRAFT, rowStatus: 'signed', covered: true, detailsMissing: 1 })
    expect(r.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'now'])
    expect(r.steps.map((s) => s.folded)).toEqual([true, true, true, true, true, false])
    expect(r.current?.n).toBe(6)
  })

  it('sent: every step done, nothing left to do', () => {
    const r = lienReleaseSteps({ ...DRAFT, rowStatus: 'signed', sent: true })
    expect(r.steps.every((s) => s.state === 'done')).toBe(true)
    expect(r.current).toBeNull()
  })
})

describe('click to look (v2.4337)', () => {
  it('each step marks the part of the page it filled in; step 6 fills nothing', () => {
    expect([1, 2, 3, 4, 5, 6].map(releaseStepPagePart)).toEqual(['amount', 'title', 'amount', 'project', 'signature', null])
  })
  it('an opened step says why it is read only and how to change it', () => {
    expect(releaseStepLookNote('awaiting_signature', false)).toContain('click Cancel request in step 5 first')
    // #87 C: a waiver printed for a paper signature stays issued when the request is cancelled.
    expect(releaseStepLookNote('awaiting_signature', false, false)).toBe('Read only while it waits for his signature. It was printed for a paper signature, so to change it, click Void this waiver at the bottom and make a new one.')
    expect(releaseStepLookNote('awaiting_signature', false, false)).not.toContain('Cancel request')
    expect(releaseStepLookNote('signed', false)).toContain('click Void this waiver at the bottom and make a new one. He signs it again.')
    expect(releaseStepLookNote('signed', true)).toContain('signed and sent')
    expect(releaseStepLookNote('draft', false)).toBeNull()
    expect(releaseStepLookNote(null, false)).toBeNull()
  })
})
