import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft, type NewPaperDraft, type NewPaperKind } from './newPaper'

const ID = '0b5e3c1e-2f4a-4c1b-9d7e-1a2b3c4d5e6f'
/** Each call the write makes, and what the test answers it with, by function name. */
const calls: { fn: string; args: Record<string, unknown> }[] = []
let answers: Record<string, (args: Record<string, unknown>) => { data: unknown; error: { message: string; code?: string } | null }> = {}
vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return Promise.resolve(answers[fn]?.(args) ?? { data: null, error: { message: `no answer for ${fn}`, code: 'P0001' } })
    },
  },
}))
/** What the approvers were told about (messages-notify), one entry per call. */
const tells: string[][] = []
const TOLD = { pushSent: 2, emailSent: 2, names: ['Maria', 'Robert'] }
vi.mock('../contracts/clausesIo', () => ({
  tellClauseApprovers: (ids: string[]) => {
    tells.push(ids)
    return Promise.resolve(TOLD)
  },
}))
const { saveFlowPaper } = await import('./newPaperIo')

const draft = (kind: NewPaperKind, over: Partial<NewPaperDraft> = {}): NewPaperDraft & { kind: NewPaperKind } => ({ ...emptyDraft(), ...over, kind })

describe('saveFlowPaper', () => {
  beforeEach(() => {
    calls.length = 0
    tells.length = 0
    answers = { flow_paper_create: () => ({ data: ID, error: null }) }
  })

  it('writes an upload that runs out once, as a published paper with its one fact', async () => {
    const saved = await saveFlowPaper('trade', draft('upload', { name: 'their bond', runsOut: true, renewAskDays: 45 }))
    expect(calls.map((c) => c.fn)).toEqual(['flow_paper_create'])
    expect(calls[0]?.args).toMatchObject({ p_flow: 'trade', p_kind: 'upload', p_name: 'their bond', p_renew_ask_days: 45 })
    expect(saved).toEqual({ paperId: `doc:${ID}`, factIds: [`doc:${ID}:current`], label: 'Bond', kind: 'upload', state: 'published', clauses: 0, told: null })
    expect(tells).toEqual([])
  })

  it('writes a contract’s clauses after the paper, and reads it as waiting when one waits for a controller or a dev', async () => {
    answers.edit_clause = (a) => ({ data: a.p_text_en === 'Tie off above six feet.' ? { state: 'published', proposal_id: 'p-1' } : { state: 'proposed', proposal_id: 'p-2' }, error: null })
    const saved = await saveFlowPaper('trade', draft('contract', { name: 'the safety agreement', clauses: [{ en: 'Tie off above six feet.', es: '', scope: ['all'] }, { en: 'A locate before any dig.', es: '', scope: ['Sitework'] }] }))
    expect(calls.map((c) => c.fn)).toEqual(['flow_paper_create', 'edit_clause', 'edit_clause'])
    expect(calls[2]?.args).toMatchObject({ p_paper_id: ID, p_kind: 'new', p_clause_id: null, p_text_en: 'A locate before any dig.', p_scope: ['Sitework'] })
    expect(saved).toMatchObject({ factIds: [`doc:${ID}:signed`], state: 'proposed', clauses: 2, told: TOLD })
    // The approvers hear once, of the clause that waits, never of one that published.
    expect(tells).toEqual([['p-2']])
  })

  it('reads a contract whose clauses all published as published', async () => {
    answers.edit_clause = () => ({ data: { state: 'published' }, error: null })
    const saved = await saveFlowPaper('customer', draft('contract', { name: 'the warranty', clauses: [{ en: 'One year.', es: 'Un año.', scope: ['all'] }] }))
    expect(saved).toMatchObject({ state: 'published', told: null })
    expect(tells).toEqual([])
  })

  it('stops at a refusal with the server’s reason, and writes no clause after a paper it could not make', async () => {
    answers.flow_paper_create = () => ({ data: null, error: { message: 'Only the office adds a paper.', code: '42501' } })
    await expect(saveFlowPaper('trade', draft('contract', { name: 'x', clauses: [{ en: 'y', es: '', scope: ['all'] }] }))).rejects.toMatchObject({ message: expect.stringContaining('add the paper') })
    expect(calls.map((c) => c.fn)).toEqual(['flow_paper_create'])
  })
})
