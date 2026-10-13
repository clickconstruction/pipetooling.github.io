/**
 * Settings → Flows' reads and its Save (Messages cut 4, wave 2). The flow as the office keeps it, read fresh (the
 * boards' `loadFlowDef` keeps a copy, which a Save clears), its History newest first, the steps standing in Removed,
 * and the newest History line's time, which `flow_save` holds the Save to (20261013020000): a Save made from a flow
 * someone saved since is refused. Save sends the editor's whole flow, its History lines, the steps it removed and the
 * ones it put back, in one call.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { DatabaseError, formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { flowFromRows, type FlowDraft, type FlowHistoryEntry, type FlowStepRow, type RemovedStep, type SavedFlow } from './editor'
import type { FlowKind } from './facts'
import { clearFlowDefCache } from './flowsIo'
import { SEED_FLOWS } from './seed'
import type { FlowDef, FlowStep, Lane } from './state'

// Untyped until the types regenerate after the flows' push.
const db = supabase as unknown as SupabaseClient

/** The columns `flowFromRows` reads, as the flows' migration names them. */
const STEP_COLUMNS =
  'step_key, lane, position, name, name_es, phase, who, seat_user_id, facts, join_word, papers, loop_words, loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual, owed_words'

/** History reads this many lines, newest first. */
export const HISTORY_LINES = 200

export interface FlowForEditing {
  flow: FlowDef
  /** Newest first, as History draws it. */
  history: FlowHistoryEntry[]
  removed: RemovedStep[]
  /** The newest History line's time as the server wrote it, or null for none: the Save is held to it. */
  basedOn: string | null
  /** The day the flow was drawn from the seed, for History's first line. */
  drawnAt: string | null
  /** No step is kept yet, so the seed's flow is shown; a Save writes it. */
  fromSeed: boolean
}

interface HistoryRow {
  step_key: string | null
  what: string
  before: FlowStep | null
  after: FlowStep | null
  by_name: string
  created_at: string
}

interface RemovedRow {
  step_key: string
  lane: Lane
  step: FlowStep | null
  removed_by_name: string
  removed_at: string
}

const LANES: readonly Lane[] = ['once', 'per_job', 'any_time']

/** A removed step as kept: whole, in a lane the flows know, else left out. */
function removedOf(r: RemovedRow): RemovedStep | null {
  const s = r.step
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.name !== 'string' || !LANES.includes(r.lane)) return null
  return { step: s, lane: r.lane, by: r.removed_by_name || 'someone', at: r.removed_at }
}

/** The flow for a kind as the editor opens it. */
export async function loadFlowForEditing(kind: FlowKind): Promise<FlowForEditing> {
  const flowRow = await withSupabaseRetry<{ id: string; created_at: string } | null>(
    () => db.from('flows').select('id, created_at').eq('kind', kind).maybeSingle(),
    'read the flow',
  )
  if (!flowRow) return { flow: SEED_FLOWS[kind], history: [], removed: [], basedOn: null, drawnAt: null, fromSeed: true }
  const [steps, history, removed] = await Promise.all([
    withSupabaseRetry<FlowStepRow[]>(() => db.from('flow_steps').select(STEP_COLUMNS).eq('flow_id', flowRow.id), 'read the flow’s steps'),
    withSupabaseRetry<HistoryRow[]>(
      () =>
        db
          .from('flow_step_history')
          .select('step_key, what, before, after, by_name, created_at')
          .eq('flow_id', flowRow.id)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LINES),
      'read the flow’s History',
    ),
    withSupabaseRetry<RemovedRow[]>(
      () =>
        db
          .from('flow_removed_steps')
          .select('step_key, lane, step, removed_by_name, removed_at')
          .eq('flow_id', flowRow.id)
          .is('put_back_at', null)
          .order('removed_at', { ascending: false }),
      'read the removed steps',
    ),
  ])
  const rows = steps ?? []
  return {
    flow: rows.length ? flowFromRows(kind, rows) : SEED_FLOWS[kind],
    history: (history ?? []).map((h) => ({ stepId: h.step_key, what: h.what, before: h.before, after: h.after, by: h.by_name || 'someone', at: h.created_at })),
    // One removal a step: a step removed twice reads as its latest.
    removed: (removed ?? []).flatMap((r) => removedOf(r) ?? []).filter((r, i, all) => all.findIndex((x) => x.step.id === r.step.id) === i),
    basedOn: history?.[0]?.created_at ?? null,
    drawnAt: flowRow.created_at,
    fromSeed: rows.length === 0,
  }
}

