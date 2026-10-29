/**
 * Settings → Jobs & billing → Stage checklists (punch list #164, PR 2): where the office keeps the company's questions
 * for Rough In, Top Out and Trim Set. The crew answers them on the phone for each stage of a job, and a stage reads not
 * ready on the Pipeline until every question is answered. The card ships with the three kinds listed and empty, by the
 * owner's call: he writes the words himself. The rules are `lib/jobs/stageChecklistEditor.ts`; the io is injected so the
 * render smoke runs over a fake.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { emptyWordsWithPress, emptyWords } from '../../lib/emptyWords'
import { QUESTION_MAX_CHARS, STAGE_CHECKLIST_KIND_NAMES, STAGE_CHECKLIST_KINDS, type StageChecklistKind, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import {
  ADD_QUESTION,
  EDITOR_INTRO,
  EDITOR_RULE,
  EDITOR_TITLE,
  NOT_SAVED,
  SAVE_QUESTIONS,
  SAVED_TOAST,
  cleanDrafts,
  draftsOf,
  editorProblem,
  kindSummary,
  moveDraft,
  sameDrafts,
  type QuestionDraft,
} from '../../lib/jobs/stageChecklistEditor'
import { supabaseStageChecklistEditorIo, type StageChecklistEditorIo } from '../../lib/jobs/stageChecklistIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const DEFAULT_IO = supabaseStageChecklistEditorIo()

const cardStyle: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }
const kindBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', margin: 0 }
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.4rem 0.5rem', alignItems: 'center' }
const smallBtn: CSSProperties = { ...clauseButtonStyle, padding: '0.25rem 0.5rem', fontSize: '0.8rem' }
const numStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: '1.4rem', textAlign: 'right' }

type Drafts = Record<StageChecklistKind, QuestionDraft[]>

function draftsFrom(questions: readonly StageChecklistQuestion[]): Drafts {
  return { rough_in: draftsOf(questions, 'rough_in'), top_out: draftsOf(questions, 'top_out'), trim_set: draftsOf(questions, 'trim_set') }
}

export function StageChecklistSettingsCard({ io = DEFAULT_IO }: { io?: StageChecklistEditorIo }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<StageChecklistQuestion[] | null>(null)
  const [drafts, setDrafts] = useState<Drafts | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (q) => {
        if (!live) return
        setLoaded(q)
        setDrafts(draftsFrom(q))
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'The stage checklists did not read.')),
    )
    return () => {
      live = false
    }
  }, [io])

  const saved = useMemo(() => (loaded ? draftsFrom(loaded) : null), [loaded])
  const changedKinds = useMemo(
    () => (drafts && saved ? STAGE_CHECKLIST_KINDS.filter((k) => !sameDrafts(cleanDrafts(drafts[k]), saved[k])) : []),
    [drafts, saved],
  )
  const changed = changedKinds.length > 0

  const setKind = (kind: StageChecklistKind, next: QuestionDraft[]) => setDrafts((d) => (d ? { ...d, [kind]: next } : d))
  const setRow = (kind: StageChecklistKind, i: number, patch: Partial<QuestionDraft>) =>
    setDrafts((d) => (d ? { ...d, [kind]: d[kind].map((q, j) => (j === i ? { ...q, ...patch } : q)) } : d))

  const save = async () => {
    if (!drafts || !loaded) return
    for (const kind of changedKinds) {
      const stop = editorProblem(kind, drafts[kind])
      if (stop) {
        setProblem(stop)
        return
      }
    }
    setSaving(true)
    setProblem(null)
    try {
      for (const kind of changedKinds) await io.save(kind, loaded, cleanDrafts(drafts[kind]), user?.id ?? null)
      const again = await io.load()
      setLoaded(again)
      setDrafts(draftsFrom(again))
      showToast(SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(`${NOT_SAVED} ${formatErrorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="stage-checklists-title" data-settings-stage-checklists style={cardStyle}>
      <h3 id="stage-checklists-title" style={{ margin: 0, fontSize: '1rem' }}>
        {EDITOR_TITLE}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{EDITOR_INTRO}</p>
      <p style={muted}>{EDITOR_RULE}</p>
      {drafts ? (
        STAGE_CHECKLIST_KINDS.map((kind) => {
          const rows = drafts[kind]
          const name = STAGE_CHECKLIST_KIND_NAMES[kind]
          const add = () => setKind(kind, [...rows, { id: null, words: '', asksPhoto: false }])
          return (
            <fieldset key={kind} data-settings-stage-kind={kind} style={kindBox}>
              <legend style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0 0.25rem' }}>
                {name}
                {kindSummary(rows) ? <span style={{ ...muted, display: 'inline', marginLeft: '0.5rem', fontWeight: 400 }}>{kindSummary(rows)}</span> : null}
              </legend>
              {rows.length === 0 ? (
                <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: `questions for ${name}`, control: ADD_QUESTION }), { onPress: add })} />
              ) : (
                rows.map((q, i) => (
                  <div key={q.id ?? `new-${i}`} data-stage-question style={rowStyle}>
                    <span style={numStyle}>{i + 1}.</span>
                    <input
                      type="text"
                      aria-label={`${name}: question ${i + 1}`}
                      value={q.words}
                      maxLength={QUESTION_MAX_CHARS}
                      placeholder="Type the question the crew answers"
                      disabled={saving}
                      onChange={(e) => setRow(kind, i, { words: e.target.value })}
                      style={{ ...clauseInputStyle, width: '100%' }}
                    />
                    <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={q.asksPhoto} disabled={saving} onChange={(e) => setRow(kind, i, { asksPhoto: e.target.checked })} aria-label={`${name}: question ${i + 1} asks for a photo`} />
                        Asks for a photo
                      </label>
                      <button type="button" style={smallBtn} disabled={saving || i === 0} aria-label={`${name}: move question ${i + 1} up`} onClick={() => setKind(kind, moveDraft(rows, i, -1))}>
                        ↑
                      </button>
                      <button type="button" style={smallBtn} disabled={saving || i === rows.length - 1} aria-label={`${name}: move question ${i + 1} down`} onClick={() => setKind(kind, moveDraft(rows, i, 1))}>
                        ↓
                      </button>
                      <button type="button" style={smallBtn} disabled={saving} aria-label={`${name}: take question ${i + 1} off`} onClick={() => setKind(kind, rows.filter((_, j) => j !== i))}>
                        Take off
                      </button>
                    </span>
                  </div>
                ))
              )}
              {rows.length > 0 ? (
                <div>
                  <button type="button" style={clauseButtonStyle} disabled={saving} onClick={add}>
                    {ADD_QUESTION}
                  </button>
                </div>
              ) : null}
            </fieldset>
          )
        })
      ) : (
        !problem && <p style={muted}>Loading the stage checklists…</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void save()} disabled={!changed || saving} style={changed && !saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
          {saving ? 'Saving…' : SAVE_QUESTIONS}
        </button>
        {changed && !saving && saved ? (
          <button
            type="button"
            onClick={() => {
              setDrafts(saved)
              setProblem(null)
            }}
            style={clauseButtonStyle}
          >
            Put them back
          </button>
        ) : null}
        {problem ? (
          <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {problem}
          </span>
        ) : null}
      </div>
    </section>
  )
}

export default StageChecklistSettingsCard
