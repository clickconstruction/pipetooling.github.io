/**
 * GC mode, the schedule builder's Templates page (punch list #204, PR 3; the mock-up's D1 and D2): the Templates
 * pill on GC projects. The list of every template's current version with its kind, rows, phases, weeks, who
 * saved it and the jobs drawn from it; New template, From a job's schedule and a kind filter over it; and the
 * editor, phases and rows with no dates, where every press is a pure change on the draft (`templateEditor.ts`)
 * and Save makes a new version (the owner's call 2). The presses go through `io`, so a test hands in its own.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { emptyWords } from '../../lib/emptyWords'
import {
  addPhase,
  addRow,
  daysAreWords,
  emptyTemplateDraft,
  gapOf,
  movePhase,
  moveRow,
  moveRowToPhase,
  phaseRemoveProblem,
  removePhase,
  removeRow,
  renamePhase,
  rowIndexesOf,
  rowWaitChoices,
  setRowWaits,
  templateDraftOf,
  templateDraftPhases,
  templateDraftProblem,
  templateDraftWords,
  templateSaveBody,
  updateRow,
  whoWords,
  type TemplateDraft,
  type TemplateSaveBody,
} from '../../lib/gc/schedule/templateEditor'
import { templateListRows, templateNameProblem, templateSaveProblem, templateVersion, type TemplateListRow } from '../../lib/gc/schedule/templates'
import type { ScheduleTemplate, TemplateWho } from '../../lib/gc/schedule/types'
import type { GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { PressNote } from './GcScheduleCards'
import { Btn, Card, Chip, Why, input, num, td, th } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

/** The page's reads and writes, so a test hands in its own. */
export interface TemplatesIo {
  /** Every template the signed-in person may read, oldest first. */
  load(): Promise<ScheduleTemplate[]>
  /** A template saved as a new row, or a new version of `versionOf`. Returns the new id. */
  save(body: TemplateSaveBody, versionOf: string | null): Promise<string>
  /** A job's schedule saved as a template with its rows (From a job's schedule). Returns the new id. */
  saveFromJob(state: GcState, projectId: string, name: string): Promise<string>
  rename(templateId: string, name: string): Promise<void>
  setAside(templateId: string, aside: boolean): Promise<void>
}

const box: CSSProperties = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' }
const cell: CSSProperties = { ...td, padding: '0.3rem 0.4rem' }
const numCell: CSSProperties = { ...num, padding: '0.3rem 0.4rem' }

/** A who as the select keeps it, and back. */
function whoValue(who: TemplateWho): string {
  return who.kind === 'trade' ? `trade:${who.trade}` : who.kind
}
function whoFromValue(value: string): TemplateWho {
  if (value === 'us') return { kind: 'us' }
  if (value.startsWith('trade:')) return { kind: 'trade', trade: value.slice('trade:'.length) }
  return { kind: 'office' }
}

