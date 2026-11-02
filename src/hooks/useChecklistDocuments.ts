/**
 * The spike's store for stage checklists as documents (punch list #237): the
 * company's items, and per job its added items, answers, filed records and the
 * stages reopened for amendment — one module snapshot in browser storage, read
 * through `useSyncExternalStore`. The build gives these rows (job-scoped
 * question rows, signature columns on the answer, `stage_checklist_records`);
 * nothing here reaches the database.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  checklistProgress,
  itemsForStage,
  type ChecklistAnswer,
  type ChecklistItem,
  type ChecklistPick,
  type ChecklistRecord,
  type ChecklistSignature,
  type ChecklistSkip,
  type ChecklistVoided,
  type ChecklistWho,
  type StageChecklistKind,
} from '../lib/jobs/checklistDocument'

export type RecordRow = { words: string; sheet: string | null; pick: ChecklistPick; note: string; by: string; at: string; signaturePng: string | null; signedBy: string | null; photo: boolean }
export type SkippedRow = { words: string; by: string; why: string }
export type FiledRecord = ChecklistRecord & { rows: RecordRow[]; skipped?: SkippedRow[] }
type JobStore = { items: ChecklistItem[]; answers: ChecklistAnswer[]; voided: ChecklistVoided[]; skips: ChecklistSkip[]; records: FiledRecord[]; nextRecordNo: number; reopened: Record<string, string> }
type Snapshot = { company: ChecklistItem[]; jobs: Record<string, JobStore> }

const KEY = 'spike.checklistDocuments.v1'
const emptyJob = (): JobStore => ({ items: [], answers: [], voided: [], skips: [], records: [], nextRecordNo: 1, reopened: {} })

/** The stage's live items less the company checks skipped on this job's stage. */
function liveItems(all: ChecklistItem[], skips: ChecklistSkip[], kind: StageChecklistKind, fixtureId: string): ChecklistItem[] {
  const skipped = new Set(skips.filter((s) => s.fixtureId === fixtureId).map((s) => s.itemId))
  return itemsForStage(all, kind, fixtureId).filter((i) => !skipped.has(i.id))
}

function read(): Snapshot {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as Snapshot) : { company: [], jobs: {} }
  } catch {
    return { company: [], jobs: {} }
  }
}
let snapshot: Snapshot = read()
const listeners = new Set<() => void>()
function commit(next: Snapshot) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* the spike's browser storage */
  }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => snapshot
const now = () => new Date().toISOString()
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

function jobOf(s: Snapshot, jobId: string): JobStore {
  // Older stored jobs lack the newer lists; fill them in.
  return { ...emptyJob(), ...(s.jobs[jobId] ?? {}) }
}
function withJob(s: Snapshot, jobId: string, patch: (j: JobStore) => JobStore): Snapshot {
  return { ...s, jobs: { ...s.jobs, [jobId]: patch(jobOf(s, jobId)) } }
}

export type StageState = { filed: FiledRecord | null; open: boolean; versions: FiledRecord[] }