/** The steps a Save removes: in Removed now and not when the draft opened. */
export const newlyRemoved = (draft: FlowDraft): RemovedStep[] =>
  draft.removed.filter((r) => !draft.saved.removed.some((x) => x.step.id === r.step.id))

/**
 * Save, all of it or none (`flow_save`), and clear the boards' copy so every board reads the edit. Returns the newest
 * History line's time, for the next Save. Never retried: a Save that went through with its answer lost would come back
 * refused as saved since, by its own lines.
 */
export async function saveFlow(kind: FlowKind, saved: SavedFlow, draft: FlowDraft, basedOn: string | null): Promise<string | null> {
  const at = await withSupabaseRetry<string | null>(
    () =>
      db.rpc('flow_save', {
        p_kind: kind,
        p_steps: saved.rows,
        p_history: saved.history.map((h) => ({ step_key: h.stepId, what: h.what, before: h.before, after: h.after })),
        p_removed: newlyRemoved(draft).map((r) => ({ step_key: r.step.id, lane: r.lane, step: r.step })),
        p_put_back: saved.putBack,
        p_based_on: basedOn,
      }),
    'save the flow',
    { maxRetries: 0 },
  )
  clearFlowDefCache(kind)
  return at ?? null
}

/** Ask for a fact that is missing: written down for the build, with the step it is for (`flow_fact_wishes`). */
export async function askForFact(kind: FlowKind, stepId: string, text: string, byName: string): Promise<void> {
  const flowRow = await withSupabaseRetry<{ id: string } | null>(() => db.from('flows').select('id').eq('kind', kind).maybeSingle(), 'read the flow')
  await withSupabaseRetry<null>(
    () => db.from('flow_fact_wishes').insert({ flow_id: flowRow?.id ?? null, step_key: stepId, text: text.trim(), by_name: byName }),
    'ask for a fact',
    { maxRetries: 0 },
  )
}

/** Who an our-move step can sit with: the office team, A to Z. */
export async function loadSeats(): Promise<{ id: string; name: string }[]> {
  const rows = await withSupabaseRetry<{ id: string; name: string | null }[]>(
    () =>
      db
        .from('users')
        .select('id, name')
        .in('role', ['dev', 'master_technician', 'assistant', 'controller', 'estimator'])
        .is('archived_at', null)
        .eq('is_digital_twin', false)
        .order('name'),
    'read the office team',
  )
  return (rows ?? []).filter((r) => r.name?.trim()).map((r) => ({ id: r.id, name: (r.name ?? '').trim() }))
}

/** A library paper's name by its id (`doc:<uuid>` without the prefix), for its chip and its words. */
export async function loadDocNames(docIds: readonly string[]): Promise<Record<string, string>> {
  const ids = [...new Set(docIds)]
  if (!ids.length) return {}
  const rows = await withSupabaseRetry<{ id: string; document_name: string | null }[]>(
    () => db.from('contract_template_documents').select('id, document_name').in('id', ids),
    'read the library papers’ names',
  )
  return Object.fromEntries((rows ?? []).filter((r) => r.document_name?.trim()).map((r) => [r.id, (r.document_name ?? '').trim()]))
}

/** The trades the Board's packages name, A to Z, for a new contract's "<trade> only" clauses. */
export async function loadTradeNames(): Promise<string[]> {
  const rows = await withSupabaseRetry<{ trade: string | null }[]>(() => db.from('gc_trade_packages').select('trade'), 'read the trades')
  return [...new Set((rows ?? []).map((r) => r.trade?.trim() ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

/**
 * What the office reads when a Save is refused. The flows' functions refuse with a code and the words in its detail
 * (`savedMeanwhile`: "Someone saved this flow while you edited it…"); anything else reads as the house says it.
 */
export function flowSaveProblem(error: unknown): string {
  if (error instanceof DatabaseError && (error.code === 'P0001' || error.code === '42501')) {
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim()
    if (error.serverMessage) return error.serverMessage
  }
  return formatErrorMessage(error)
}
