/**
 * Settings → Flows for one kind of person (Messages cut 4, wave 2): the flow as the office keeps it and the draft over
 * it (`flows/editor.ts`), History and Removed, everyone on the flow for Before you save · who moves (`flow_rows_kind`,
 * read as the boards read it), and How it is going (`going.ts` over `goingInputs`). Every edit goes through the editor
 * and comes back as a draft or a refusal in words. Save writes it all at once (`flow_save`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readBoard, type BoardRead, type FlowRowsKindAnswer } from '../lib/flows/boardRead'
import {
  draftFrom,
  putBack as putBackDraft,
  saveDraft,
  savedWords,
  whoMovesPreview,
  type EditResult,
  type FlowDraft,
  type WhoMovesLine,
} from '../lib/flows/editor'
import { flowSaveProblem, loadFlowForEditing, saveFlow, type FlowForEditing } from '../lib/flows/flowEditorIo'
import { readsPeopleOf, type EditorKind } from '../lib/flows/editorKinds'
import { loadFlowRowsKind } from '../lib/flows/flowsIo'
import { funnel, goingRows, usualByStep, type Funnel, type GoingRow } from '../lib/flows/going'
import { goingInputs } from '../lib/flows/goingInputs'
import { flowStampsFor, type FlowRows } from '../lib/flows/load'
import type { FlowStamps } from '../lib/flows/state'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

/** The flows the office edits: a number nobody has named has its own, which is the app's. */
export type { EditorKind }

export interface FlowPerson {
  contactId: string
  name: string
  stamps: FlowStamps
}

export interface FlowEditor {
  loading: boolean
  problem: string | null
  kept: FlowForEditing | null
  draft: FlowDraft | null
  /** Everyone on this kind's flow, for the preview; empty when their read failed. */
  people: readonly FlowPerson[]
  board: BoardRead | null
  preview: { lines: WhoMovesLine[]; changes: string } | null
  going: { rows: GoingRow[]; funnel: Funnel | null } | null
  saving: boolean
  /** Apply an edit. A refusal's words come back for the screen to say; null when it went in. */
  edit: (fn: (d: FlowDraft) => EditResult) => string | null
  putBack: () => void
  save: (by: string) => Promise<{ ok: boolean; words: string }>
  reload: () => Promise<void>
}

/** Everyone of this kind in the answer, with the stamps the preview tries the edit on. */
function peopleOf(kind: EditorKind, answer: FlowRowsKindAnswer, now: Date): FlowPerson[] {
  return Object.entries(answer)
    .filter(([, e]) => e.contact.kind === kind)
    .map(([contactId, e]) => ({ contactId, name: e.card.company || e.card.name || 'No name yet', stamps: flowStampsFor(kind, e as unknown as FlowRows, now) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function useFlowEditor(kind: EditorKind, opts: { enabled?: boolean; now?: () => Date } = {}): FlowEditor {
  const enabled = opts.enabled ?? true
  const nowOf = opts.now ?? (() => new Date())
  const nowRef = useRef(nowOf)
  nowRef.current = nowOf
  const [kept, setKept] = useState<FlowForEditing | null>(null)
  const [draft, setDraft] = useState<FlowDraft | null>(null)
  const [answer, setAnswer] = useState<FlowRowsKindAnswer>({})
  const [readAt, setReadAt] = useState<Date>(() => nowOf())
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      // Who is on the flow only feeds the preview and How it is going: its read failing leaves the flow to edit. A
      // residential customer's and a sub's people have no such read yet (`readsPeopleOf`), so theirs is not asked for.
      const people = readsPeopleOf(kind) ? loadFlowRowsKind(kind).catch((): FlowRowsKindAnswer => ({})) : Promise.resolve<FlowRowsKindAnswer>({})
      const [flow, rows] = await Promise.all([loadFlowForEditing(kind), people])
      if (!live.current) return
      setKept(flow)
      setDraft(draftFrom(flow.flow, flow.removed))
      setAnswer(rows)
      setReadAt(nowRef.current())
      setProblem(null)
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e))
    } finally {
      if (live.current) setLoading(false)
    }
  }, [enabled, kind])

  useEffect(() => {
    setKept(null)
    setDraft(null)
    void reload()
  }, [reload])

  const people = useMemo(() => peopleOf(kind, answer, readAt), [kind, answer, readAt])
  const board = useMemo(() => (kept ? readBoard(kept.flow, answer, readAt) : null), [kept, answer, readAt])
  const going = useMemo(() => {
    if (!kept || !board) return null
    const today = todayYmdInAppTz(readAt)
    const { spans, runs } = goingInputs(kept.flow, Object.entries(board.readings).map(([contactId, reading]) => ({ contactId, reading })))
    const ctx = { flow: kept.flow, jobs: board.jobs, usual: usualByStep(kept.flow, spans, today), firstNames: board.firstNames, today }
    return { rows: goingRows(ctx, board.companies, spans), funnel: funnel(kind, runs, today) }
  }, [kept, board, kind, readAt])
  const preview = useMemo(() => (draft && draft.changes.length ? whoMovesPreview(draft, people, readAt) : null), [draft, people, readAt])

  const edit = useCallback(
    (fn: (d: FlowDraft) => EditResult): string | null => {
      if (!draft) return null
      const result = fn(draft)
      if (!result.ok) return result.words
      setDraft(result.draft)
      return null
    },
    [draft],
  )

  const putBack = useCallback(() => setDraft((d) => (d ? putBackDraft(d) : d)), [])

  const save = useCallback(
    async (by: string): Promise<{ ok: boolean; words: string }> => {
      if (!draft || !kept) return { ok: false, words: 'Nothing to save yet.' }
      const moved = preview?.lines.filter((l) => l.moved).length ?? 0
      setSaving(true)
      try {
        await saveFlow(kind, saveDraft(draft, by, nowRef.current().toISOString()), draft, kept.basedOn)
        await reload()
        return { ok: true, words: savedWords(moved) }
      } catch (e) {
        return { ok: false, words: flowSaveProblem(e) }
      } finally {
        if (live.current) setSaving(false)
      }
    },
    [draft, kept, kind, preview, reload],
  )

  return { loading, problem, kept, draft, people, board, preview, going, saving, edit, putBack, save, reload }
}