export function useChecklistDocuments(jobId: string) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const job = jobOf(snap, jobId)
  const allItems = useMemo(() => [...snap.company, ...job.items], [snap.company, job.items])
  const answersByFixture = useMemo(() => {
    const m = new Map<string, Map<string, ChecklistAnswer>>()
    for (const a of job.answers) {
      if (!m.has(a.fixtureId)) m.set(a.fixtureId, new Map())
      m.get(a.fixtureId)!.set(a.itemId, a)
    }
    return m
  }, [job.answers])

  const stageItems = useCallback((kind: StageChecklistKind, fixtureId: string) => liveItems(allItems, job.skips, kind, fixtureId), [allItems, job.skips])
  /** The company checks skipped on this job's stage, with who and why. */
  const stageSkipped = useCallback(
    (kind: StageChecklistKind, fixtureId: string) =>
      job.skips.filter((s) => s.fixtureId === fixtureId).map((skip) => ({ skip, item: itemsForStage(allItems, kind, fixtureId).find((i) => i.id === skip.itemId) })).filter((x): x is { skip: ChecklistSkip; item: ChecklistItem } => x.item != null),
    [allItems, job.skips],
  )
  const stageAnswers = useCallback((fixtureId: string) => answersByFixture.get(fixtureId) ?? new Map<string, ChecklistAnswer>(), [answersByFixture])

  /** Filed while the latest record stands and nothing reopened the stage after it. */
  const stageState = useCallback(
    (fixtureId: string): StageState => {
      const versions = job.records.filter((r) => r.fixtureId === fixtureId)
      const latest = versions[versions.length - 1] ?? null
      const reopenedAt = job.reopened[fixtureId] ?? ''
      const filed = latest && reopenedAt < latest.filedAt ? latest : null
      return { filed, open: !filed, versions }
    },
    [job.records, job.reopened],
  )

  const addItem = useCallback((item: Omit<ChecklistItem, 'id' | 'addedAt' | 'retiredAt' | 'retiredBy' | 'retiredWhy' | 'order' | 'why'> & { why?: string | null }) => {
    const pool = item.scope === 'company' ? snapshot.company : jobOf(snapshot, jobId).items
    const order = pool.reduce((m, i) => Math.max(m, i.order ?? 0), 0) + 1
    const row: ChecklistItem = { ...item, why: item.why ?? null, id: uid(), addedAt: now(), retiredAt: null, retiredBy: null, retiredWhy: null, order }
    if (row.scope === 'company') commit({ ...snapshot, company: [...snapshot.company, row] })
    else commit(withJob(snapshot, jobId, (j) => ({ ...j, items: [...j.items, row], reopened: row.fixtureId ? { ...j.reopened, [row.fixtureId]: now() } : j.reopened })))
  }, [jobId])

  /** Takes a check off with who and why; it keeps its answer and reads on the record as retired. */
  const retireItem = useCallback((itemId: string, fixtureId: string | null, who: ChecklistWho, why: string) => {
    const stamp = now()
    const retire = (list: ChecklistItem[]) => list.map((i) => (i.id === itemId ? { ...i, retiredAt: stamp, retiredBy: who.name, retiredWhy: why } : i))
    const next = withJob({ ...snapshot, company: retire(snapshot.company) }, jobId, (j) => ({ ...j, items: retire(j.items), reopened: fixtureId ? { ...j.reopened, [fixtureId]: stamp } : j.reopened }))
    commit(next)
  }, [jobId])

  /** Moves a check up or down among its own scope on its stage (the estimator reads plans in build order). */
  const moveItem = useCallback((itemId: string, dir: 'up' | 'down', kind: StageChecklistKind, fixtureId: string) => {
    const all = [...snapshot.company, ...jobOf(snapshot, jobId).items]
    const me = all.find((i) => i.id === itemId)
    if (!me) return
    const peers = itemsForStage(all, kind, fixtureId).filter((i) => i.scope === me.scope)
    const idx = peers.findIndex((i) => i.id === itemId)
    const swap = peers[dir === 'up' ? idx - 1 : idx + 1]
    if (!swap) return
    const reorder = (list: ChecklistItem[]) => list.map((i) => (i.id === me.id ? { ...i, order: swap.order } : i.id === swap.id ? { ...i, order: me.order } : i))
    commit(withJob({ ...snapshot, company: reorder(snapshot.company) }, jobId, (j) => ({ ...j, items: reorder(j.items) })))
  }, [jobId])

  const putAnswer = useCallback((fixtureId: string, itemId: string, patch: (a: ChecklistAnswer | undefined) => ChecklistAnswer | null) => {
    commit(
      withJob(snapshot, jobId, (j) => {
        const rest = j.answers.filter((a) => !(a.fixtureId === fixtureId && a.itemId === itemId))
        const cur = j.answers.find((a) => a.fixtureId === fixtureId && a.itemId === itemId)
        const next = patch(cur)
        return { ...j, answers: next ? [...rest, next] : rest }
      }),
    )
  }, [jobId])

  const answer = useCallback((fixtureId: string, itemId: string, pick: ChecklistPick, who: ChecklistWho, signature: ChecklistSignature | null = null, note?: string) => {
    putAnswer(fixtureId, itemId, (a) => ({ itemId, fixtureId, pick, note: note ?? a?.note ?? '', by: who.name, at: now(), signature, photoTakenAt: a?.photoTakenAt ?? null }))
  }, [putAnswer])
  const setNote = useCallback((fixtureId: string, itemId: string, note: string) => {
    putAnswer(fixtureId, itemId, (a) => (a ? { ...a, note } : null))
  }, [putAnswer])
  const markPhoto = useCallback((fixtureId: string, itemId: string) => {
    putAnswer(fixtureId, itemId, (a) => (a ? { ...a, photoTakenAt: now() } : null))
  }, [putAnswer])
  /** Takes an answer back. A signed answer keeps its mark as a voided row with who and why; an unsigned one just goes. */
  const takeBack = useCallback((fixtureId: string, itemId: string, who: ChecklistWho, why: string) => {
    const stamp = now()
    commit(
      withJob(snapshot, jobId, (j) => {
        const cur = j.answers.find((a) => a.fixtureId === fixtureId && a.itemId === itemId)
        const voided = cur && cur.signature ? [...j.voided, { answer: cur, by: who.name, at: stamp, why }] : j.voided
        return { ...j, answers: j.answers.filter((a) => !(a.fixtureId === fixtureId && a.itemId === itemId)), voided, reopened: { ...j.reopened, [fixtureId]: stamp } }
      }),
    )
  }, [jobId])
  const stageVoided = useCallback((fixtureId: string) => job.voided.filter((v) => v.answer.fixtureId === fixtureId), [job.voided])

  /** Files the stage when every item is answered: a numbered record with the rows as they stand. */
  const fileIfComplete = useCallback((fixtureId: string, kind: StageChecklistKind): FiledRecord | null => {
    const j = jobOf(snapshot, jobId)
    const all = [...snapshot.company, ...j.items]
    const items = liveItems(all, j.skips, kind, fixtureId)
    const skippedRows: SkippedRow[] = j.skips.filter((s) => s.fixtureId === fixtureId).map((s) => ({ words: all.find((i) => i.id === s.itemId)?.words ?? '', by: s.by, why: s.why })).filter((s) => s.words)
    const answers = new Map(j.answers.filter((a) => a.fixtureId === fixtureId).map((a) => [a.itemId, a]))
    const p = checklistProgress(items, answers)
    if (!p.complete) return null
    const versions = j.records.filter((r) => r.fixtureId === fixtureId)
    const latest = versions[versions.length - 1]
    if (latest && (j.reopened[fixtureId] ?? '') < latest.filedAt) return latest
    const rows: RecordRow[] = items.map((i) => {
      const a = answers.get(i.id)!
      return { words: i.words, sheet: i.sheet ?? null, pick: a.pick, note: a.note, by: a.by, at: a.at, signaturePng: a.signature?.pngDataUrl ?? null, signedBy: a.signature?.printedName ?? null, photo: a.photoTakenAt != null }
    })
    const filedAt = [...answers.values()].map((a) => a.at).sort().pop() ?? now()
    const record: FiledRecord = { fixtureId, version: versions.length + 1, recordNo: j.nextRecordNo, filedAt, answerCount: rows.length, signedCount: rows.filter((r) => r.signedBy).length, rows, skipped: skippedRows }
    commit(withJob(snapshot, jobId, (jj) => ({ ...jj, records: [...jj.records, record], nextRecordNo: jj.nextRecordNo + 1 })))
    return record
  }, [jobId])

  const amend = useCallback((fixtureId: string) => {
    commit(withJob(snapshot, jobId, (j) => ({ ...j, reopened: { ...j.reopened, [fixtureId]: now() } })))
  }, [jobId])

  /** One job check becomes a company check for its kind; on this job it stays where it is, with its answer, as the company's. */
  const promoteItem = useCallback((itemId: string) => {
    const j = jobOf(snapshot, jobId)
    const me = j.items.find((i) => i.id === itemId)
    if (!me) return
    const order = snapshot.company.reduce((m, i) => Math.max(m, i.order ?? 0), 0) + 1
    const asCompany: ChecklistItem = { ...me, scope: 'company', fixtureId: null, order }
    commit({
      ...snapshot,
      company: [...snapshot.company, asCompany],
      jobs: { ...snapshot.jobs, [jobId]: { ...j, items: j.items.filter((i) => i.id !== itemId) } },
    })
  }, [jobId])

  /** A company check that does not apply on this job's stage: skipped with a reason, the company's list untouched. */
  const skipItem = useCallback((itemId: string, fixtureId: string, who: ChecklistWho, why: string) => {
    const stamp = now()
    commit(withJob(snapshot, jobId, (j) => ({ ...j, skips: [...j.skips.filter((s) => !(s.itemId === itemId && s.fixtureId === fixtureId)), { itemId, fixtureId, by: who.name, at: stamp, why }], reopened: { ...j.reopened, [fixtureId]: stamp } })))
  }, [jobId])
  const unskipItem = useCallback((itemId: string, fixtureId: string) => {
    commit(withJob(snapshot, jobId, (j) => ({ ...j, skips: j.skips.filter((s) => !(s.itemId === itemId && s.fixtureId === fixtureId)), reopened: { ...j.reopened, [fixtureId]: now() } })))
  }, [jobId])

  const reset = useCallback(() => commit({ company: [], jobs: {} }), [])

  return { companyItems: snap.company, jobItems: job.items, stageItems, stageSkipped, stageAnswers, stageVoided, stageState, addItem, retireItem, moveItem, answer, setNote, markPhoto, takeBack, fileIfComplete, amend, promoteItem, skipItem, unskipItem, reset }
}

export type ChecklistDocumentsApi = ReturnType<typeof useChecklistDocuments>
