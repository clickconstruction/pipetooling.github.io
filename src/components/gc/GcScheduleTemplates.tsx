/**
 * GC mode, the real build, the schedule's PR 12a: schedule templates (G-44), ported from the GC mode prototype (branch
 * spike/gc-mode, `GcScheduleTemplates.tsx`) with its words; the plan is to-dos/gc-mode/mockups/schedule-pr12.md on that
 * branch. The Templates card on a job being built: save its schedule as a template, and every template with where it
 * came from, the jobs drawn from it, Rename and Set it aside. And Start from a template, which the first draft offers
 * (and the rough while we bid, 12b), with the fit said before anything is drawn. Each press is a callback where the
 * prototype dispatched to its reducer; `templates.ts` works it all out, and nothing here reaches the trades or the
 * customer.
 */
import { useState } from 'react'
import { SCHEDULE_STAGES } from '../../lib/gc/schedule/draft'
import {
  drawnFromWords,
  templateAsideWords,
  templateFitWords,
  templateNameProblem,
  templateSavedWords,
  templateSizeWords,
  templateUsedLines,
} from '../../lib/gc/schedule/templates'
import type { ScheduleTemplate, TemplateLine, TemplateUse } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { PressNote } from './GcScheduleCards'
import { Btn, Card, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const
const STAGE_LABEL = new Map(SCHEDULE_STAGES.map((st) => [st.key, st.label]))

/** On a job being built: save its schedule as a template, and every template there is. Each press is a record. */
export function GcTemplatesCard({
  state,
  project,
  onSave,
  onRename,
  onSetAside,
}: {
  state: GcState
  project: GcProject
  /** Save as a template: its name refused first in the kernel's words (`templateSaveProblem`), then the table's. */
  onSave: (name: string) => Promise<void>
  onRename: (templateId: string, name: string) => Promise<void>
  onSetAside: (templateId: string, aside: boolean) => Promise<void>
}) {
  const [name, setName] = useState(project.name)
  const problem = templateNameProblem(state, name)
  const press = useSchedulePress()
  const templates = [...(state.scheduleTemplates ?? [])].reverse()
  const drawnFrom = project.schedule?.template
  return (
    <Card dataTour="gc-templates">
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
        <strong>Templates</strong>
        <div style={{ color: 'var(--text-600)', display: 'grid', gap: '0.15rem' }}>
          <span>Save this job&apos;s schedule as a template. The next job like it can start from it.</span>
          <span>A template keeps each line&apos;s days, what it waits on, and how many days after them it starts.</span>
          <span>It keeps no dates, companies, percents or moves.</span>
        </div>
        {drawnFrom && <div data-drawn-from>{drawnFromWords(drawnFrom)}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: '1 1 16rem', minWidth: 0 }}>
            <span style={{ color: 'var(--text-muted)' }}>Name</span>
            <input aria-label="The template's name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...box, flex: '1 1 auto', minWidth: 0 }} />
          </label>
          <Btn
            kind="primary"
            disabled={problem !== null || press.busy}
            onClick={() => {
              if (problem) return
              void press.run(() => onSave(name), 'The template did not save.')
            }}
          >
            {press.busy ? 'Saving…' : 'Save as a template'}
          </Btn>
        </div>
        {problem && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{problem}</div>}
        <PressNote refused={press.refused} failed={press.failed} />
        {templates.map((t) => (
          <TemplateRow key={t.id} state={state} template={t} onRename={onRename} onSetAside={onSetAside} />
        ))}
      </div>
    </Card>
  )
}

