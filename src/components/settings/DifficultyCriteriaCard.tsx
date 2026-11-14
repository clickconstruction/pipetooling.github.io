/**
 * Settings → Difficulty criteria (punch list #357, PR 1; dev only): the criteria a GC is rated on, versioned.
 *
 * The card reads every version. The published one is drawn as the GC will meet it (`DifficultyScalesPicker`, read
 * only). **Start a draft** copies it; the draft is edited scale by scale and rung by rung, every press one pure
 * operation of `difficultyEditor.ts`, saved with **Save the draft**, and **Publish version N** flips it after a confirm
 * that lists every change. The rules a body must keep (`difficultyCriteriaProblems`) are listed over the publish press,
 * which stays dead while any stands. **Preview the GC card** draws the draft as the card will. A published version is
 * never changed: a rating and a priced bid pin to it.
 *
 * A scale's key carries a GC's pick from one version to the next, so a key the published version has is locked.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  DIFFICULTY_SCOPE_WORDS,
  DIFFICULTY_SOURCE_WORDS,
  difficultyCriteriaProblems,
  difficultyMaxPoints,
  difficultyPointsWords,
  difficultyVersionWords,
  type DifficultyCriteriaBody,
  type DifficultyScale,
} from '../../lib/bids/difficultyCriteria'
import {
  addDifficultyRung,
  addDifficultyScale,
  diffDifficultyCriteria,
  difficultyChangeCountWords,
  difficultyKeyIsLocked,
  difficultyPreviewPicks,
  moveDifficultyScale,
  removeDifficultyRung,
  removeDifficultyScale,
  setDifficultyRungPoints,
  setDifficultyRungSentence,
  setDifficultyScaleKey,
  setDifficultyScaleMax,
  setDifficultyScaleName,
  setDifficultyScaleScope,
  setDifficultyScaleSource,
  startDifficultyDraft,
} from '../../lib/bids/difficultyEditor'
import { draftDifficultyCriteria, publishedDifficultyCriteria, supabaseDifficultyCriteriaIo, type DifficultyCriteriaIo, type DifficultyCriteriaVersion } from '../../lib/bids/difficultyCriteriaIo'
import { DIFFICULTY_CRITERIA_WORDS } from '../../lib/bids/difficultyCriteriaWords'
import { formatErrorMessage } from '../../utils/errorHandling'
import ConfirmDialog from '../ConfirmDialog'
import DifficultyScalesPicker from '../bids/DifficultyScalesPicker'


const W = DIFFICULTY_CRITERIA_WORDS
const DEFAULT_IO = supabaseDifficultyCriteriaIo()

const CARD: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)', display: 'grid', gap: '0.9rem' }
const TITLE: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const BAR: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.8rem', background: 'var(--bg-subtle)' }
const CHIP: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, height: 36, padding: '0 0.75rem', cursor: 'pointer' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }
const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.35rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box' }
const SCALE_BOX: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.6rem' }
const ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }
const MONO: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }
const PROBLEMS: CSSProperties = { margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', display: 'grid', gap: '0.2rem' }

function bluePress(dead: boolean): CSSProperties {
  return { ...PRESS, height: 44, padding: '0 1.1rem', border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }
}

export function DifficultyCriteriaCard({ io = DEFAULT_IO }: { io?: DifficultyCriteriaIo }) {
  const { showToast } = useToastContext()
  const [versions, setVersions] = useState<DifficultyCriteriaVersion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DifficultyCriteriaBody | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await io.loadVersions()
      setVersions(rows)
      setLoadError(null)
      const d = draftDifficultyCriteria(rows)
      setDraft(d ? d.body : null)
      setDraftNote(d ? d.note : '')
      setDirty(false)
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'The criteria could not be read.'))
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  const published = useMemo(() => (versions ? publishedDifficultyCriteria(versions) : null), [versions])
  const draftRow = useMemo(() => (versions ? draftDifficultyCriteria(versions) : null), [versions])
  const nextVersion = (published?.version ?? 0) + 1
  const changes = useMemo(() => (draft ? diffDifficultyCriteria(published?.body ?? null, draft) : []), [draft, published])
  const problems = useMemo(() => (draft ? difficultyCriteriaProblems(draft) : []), [draft])

  const edit = (next: DifficultyCriteriaBody) => {
    setDraft(next)
    setDirty(true)
  }

  const startDraft = () => {
    setDraft(startDifficultyDraft(published?.body ?? null))
    setDraftNote('')
    setDirty(true)
  }

  const saveDraft = async (): Promise<string | null> => {
    if (!draft) return null
    setSaving(true)
    try {
      const row = await io.saveDraft(draftRow?.id ?? null, draft, draftNote)
      setVersions((v) => {
        const rest = (v ?? []).filter((x) => x.status !== 'draft')
        return [row, ...rest]
      })
      setDirty(false)
      showToast(W.saved, 'success')
      return row.id
    } catch (e) {
      showToast(formatErrorMessage(e, 'The draft was not saved.'), 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    setConfirm(null)
    if (!draft || problems.length > 0) return
    setSaving(true)
    try {
      const id = dirty || !draftRow ? await (async () => {
        const row = await io.saveDraft(draftRow?.id ?? null, draft, draftNote)
        return row.id
      })() : draftRow.id
      const row = await io.publish(id)
      showToast(W.published(row.version), 'success')
      await load()
      setPreview(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The version was not published.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const discard = async () => {
    setConfirm(null)
    setSaving(true)
    try {
      if (draftRow) await io.discardDraft(draftRow.id)
      await load()
      setDraft(null)
      setDraftNote('')
      setDirty(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The draft was not discarded.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const shown = draft ?? published?.body ?? null
  const canPublish = draft != null && problems.length === 0 && changes.length > 0 && !saving

  return (
    <section style={CARD} aria-labelledby="settings-difficulty-criteria-title" data-testid="difficulty-criteria-card" id="settings-difficulty-criteria-card">
      <div>
        <h3 id="settings-difficulty-criteria-title" style={TITLE}>{W.title}</h3>
        <p style={MUTED}>{W.lead}</p>
      </div>

      {versions == null && loadError == null ? <p style={MUTED}>{W.loading}</p> : null}
      {loadError ? (
        <p style={{ ...MUTED, color: 'var(--text-amber-800)' }} role="alert">
          {loadError} <button type="button" style={QUIET} onClick={() => void load()}>Try again</button>
        </p>
      ) : null}

      {versions != null ? (
        <div style={BAR} data-testid="difficulty-criteria-bar">
          {published ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Published: {difficultyVersionWords(published)}</span>
              <span style={MUTED}>{published.note || `${published.body.scales.length} scales, ${difficultyPointsWords(difficultyMaxPoints(published.body))} at most`}</span>
            </>
          ) : (
            <span style={MUTED}>{W.noPublished}</span>
          )}
          <span style={{ flexGrow: 1 }} />
          {draft ? (
            <span style={CHIP} data-testid="difficulty-draft-chip">
              Draft of version {nextVersion} · {difficultyChangeCountWords(changes.length)}
              {dirty ? ' · not saved' : ''}
            </span>
          ) : (
            <button type="button" style={PRESS} onClick={startDraft} disabled={saving}>
              {W.startDraft}
            </button>
          )}
          {versions.length > 0 ? (
            <button type="button" style={QUIET} onClick={() => setShowVersions((v) => !v)} aria-expanded={showVersions}>
              {W.everyVersion}
            </button>
          ) : null}
        </div>
      ) : null}

      {showVersions && versions ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="difficulty-versions-list">
          {versions.map((v) => (
            <li key={v.id}>
              {v.status === 'draft' ? `Draft of version ${nextVersion}` : difficultyVersionWords(v)}
              {' · '}
              {v.body.scales.length} scale{v.body.scales.length === 1 ? '' : 's'}, {difficultyPointsWords(difficultyMaxPoints(v.body))} at most
              {v.note ? <span style={{ color: 'var(--text-muted)' }}> · {v.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {draft ? (
        <DraftEditor draft={draft} published={published?.body ?? null} saving={saving} onEdit={edit} note={draftNote} onNote={(n) => { setDraftNote(n); setDirty(true) }} />
      ) : published ? (
        <DifficultyScalesPicker body={published.body} picks={{}} readOnly groupName="published" />
      ) : null}

      {draft && problems.length > 0 ? (
        <ul style={PROBLEMS} data-testid="difficulty-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      {draft && changes.length > 0 ? (
        <details data-testid="difficulty-changes">
          <summary style={{ fontSize: '0.8125rem', color: 'var(--text-base)', cursor: 'pointer' }}>{difficultyChangeCountWords(changes.length)} against version {published?.version ?? 0}</summary>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-base)', display: 'grid', gap: '0.15rem' }}>
            {changes.map((c, i) => (
              <li key={`${c.key}-${i}`}>{c.line}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {draft && preview && shown ? (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '0.9rem', display: 'grid', gap: '0.6rem' }} data-testid="difficulty-preview">
          <p style={MUTED}>The GC&rsquo;s card, as this draft would draw it. The picks here are a sample and save nothing.</p>
          <DifficultyScalesPicker body={draft} picks={difficultyPreviewPicks(draft)} readOnly groupName="preview" />
        </div>
      ) : null}

      {draft ? (
        <div style={{ ...ROW, borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
          <p style={{ ...MUTED, maxWidth: 560 }}>{W.footer}</p>
          <span style={{ flexGrow: 1 }} />
          <button type="button" style={QUIET} onClick={() => setConfirm('discard')} disabled={saving}>
            {W.discardDraft}
          </button>
          <button type="button" style={PRESS} onClick={() => setPreview((p) => !p)}>
            {preview ? W.hidePreview : W.preview}
          </button>
          <button type="button" style={PRESS} onClick={() => void saveDraft()} disabled={saving || !dirty}>
            {W.saveDraft}
          </button>
          <button type="button" style={bluePress(!canPublish)} onClick={() => setConfirm('publish')} disabled={!canPublish} aria-disabled={!canPublish}>
            {W.publish(nextVersion)}
          </button>
        </div>
      ) : null}

      {confirm === 'publish' ? (
        <ConfirmDialog
          title={W.publishTitle(nextVersion)}
          body={`${changes.map((c) => c.line).join(' ')} ${W.publishBody}`}
          confirmLabel={W.publish(nextVersion)}
          onConfirm={() => void publish()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'discard' ? <ConfirmDialog title={W.discardTitle} body={W.discardBody} confirmLabel={W.discardConfirm} onConfirm={() => void discard()} onCancel={() => setConfirm(null)} /> : null}
    </section>
  )
}

function DraftEditor({
  draft,
  published,
  saving,
  onEdit,
  note,
  onNote,
}: {
  draft: DifficultyCriteriaBody
  published: DifficultyCriteriaBody | null
  saving: boolean
  onEdit: (next: DifficultyCriteriaBody) => void
  note: string
  onNote: (note: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="difficulty-draft-editor">
      <div style={ROW}>
        <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Scales</span>
        <span style={MUTED}>A scale&rsquo;s key carries a rating from one version to the next. Its words and points are yours.</span>
        <span style={{ flexGrow: 1 }} />
        <button type="button" style={PRESS} onClick={() => onEdit(addDifficultyScale(draft))} disabled={saving}>
          {W.addScale}
        </button>
      </div>
      {draft.scales.map((s, i) => (
        <ScaleEditor key={`${s.key}-${i}`} scale={s} index={i} count={draft.scales.length} locked={difficultyKeyIsLocked(published, s.key)} draft={draft} saving={saving} onEdit={onEdit} />
      ))}
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        A note on this version, for the list of versions
        <input type="text" style={INPUT} value={note} maxLength={400} onChange={(e) => onNote(e.target.value)} placeholder="What changed and why" aria-label="Version note" />
      </label>
    </div>
  )
}

function ScaleEditor({
  scale: s,
  index,
  count,
  locked,
  draft,
  saving,
  onEdit,
}: {
  scale: DifficultyScale
  index: number
  count: number
  locked: boolean
  draft: DifficultyCriteriaBody
  saving: boolean
  onEdit: (next: DifficultyCriteriaBody) => void
}) {
  const label = s.name.trim() || s.key
  return (
    <div style={SCALE_BOX} data-difficulty-scale-editor={s.key}>
      <div style={ROW}>
        <input type="text" style={{ ...INPUT, fontWeight: 600, width: 240 }} value={s.name} maxLength={60} placeholder="Scale name" aria-label={`Name of scale ${index + 1}`} onChange={(e) => onEdit(setDifficultyScaleName(draft, s.key, e.target.value))} />
        <span style={MONO}>key</span>
        <input
          type="text"
          style={{ ...INPUT, ...MONO, width: 130, color: 'var(--text-base)' }}
          value={s.key}
          readOnly={locked}
          title={locked ? W.keyLocked : undefined}
          aria-label={`Key of ${label}`}
          onChange={(e) => onEdit(setDifficultyScaleKey(draft, s.key, e.target.value))}
        />
        <select style={INPUT} value={s.source} aria-label={`Source of ${label}`} onChange={(e) => onEdit(setDifficultyScaleSource(draft, s.key, e.target.value === 'bills' ? 'bills' : 'picked'))}>
          <option value="picked">{DIFFICULTY_SOURCE_WORDS.picked}</option>
          <option value="bills">{DIFFICULTY_SOURCE_WORDS.bills}</option>
        </select>
        <select style={INPUT} value={s.scope} aria-label={`Scope of ${label}`} onChange={(e) => onEdit(setDifficultyScaleScope(draft, s.key, e.target.value === 'bid' ? 'bid' : 'gc'))}>
          <option value="gc">{DIFFICULTY_SCOPE_WORDS.gc}</option>
          <option value="bid">{DIFFICULTY_SCOPE_WORDS.bid}</option>
        </select>
        <span style={{ flexGrow: 1 }} />
        <span style={MUTED}>0 to {s.max}</span>
        <button type="button" style={QUIET} onClick={() => onEdit(moveDifficultyScale(draft, s.key, -1))} disabled={saving || index === 0} aria-label={`Move ${label} up`}>
          ↑
        </button>
        <button type="button" style={QUIET} onClick={() => onEdit(moveDifficultyScale(draft, s.key, 1))} disabled={saving || index === count - 1} aria-label={`Move ${label} down`}>
          ↓
        </button>
        <button type="button" style={QUIET} onClick={() => onEdit(removeDifficultyScale(draft, s.key))} disabled={saving} aria-label={`Remove the scale ${label}`}>
          {W.removeScale}
        </button>
      </div>
      {s.source === 'bills' && s.rungs.length === 0 ? (
        <label style={{ ...ROW, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Most points this scale gives
          <input type="number" min={1} max={10} style={{ ...INPUT, width: 70, textAlign: 'right' }} value={s.max} aria-label={`Maximum of ${label}`} onChange={(e) => onEdit(setDifficultyScaleMax(draft, s.key, Number(e.target.value)))} />
          <span>The rule that gives them lives on the Bid Board&rsquo;s price list.</span>
        </label>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: '0.4rem 0.6rem', alignItems: 'center' }}>
        {s.rungs.map((r, j) => (
          <RungRow key={j} scaleKey={s.key} label={label} index={j} points={r.points} sentence={r.sentence} draft={draft} saving={saving} onEdit={onEdit} />
        ))}
      </div>
      <div>
        <button type="button" style={PRESS} onClick={() => onEdit(addDifficultyRung(draft, s.key))} disabled={saving}>
          {W.addRung}
        </button>
      </div>
    </div>
  )
}

function RungRow({ scaleKey, label, index, points, sentence, draft, saving, onEdit }: { scaleKey: string; label: string; index: number; points: number; sentence: string; draft: DifficultyCriteriaBody; saving: boolean; onEdit: (next: DifficultyCriteriaBody) => void }) {
  return (
    <>
      <input
        type="number"
        min={0}
        max={10}
        style={{ ...INPUT, fontWeight: 700, textAlign: 'right' }}
        value={points}
        aria-label={`Points of ${label} rung ${index + 1}`}
        onChange={(e) => onEdit(setDifficultyRungPoints(draft, scaleKey, index, Number(e.target.value)))}
      />
      <input type="text" style={INPUT} value={sentence} maxLength={200} placeholder="The sentence a person picks" aria-label={`Sentence of ${label} rung ${index + 1}`} onChange={(e) => onEdit(setDifficultyRungSentence(draft, scaleKey, index, e.target.value))} />
      <button type="button" style={QUIET} onClick={() => onEdit(removeDifficultyRung(draft, scaleKey, index))} disabled={saving} aria-label={`Remove ${label} rung ${index + 1}`}>
        {W.removeRung}
      </button>
    </>
  )
}

export default DifficultyCriteriaCard
