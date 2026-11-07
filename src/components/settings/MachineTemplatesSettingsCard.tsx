/**
 * Settings → Jobs, bills and liens → Machine templates (punch list #270, PR 6): where the office keeps a kind of machine at
 * a size, Small excavator, Skid steer, Directional drill, with the gauges its check sheet draws and the questions its
 * walk asks, plus the questions every machine gets and the short leaving check. A machine on the fleet board picks a
 * template and reads these until it keeps its own gauges. The io is injected so the render smoke runs over a fake.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { MACHINE_KIND_WORDS, newId, type LevelDef, type MachineKind, type MachineQuestion } from '../../lib/machines/machines'
import type { MachineTemplate } from '../../lib/machines/machinesIo'
import { supabaseTemplatesIo, type TemplatesIo } from '../../lib/machines/templatesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GaugeListEditor } from '../machines/GaugeListEditor'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const DEFAULT_IO = supabaseTemplatesIo()
const QUESTION_MAX = 200

const cardStyle: CSSProperties = { padding: '1rem', display: 'grid', gap: '0.75rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }
const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', margin: 0 }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto', gap: '0.4rem 0.5rem', alignItems: 'center' }
const smallBtn: CSSProperties = { ...clauseButtonStyle, padding: '0.25rem 0.5rem', fontSize: '0.8rem' }
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: '1.4rem', textAlign: 'right' }
const tab: CSSProperties = { ...clauseButtonStyle, padding: '0.3rem 0.6rem', fontSize: '0.85rem' }
const tabOn: CSSProperties = { ...tab, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }

interface QuestionDraft {
  id: string | null
  key: string
  words: string
  holdsMachine: boolean
  when: MachineQuestion['when']
}

function draftsOf(questions: readonly MachineQuestion[], templateId: string | null, when?: MachineQuestion['when']): QuestionDraft[] {
  return questions
    .filter((q) => q.templateId === templateId && q.machineId === null && (when ? q.when === when : q.when !== 'post'))
    .map((q) => ({ id: q.id, key: q.id, words: q.words, holdsMachine: q.holdsMachine, when: q.when }))
}

type Pick = { kind: 'all' } | { kind: 'post' } | { kind: 'template'; id: string } | { kind: 'new' }

export function MachineTemplatesSettingsCard({ io = DEFAULT_IO }: { io?: TemplatesIo }) {
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<MachineTemplate[] | null>(null)
  const [questions, setQuestions] = useState<MachineQuestion[]>([])
  const [pick, setPick] = useState<Pick>({ kind: 'all' })
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setTemplates(r.templates)
        setQuestions(r.questions)
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'The machine templates did not read.')),
    )
    return () => {
      live = false
    }
  }, [io, rev])

  async function run(fn: () => Promise<void>, done: string) {
    setSaving(true)
    setProblem(null)
    try {
      await fn()
      showToast(done, 'success')
      setRev((r) => r + 1)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'That did not save.'))
    } finally {
      setSaving(false)
    }
  }

  const current = pick.kind === 'template' ? (templates?.find((t) => t.id === pick.id) ?? null) : null

  return (
    <section style={cardStyle} data-machine-templates>
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Machine templates</h3>
        <p style={muted}>A kind of machine at a size, with the gauges its check draws and the questions its walk asks. A machine on the fleet board picks one. Every machine also gets the walk on the first tab and the leaving check on the second.</p>
      </div>
      {templates ? (
        <>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="tablist" aria-label="Which list">
            <button type="button" role="tab" aria-selected={pick.kind === 'all'} style={pick.kind === 'all' ? tabOn : tab} onClick={() => setPick({ kind: 'all' })}>
              Every machine’s walk
            </button>
            <button type="button" role="tab" aria-selected={pick.kind === 'post'} style={pick.kind === 'post' ? tabOn : tab} onClick={() => setPick({ kind: 'post' })}>
              The leaving check
            </button>
            {templates.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={pick.kind === 'template' && pick.id === t.id} style={pick.kind === 'template' && pick.id === t.id ? tabOn : tab} onClick={() => setPick({ kind: 'template', id: t.id })}>
                {t.name}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={pick.kind === 'new'} style={pick.kind === 'new' ? tabOn : tab} onClick={() => setPick({ kind: 'new' })}>
              + New template
            </button>
          </div>
          {pick.kind === 'all' ? (
            <QuestionsEditor key="all" title="The walk every machine gets" line="Asked on every machine's morning walk, before its template's own questions." drafts={draftsOf(questions, null)} when="pre" saving={saving} onSave={(rows) => void run(() => io.saveQuestions(null, rows), 'The walk is saved.')} />
          ) : pick.kind === 'post' ? (
            <QuestionsEditor key="post" title="The leaving check" line="Short on purpose: only what using the machine changes. The gauges, the hours and where it is tonight are asked after these." drafts={draftsOf(questions, null, 'post')} when="post" saving={saving} onSave={(rows) => void run(() => io.saveQuestions(null, rows), 'The leaving check is saved.')} />
          ) : pick.kind === 'new' ? (
            <TemplateEditor key="new" template={null} questions={[]} sort={(templates[templates.length - 1]?.sort ?? 0) + 10} saving={saving} onSave={(t, rows) => void run(async () => { const id = await io.saveTemplate(t); await io.saveQuestions(id, rows); setPick({ kind: 'template', id }) }, 'The template is saved.')} />
          ) : current ? (
            <TemplateEditor key={current.id} template={current} questions={draftsOf(questions, current.id)} sort={current.sort} saving={saving} onSave={(t, rows) => void run(async () => { await io.saveTemplate(t); await io.saveQuestions(current.id, rows) }, `${t.name} is saved.`)} onRetire={() => void run(async () => { await io.retireTemplate(current.id); setPick({ kind: 'all' }) }, `${current.name} is off the list.`)} />
          ) : null}
        </>
      ) : (
        !problem && <p style={muted}>Loading the machine templates…</p>
      )}
      {problem ? (
        <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </span>
      ) : null}
    </section>
  )
}

function TemplateEditor({ template, questions, sort, saving, onSave, onRetire }: { template: MachineTemplate | null; questions: QuestionDraft[]; sort: number; saving: boolean; onSave: (t: { id: string | null; name: string; kind: MachineKind; size: MachineTemplate['size']; levels: LevelDef[]; sort: number }, rows: QuestionDraft[]) => void; onRetire?: () => void }) {
  const [name, setName] = useState(template?.name ?? '')
  const [kind, setKind] = useState<MachineKind>(template?.kind ?? 'excavator')
  const [size, setSize] = useState<MachineTemplate['size']>(template?.size ?? null)
  const [levels, setLevels] = useState<LevelDef[]>(template?.levels ?? [])
  const [rows, setRows] = useState<QuestionDraft[]>(questions)
  const clean = rows.filter((r) => r.words.trim())
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-template-editor={template?.id ?? 'new'}>
      <fieldset style={box}>
        <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>{template ? template.name : 'A new template'}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Small excavator" aria-label="Template name" style={clauseInputStyle} maxLength={80} />
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as MachineKind)} aria-label="Kind" style={clauseInputStyle}>
              {(Object.keys(MACHINE_KIND_WORDS) as MachineKind[]).map((k) => (
                <option key={k} value={k}>
                  {MACHINE_KIND_WORDS[k]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Size
            <select value={size ?? ''} onChange={(e) => setSize((e.target.value || null) as MachineTemplate['size'])} aria-label="Size" style={clauseInputStyle}>
              <option value="">one size</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset style={box}>
        <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>Gauges</legend>
        <p style={muted}>Drawn on the check sheet the way they look on the machine. A machine can keep its own list instead.</p>
        <GaugeListEditor levels={levels} onChange={setLevels} disabled={saving} />
      </fieldset>
      <QuestionRows title="This kind’s own questions" line="Asked after every machine's walk, on this kind alone." rows={rows} onChange={setRows} saving={saving} when="pre" />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={saving || !name.trim()} style={!saving && name.trim() ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }} onClick={() => onSave({ id: template?.id ?? null, name, kind, size, levels, sort }, clean)}>
          {saving ? 'Saving…' : template ? `Save ${template.name}` : 'Add the template'}
        </button>
        {template && onRetire ? (
          <button type="button" style={clauseButtonStyle} disabled={saving} onClick={onRetire}>
            Take it off the list
          </button>
        ) : null}
      </div>
    </div>
  )
}

function QuestionsEditor({ title, line, drafts, when, saving, onSave }: { title: string; line: string; drafts: QuestionDraft[]; when: MachineQuestion['when']; saving: boolean; onSave: (rows: QuestionDraft[]) => void }) {
  const [rows, setRows] = useState<QuestionDraft[]>(drafts)
  const clean = rows.filter((r) => r.words.trim())
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <QuestionRows title={title} line={line} rows={rows} onChange={setRows} saving={saving} when={when} />
      <div>
        <button type="button" disabled={saving} style={!saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }} onClick={() => onSave(clean)}>
          {saving ? 'Saving…' : `Save ${clean.length} question${clean.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}

function QuestionRows({ title, line, rows, onChange, saving, when }: { title: string; line: string; rows: QuestionDraft[]; onChange: (rows: QuestionDraft[]) => void; saving: boolean; when: MachineQuestion['when'] }) {
  function patch(key: string, change: Partial<QuestionDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)))
  }
  function move(key: string, by: -1 | 1) {
    const i = rows.findIndex((r) => r.key === key)
    const j = i + by
    if (i < 0 || j < 0 || j >= rows.length) return
    const next = [...rows]
    const [r] = next.splice(i, 1)
    next.splice(j, 0, r!)
    onChange(next)
  }
  return (
    <fieldset style={box} data-question-rows={rows.length}>
      <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>{title}</legend>
      <p style={muted}>{line} A No on a question that holds the machine keeps it from running until Dispatch says otherwise.</p>
      {rows.length === 0 ? <p style={muted}>No questions yet. Add one puts the first.</p> : null}
      {rows.map((r, i) => (
        <div key={r.key} style={row}>
          <span style={num}>{i + 1}.</span>
          <input value={r.words} disabled={saving} onChange={(e) => patch(r.key, { words: e.target.value })} aria-label={`Question ${i + 1}`} placeholder="The question, as a statement the crew checks" style={clauseInputStyle} maxLength={QUESTION_MAX} />
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={r.holdsMachine} disabled={saving} onChange={(e) => patch(r.key, { holdsMachine: e.target.checked })} /> a No holds it
          </label>
          <span style={{ display: 'inline-flex', gap: '0.2rem' }}>
            <button type="button" style={smallBtn} disabled={saving || i === 0} onClick={() => move(r.key, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" style={smallBtn} disabled={saving || i === rows.length - 1} onClick={() => move(r.key, 1)} aria-label="Move down">
              ↓
            </button>
          </span>
          <button type="button" style={smallBtn} disabled={saving} onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
            Take off
          </button>
        </div>
      ))}
      <div>
        <button type="button" style={clauseButtonStyle} disabled={saving} onClick={() => onChange([...rows, { id: null, key: newId('q'), words: '', holdsMachine: false, when }])}>
          Add one
        </button>
      </div>
    </fieldset>
  )
}

export default MachineTemplatesSettingsCard