/** The page: the list, or one template open in the editor. */
export function GcTemplatesPage({ state, trades, io, openAt = null }: { state: GcState; trades: string[]; io: TemplatesIo; openAt?: string | null }) {
  const [templates, setTemplates] = useState<ScheduleTemplate[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ draft: TemplateDraft; versionOf: string | null } | null>(null)
  const [opened, setOpened] = useState<string | null>(openAt)
  const full = useMemo<GcState>(() => ({ ...state, scheduleTemplates: templates ?? [] }), [state, templates])
  const load = async () => {
    try {
      setTemplates(await io.load())
      setProblem(null)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The templates did not load.'))
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [io])
  // A template to open on arrival (`?view=templates&template=<id>`), once the list is read.
  useEffect(() => {
    if (!opened || !templates) return
    const t = templates.find((x) => x.id === opened)
    setOpened(null)
    if (t) setEditing({ draft: templateDraftOf(t), versionOf: t.id })
  }, [opened, templates])
  const current = editing?.versionOf ? (templates ?? []).find((t) => t.id === editing.versionOf) ?? null : null
  if (editing) {
    return (
      <TemplateEditor
        state={full}
        trades={trades}
        draft={editing.draft}
        template={current}
        onChange={(draft) => setEditing({ draft, versionOf: editing.versionOf })}
        onSaved={async (id) => {
          await load()
          setOpened(id)
          setEditing(null)
        }}
        onChanged={load}
        onBack={() => setEditing(null)}
        io={io}
      />
    )
  }
  return (
    <TemplateList
      state={full}
      templates={templates}
      problem={problem}
      onOpen={(t) => setEditing({ draft: templateDraftOf(t), versionOf: t.id })}
      onNew={() => setEditing({ draft: emptyTemplateDraft(), versionOf: null })}
      onSavedFromJob={async (id) => {
        await load()
        setOpened(id)
      }}
      io={io}
    />
  )
}

// ---------------------------------------------------------------------------------------------
// D1: the list
// ---------------------------------------------------------------------------------------------

function TemplateList({
  state,
  templates,
  problem,
  onOpen,
  onNew,
  onSavedFromJob,
  io,
}: {
  state: GcState
  templates: ScheduleTemplate[] | null
  problem: string | null
  onOpen: (t: ScheduleTemplate) => void
  onNew: () => void
  onSavedFromJob: (id: string) => Promise<void>
  io: TemplatesIo
}) {
  const [kind, setKind] = useState('')
  const [fromJob, setFromJob] = useState<{ projectId: string; name: string } | null>(null)
  const press = useSchedulePress()
  const rows = templateListRows(state)
  const kinds = [...new Set(rows.map((r) => r.template.kind).filter((k): k is string => !!k))].sort()
  const shown = kind ? rows.filter((r) => r.template.kind === kind) : rows
  // From a job's schedule: a job being built with a schedule drawn.
  const jobs = state.projects.filter((p) => p.stage === 'building' && p.schedule)
  const fromProject = fromJob ? state.projects.find((p) => p.id === fromJob.projectId) ?? null : null
  const fromProblem = fromJob && fromProject ? templateSaveProblem(state, fromProject, fromJob.name) : fromJob ? 'Pick a job.' : null
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <Why>
        A template is a whole job&apos;s schedule with no dates: its phases, its rows, who does each, its days and what each waits on. Put it on a job with a start day.
      </Why>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" onClick={onNew} disabled={templates === null}>
          New template
        </Btn>
        <Btn kind="plain" onClick={() => setFromJob(fromJob ? null : { projectId: jobs[0]?.id ?? '', name: jobs[0]?.name ?? '' })} disabled={templates === null}>
          From a job&apos;s schedule
        </Btn>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Kind</span>
          <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} style={box}>
            <option value="">Every kind</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      {fromJob && (
        <Card>
          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
            <strong>From a job&apos;s schedule</strong>
            <span style={{ color: 'var(--text-600)' }}>The job&apos;s schedule as rows: its trades&apos; lines, our own, the office&apos;s work, its inspections and its dates to meet, with the stage as the phase.</span>
            {jobs.length === 0 ? (
              <EmptyState compact main="No job being built has a schedule drawn yet." next={{ label: 'New template', onPress: onNew }} tail="makes one from nothing." />
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select aria-label="The job" value={fromJob.projectId} onChange={(e) => setFromJob({ projectId: e.target.value, name: jobs.find((j) => j.id === e.target.value)?.name ?? fromJob.name })} style={box}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
                <input aria-label="The template's name" value={fromJob.name} onChange={(e) => setFromJob({ ...fromJob, name: e.target.value })} style={{ ...box, flex: '1 1 14rem', minWidth: 0 }} />
                <Btn
                  kind="primary"
                  disabled={fromProblem !== null || press.busy}
                  onClick={() => {
                    if (fromProblem) return
                    void press.run(() => io.saveFromJob(state, fromJob.projectId, fromJob.name).then(onSavedFromJob), 'The template did not save.').then((ok) => {
                      if (ok) setFromJob(null)
                    })
                  }}
                >
                  {press.busy ? 'Saving…' : 'Save as a template'}
                </Btn>
                <Btn kind="quiet" onClick={() => setFromJob(null)}>
                  Cancel
                </Btn>
              </div>
            )}
            {fromProblem && jobs.length > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fromProblem}</span>}
            <PressNote refused={press.refused} failed={press.failed} />
          </div>
        </Card>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
      {templates === null && !problem ? (
        <span style={{ color: 'var(--text-muted)' }}>Reading the templates…</span>
      ) : rows.length === 0 ? (
        <EmptyState {...emptyWords({ kind: 'make', noun: 'templates', control: 'New template' })} next={{ label: 'New template', onPress: onNew }} />
      ) : shown.length === 0 ? (
        <EmptyState compact {...emptyWords({ kind: 'filter', noun: 'templates', query: '' })} next={{ label: 'Every kind', onPress: () => setKind('') }} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Template</th>
                <th style={th}>Kind</th>
                <th style={{ ...th, textAlign: 'right' }}>Rows</th>
                <th style={{ ...th, textAlign: 'right' }}>Phases</th>
                <th style={{ ...th, textAlign: 'right' }}>Weeks</th>
                <th style={th}>Saved</th>
                <th style={th}>Drawn from it</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <ListRow key={r.template.id} row={r} onOpen={() => onOpen(r.template)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>A save makes a new version. The jobs drawn from an older one keep what they drew. Set aside keeps a template off the pick.</span>
    </div>
  )
}

function ListRow({ row: r, onOpen }: { row: TemplateListRow; onOpen: () => void }) {
  return (
    <tr data-template={r.template.id} style={{ opacity: r.aside ? 0.7 : 1 }}>
      <td style={td}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{r.template.name}</strong>
          <Chip tone="grey" small>
            {r.versionWords}
          </Chip>
          {r.aside && (
            <Chip tone="amber" small>
              set aside
            </Chip>
          )}
        </div>
      </td>
      <td style={td}>{r.kind}</td>
      <td style={num}>{r.rows}</td>
      <td style={num}>{r.phases}</td>
      <td style={num}>{r.weeks}</td>
      <td style={td}>{r.saved}</td>
      <td style={td}>{r.drawnFrom.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Drawn on no job yet.</span> : r.drawnFrom.map((line) => <div key={line}>{line}</div>)}</td>
      <td style={td}>
        <Btn kind="quiet" onClick={onOpen}>
          Open
        </Btn>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------------------------
// D2: the editor
// ---------------------------------------------------------------------------------------------

function TemplateEditor({
  state,
  trades,
  draft,
  template,
  onChange,
  onSaved,
  onChanged,
  onBack,
  io,
}: {
  state: GcState
  trades: string[]
  draft: TemplateDraft
  /** The version open, or null for a new template. */
  template: ScheduleTemplate | null
  onChange: (draft: TemplateDraft) => void
  onSaved: (id: string) => Promise<void>
  /** Renamed or set aside: the list reads again. */
  onChanged: () => Promise<void>
  onBack: () => void
  io: TemplatesIo
}) {
  const press = useSchedulePress()
  const prompt = usePromptDialog()
  const [menu, setMenu] = useState<number | null>(null)
  const [nameProblem, setNameProblem] = useState<string | null>(null)
  const version = template ? templateVersion(state, template) : 0
  const problem = templateDraftProblem(draft, state, template?.id)
  const phases = templateDraftPhases(draft)
  const whoChoices = [...new Set([...trades, ...draft.rows.flatMap((r) => (r.who.kind === 'trade' ? [r.who.trade] : []))])].sort((a, b) => a.localeCompare(b))
  const phaseName = new Map(draft.phases.map((p) => [p.key, p.name]))
  const addPhasePress = async () => {
    const name = await prompt({ message: "The new phase's name?", confirmLabel: 'Add the phase' })
    if (name !== null && name !== undefined) onChange(addPhase(draft, name))
  }
  const renamePress = async () => {
    if (!template) return
    const name = await prompt({ message: `A new name for ${template.name}?`, confirmLabel: 'Save the name', defaultValue: template.name })
    if (name === null || name === undefined) return
    const taken = templateNameProblem(state, name, template.id)
    setNameProblem(taken)
    if (taken) return
    const ok = await press.run(() => io.rename(template.id, name), 'The name did not save.')
    if (ok) {
      onChange({ ...draft, name })
      await onChanged()
    }
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onBack}>
          ← Templates
        </Btn>
        <input aria-label="The template's name" placeholder="The template's name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} style={{ ...box, flex: '1 1 16rem', minWidth: 0, fontWeight: 600 }} />
        {template && (
          <Chip tone="grey" small>
            version {version}
          </Chip>
        )}
        {template?.asideOn && (
          <Chip tone="amber" small>
            set aside
          </Chip>
        )}
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Kind</span>
          <input aria-label="Kind" value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value })} style={{ ...box, width: '9rem' }} />
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Days are</span>
          <select aria-label="Days are" value={draft.workingDays ? 'working' : 'every'} onChange={(e) => onChange({ ...draft, workingDays: e.target.value === 'working' })} style={box}>
            <option value="working">{daysAreWords(true)}</option>
            <option value="every">{daysAreWords(false)}</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="plain" onClick={() => void addPhasePress()}>
          Add a phase
        </Btn>
        <Btn kind="plain" onClick={() => onChange(addRow(draft, draft.phases[draft.phases.length - 1]?.key ?? ''))} disabled={draft.phases.length === 0} title={draft.phases.length === 0 ? 'Add a phase first.' : undefined}>
          Add a row
        </Btn>
        <span data-draft-words style={{ color: 'var(--text-600)', fontSize: '0.875rem' }}>
          {templateDraftWords(draft)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {template && (
            <>
              <Btn kind="quiet" onClick={() => void renamePress()} disabled={press.busy}>
                Rename
              </Btn>
              <Btn
                kind="quiet"
                disabled={press.busy}
                onClick={() =>
                  void press.run(() => io.setAside(template.id, !template.asideOn), 'The template did not change.').then((ok) => {
                    if (ok) void onChanged()
                  })
                }
              >
                {template.asideOn ? 'Bring it back' : 'Set it aside'}
              </Btn>
            </>
          )}
          <Btn
            kind="primary"
            disabled={problem !== null || press.busy}
            title={problem ?? undefined}
            onClick={() => {
              if (problem) return
              void press.run(() => io.save(templateSaveBody(draft, state.today), template?.id ?? null).then(onSaved), 'The template did not save.')
            }}
          >
            {press.busy ? 'Saving…' : template ? `Save as version ${version + 1}` : 'Save the template'}
          </Btn>
        </div>
      </div>
      {problem && (
        <span data-draft-problem style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {problem}
        </span>
      )}
      {nameProblem && (
        <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {nameProblem}
        </span>
      )}
      <PressNote refused={press.refused} failed={press.failed} />
      {draft.phases.length === 0 ? (
        <EmptyState compact main="No phases yet. Add a phase ▸ starts the first." next={{ label: 'Add a phase', onPress: () => void addPhasePress() }} tail="then Add a row puts rows in it." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '2rem' }}>#</th>
                <th style={th}>Row</th>
                <th style={th}>Who</th>
                <th style={{ ...th, textAlign: 'right' }}>Days</th>
                <th style={th}>Waits on</th>
                <th style={{ ...th, textAlign: 'right' }}>Gap</th>
                <th style={th}>Milestone</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {draft.phases.map((p, pi) => {
                const head = phases[pi]
                const own = rowIndexesOf(draft, p.key)
                const removeProblem = phaseRemoveProblem(draft, p.key)
                return [
                  <tr key={`phase-${p.key}`} data-phase={p.key} style={{ background: 'var(--bg-muted)' }}>
                    <td style={cell} />
                    <td style={cell} colSpan={2}>
                      <input aria-label={`The name of phase ${pi + 1}`} value={p.name} onChange={(e) => onChange(renamePhase(draft, p.key, e.target.value))} style={{ ...box, width: '100%', fontWeight: 600 }} />
                    </td>
                    <td style={numCell}>{head?.days ?? 0}</td>
                    <td style={cell} colSpan={3}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {own.length === 1 ? '1 row' : `${own.length} rows`}
                        {head && head.milestones > 0 ? `, ${head.milestones === 1 ? '1 milestone' : `${head.milestones} milestones`}` : ''}
                      </span>
                    </td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      <Btn kind="quiet" onClick={() => onChange(addRow(draft, p.key))}>
                        Add a row
                      </Btn>
                      <Btn kind="quiet" onClick={() => onChange(movePhase(draft, p.key, 'up'))} disabled={pi === 0} title="Move the phase up">
                        ↑
                      </Btn>
                      <Btn kind="quiet" onClick={() => onChange(movePhase(draft, p.key, 'down'))} disabled={pi === draft.phases.length - 1} title="Move the phase down">
                        ↓
                      </Btn>
                      <Btn kind="quiet" onClick={() => onChange(removePhase(draft, p.key))} disabled={removeProblem !== null} title={removeProblem ?? 'Take the phase off'}>
                        Take it off
                      </Btn>
                    </td>
                  </tr>,
                  ...own.map((i, k) => {
                    const row = draft.rows[i]
                    if (!row) return null
                    const choices = rowWaitChoices(draft, i)
                    const first = row.after[0]
                    return (
                      <tr key={`row-${i}`} data-row={i}>
                        <td style={{ ...numCell, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={cell}>
                          <input aria-label={`Row ${k + 1} in ${p.name}`} placeholder="What is done" value={row.label} onChange={(e) => onChange(updateRow(draft, i, { label: e.target.value }))} style={{ ...box, width: '100%', minWidth: '12rem' }} />
                        </td>
                        <td style={cell}>
                          <select aria-label={`Who does row ${k + 1} in ${p.name}`} value={whoValue(row.who)} onChange={(e) => onChange(updateRow(draft, i, { who: whoFromValue(e.target.value) }))} style={box}>
                            <option value="office">{whoWords({ kind: 'office' })}</option>
                            <option value="us">{whoWords({ kind: 'us' })}</option>
                            {whoChoices.map((t) => (
                              <option key={t} value={`trade:${t}`}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={numCell}>
                          <input aria-label={`Days of row ${k + 1} in ${p.name}`} type="number" min={1} value={row.milestone ? 1 : row.days} disabled={row.milestone} onChange={(e) => onChange(updateRow(draft, i, { days: Number(e.target.value) }))} style={{ ...box, width: '4.5rem', textAlign: 'right' }} />
                        </td>
                        <td style={cell}>
                          <select
                            aria-label={`What row ${k + 1} in ${p.name} waits on`}
                            value={first?.row ?? ''}
                            onChange={(e) => onChange(setRowWaits(draft, i, e.target.value ? [{ row: e.target.value, gap: gapOf(row) }, ...row.after.slice(1)] : row.after.slice(1)))}
                            style={{ ...box, maxWidth: '18rem' }}
                          >
                            <option value="">the start day</option>
                            {choices.map((c) => (
                              <option key={c.ref} value={c.ref}>
                                {c.words}
                              </option>
                            ))}
                          </select>
                          {row.after.length > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.3rem' }}>and {row.after.length - 1} more</span>}
                        </td>
                        <td style={numCell}>
                          <input
                            aria-label={`Gap after what row ${k + 1} in ${p.name} waits on`}
                            type="number"
                            min={0}
                            value={gapOf(row)}
                            disabled={!first}
                            onChange={(e) => onChange(setRowWaits(draft, i, first ? [{ row: first.row, gap: Math.max(0, Number(e.target.value)) }, ...row.after.slice(1)] : []))}
                            style={{ ...box, width: '4rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={cell}>
                          <input aria-label={`Row ${k + 1} in ${p.name} is a milestone`} type="checkbox" checked={row.milestone} onChange={(e) => onChange(updateRow(draft, i, { milestone: e.target.checked, ...(e.target.checked ? { days: 1 } : {}) }))} />
                        </td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          {menu === i ? (
                            <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}>
                              <Btn kind="quiet" onClick={() => onChange(moveRow(draft, i, 'up'))} disabled={k === 0} title="Move up">
                                ↑
                              </Btn>
                              <Btn kind="quiet" onClick={() => onChange(moveRow(draft, i, 'down'))} disabled={k === own.length - 1} title="Move down">
                                ↓
                              </Btn>
                              <select
                                aria-label={`Move row ${k + 1} in ${p.name} to another phase`}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) onChange(moveRowToPhase(draft, i, e.target.value))
                                  setMenu(null)
                                }}
                                style={box}
                              >
                                <option value="">Move to…</option>
                                {draft.phases
                                  .filter((q) => q.key !== p.key)
                                  .map((q) => (
                                    <option key={q.key} value={q.key}>
                                      {phaseName.get(q.key) ?? q.key}
                                    </option>
                                  ))}
                              </select>
                              <Btn
                                kind="quiet"
                                onClick={() => {
                                  onChange(removeRow(draft, i))
                                  setMenu(null)
                                }}
                              >
                                Take it off
                              </Btn>
                              <Btn kind="quiet" onClick={() => setMenu(null)}>
                                Done
                              </Btn>
                            </span>
                          ) : (
                            <Btn kind="quiet" onClick={() => setMenu(i)} title="Move up, move down, move to another phase, take it off">
                              ⋯
                            </Btn>
                          )}
                        </td>
                      </tr>
                    )
                  }),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.15rem 0.6rem', color: 'var(--text-600)', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Who</span>
        <span>A trade from the scope book&apos;s list, Us for our own crew, or Office for work nobody is hired for. A company is never named here.</span>
        <span style={{ color: 'var(--text-muted)' }}>Days</span>
        <span>Working days, Monday to Friday, when the template says so. A phase&apos;s days are read from its rows.</span>
        <span style={{ color: 'var(--text-muted)' }}>Waits on</span>
        <span>Another row, finish to start, with a gap in days. A row with nothing to wait on starts on the start day.</span>
        <span style={{ color: 'var(--text-muted)' }}>Milestone</span>
        <span>A one-day row that is a date to meet. On the job it is a milestone, and the trades see it.</span>
      </div>
    </div>
  )
}

