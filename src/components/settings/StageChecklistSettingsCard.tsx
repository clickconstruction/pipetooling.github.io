/**
 * Settings → Jobs, bills and liens → Stage checklists (punch list #164, PR 2; read-only since punch list #237, PR 4): the
 * company's questions for Rough In, Top Out and Trim Set, read back from where they are written now, a job's Documents
 * tab. Each kind lists its live questions in order with their asks and a source line that says which job each came from
 * or who wrote it, and folds the questions taken off the company's list with who, when and why. Nothing here is pressed;
 * the card points at the Documents tab and goes in a later release. The words are `lib/jobs/stageChecklistEditor.ts`;
 * the io is injected so the render smoke runs over a fake.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { STAGE_CHECKLIST_KIND_NAMES, STAGE_CHECKLIST_KINDS } from '../../lib/jobs/stageChecklist'
import { EDITOR_TITLE, MIRROR_DOOR, MIRROR_INTRO, MIRROR_RULE, companyQuestionsOf, emptyKindWords, kindSummary, questionTags, sourceLineWords, takenOffLineWords, takenOffSummary, type CompanyMirror } from '../../lib/jobs/stageChecklistEditor'
import { supabaseStageChecklistMirrorIo, type StageChecklistMirrorIo } from '../../lib/jobs/stageChecklistIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'

const DEFAULT_IO = supabaseStageChecklistMirrorIo()

const cardStyle: CSSProperties = { padding: '1rem', display: 'grid', gap: '0.75rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }
const kindBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', margin: 0 }
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.15rem 0.5rem', alignItems: 'start' }
const numStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: '1.4rem', textAlign: 'right' }
const tag: CSSProperties = { display: 'inline-block', marginLeft: '0.4rem', padding: '0.05rem 0.4rem', borderRadius: 999, fontSize: '0.7rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', verticalAlign: 'middle' }
const sourceLine: CSSProperties = { ...muted, fontSize: '0.8rem' }

export function StageChecklistSettingsCard({ io = DEFAULT_IO }: { io?: StageChecklistMirrorIo }) {
  const [mirror, setMirror] = useState<CompanyMirror | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    io.load().then(
      (m) => live && setMirror(m),
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'The stage checklists did not read.')),
    )
    return () => {
      live = false
    }
  }, [io])

  return (
    <section aria-label={EDITOR_TITLE} data-settings-stage-checklists style={cardStyle}>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{MIRROR_INTRO}</p>
      <p style={muted}>{MIRROR_RULE}</p>
      {mirror ? (
        STAGE_CHECKLIST_KINDS.map((kind) => {
          const rows = companyQuestionsOf(mirror.questions, kind)
          const gone = mirror.takenOff.filter((t) => t.kind === kind)
          const name = STAGE_CHECKLIST_KIND_NAMES[kind]
          return (
            <fieldset key={kind} data-settings-stage-kind={kind} style={kindBox}>
              <legend style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0 0.25rem' }}>
                {name}
                {kindSummary(rows) ? <span style={{ ...muted, display: 'inline', marginLeft: '0.5rem', fontWeight: 400 }}>{kindSummary(rows)}</span> : null}
              </legend>
              {rows.length === 0 ? (
                <EmptyState compact main={emptyKindWords(kind)} next={{ label: 'Jobs', to: '/jobs' }} tail={`is where they are written. ${MIRROR_DOOR}`} />
              ) : (
                rows.map((q, i) => (
                  <div key={q.id} data-stage-question style={rowStyle}>
                    <span style={numStyle}>{i + 1}.</span>
                    <div style={{ minWidth: 0 }}>
                      <span>{q.words}</span>
                      {questionTags(q).map((t) => (
                        <span key={t} style={tag}>
                          {t}
                        </span>
                      ))}
                      <div style={sourceLine} data-stage-question-source>
                        {sourceLineWords(mirror.sources.get(q.id))}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {gone.length > 0 ? (
                <details data-settings-stage-taken-off>
                  <summary style={{ ...muted, cursor: 'pointer' }}>{takenOffSummary(gone.length)}</summary>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.2rem' }}>
                    {gone.map((t) => (
                      <li key={t.id} style={sourceLine}>
                        {takenOffLineWords(t)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </fieldset>
          )
        })
      ) : (
        !problem && <p style={muted}>Loading the stage checklists…</p>
      )}
      {problem ? (
        <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </span>
      ) : null}
    </section>
  )
}

export default StageChecklistSettingsCard