/** One template: where it came from, its size and stages, the jobs drawn from it, Rename, and Set it aside or Bring it back. */
function TemplateRow({
  state,
  template: t,
  onRename,
  onSetAside,
}: {
  state: GcState
  template: ScheduleTemplate
  onRename: (templateId: string, name: string) => Promise<void>
  onSetAside: (templateId: string, aside: boolean) => Promise<void>
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const press = useSchedulePress()
  const problem = renaming === null ? null : templateNameProblem(state, renaming, t.id)
  const used = templateUsedLines(state, t)
  const aside = templateAsideWords(t)
  return (
    <div data-template={t.id} style={{ display: 'grid', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', opacity: aside ? 0.75 : 1 }}>
      {renaming === null ? (
        <strong>{t.name}</strong>
      ) : (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input aria-label={`A new name for ${t.name}`} value={renaming} onChange={(e) => setRenaming(e.target.value)} style={{ ...box, flex: '1 1 14rem', minWidth: 0 }} />
          <Btn
            kind="primary"
            disabled={problem !== null || press.busy}
            onClick={() => {
              if (problem) return
              const name = renaming
              void press.run(() => onRename(t.id, name), 'The name did not save.').then((saved) => {
                if (saved) setRenaming(null)
              })
            }}
          >
            Save the name
          </Btn>
          <Btn kind="quiet" onClick={() => setRenaming(null)}>
            Cancel
          </Btn>
          {problem && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{problem}</span>}
        </div>
      )}
      <span>{templateSavedWords(t)}</span>
      <span>{templateSizeWords(t)}</span>
      <div aria-label="Its stages, in days" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.4rem' }}>
        {t.stages.map((st) => (
          <span key={st.key} style={{ fontSize: '0.78rem', padding: '0.05rem 0.45rem', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
            {STAGE_LABEL.get(st.key) ?? st.key} {st.days} {st.days === 1 ? 'day' : 'days'}
          </span>
        ))}
      </div>
      {used.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0 0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Drawn from it</span>
          <div style={{ display: 'grid' }}>
            {used.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>No job is drawn from it yet.</span>
      )}
      {aside && <span style={{ color: 'var(--text-muted)' }}>{aside}</span>}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {renaming === null && (
          <Btn kind="quiet" onClick={() => setRenaming(t.name)}>
            Rename
          </Btn>
        )}
        <Btn kind="quiet" disabled={press.busy} onClick={() => void press.run(() => onSetAside(t.id, !t.asideOn), 'The template did not change.')}>
          {t.asideOn ? 'Bring it back' : 'Set it aside'}
        </Btn>
      </div>
      <PressNote refused={press.refused} failed={press.failed} />
    </div>
  )
}

/**
 * Start from a template, beside the usual lengths: the offered templates, and the one a rough was
 * drawn from even once set aside, so the first draft can draw the same way. With one picked, the fit:
 * what it covers here and the weeks it makes, before anything is drawn. Nothing offered: nothing shown.
 */
export function GcTemplatePick({
  project,
  start,
  stageDays,
  offered,
  own,
  value,
  onChange,
  fit = true,
}: {
  project: GcProject
  start: string
  stageDays?: Partial<Record<string, number>>
  offered: ScheduleTemplate[]
  /** The template the job's rough was drawn from, with its copy of the lines. */
  own?: { use: TemplateUse; lines: TemplateLine[] }
  value: string
  onChange: (templateId: string) => void
  /** Say the fit of the one picked. Off where the card already says it. */
  fit?: boolean
}) {
  const choices: { id: string; name: string; lines: TemplateLine[] }[] = [
    ...(own ? [{ id: own.use.id, name: own.use.name, lines: own.lines }] : []),
    ...offered.filter((t) => t.id !== own?.use.id).map((t) => ({ id: t.id, name: t.name, lines: t.lines })),
  ]
  if (choices.length === 0) return null
  const picked = choices.find((c) => c.id === value)
  return (
    <>
      {/* On a phone the select goes under its name, no wider than the card, so a long name never widens the page. */}
      <label style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.4rem', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Start from a template</span>
        <select aria-label="Start from a template" value={picked ? value : ''} onChange={(e) => onChange(e.target.value)} style={{ ...box, flex: '1 1 auto', minWidth: 0, maxWidth: '100%' }}>
          <option value="">No template</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {picked && fit && start && (
        <div data-template-fit style={{ flexBasis: '100%', color: 'var(--text-600)' }}>
          {templateFitWords(picked, project, start, stageDays)}
        </div>
      )}
    </>
  )
}
