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
import { Link, useInRouterContext } from 'react-router-dom'
import { templatesHref } from '../../lib/gc/links'
import { rowsFit, rowsFitLines, templateRows } from '../../lib/gc/schedule/builder'
import { drawnFromWords, templateFitWords, templateNameProblem } from '../../lib/gc/schedule/templates'
import type { ScheduleTemplate, TemplateLine, TemplateUse } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { PressNote } from './GcScheduleCards'
import { Btn, Card, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

/** A link to another page of the app: the router's where there is one, else a plain anchor (the Schedule window's tests render with none). */
function PageLink({ to, children }: { to: string; children: string }) {
  const inRouter = useInRouterContext()
  return inRouter ? (
    <Link to={to} style={{ color: 'var(--text-link)' }}>
      {children}
    </Link>
  ) : (
    <a href={to} style={{ color: 'var(--text-link)' }}>
      {children}
    </a>
  )
}

/** What a template with rows makes of this job before the draw (#204, D3): the six labelled lines of `rowsFitLines`. */
function RowsFit({ project, start, template, stageDays }: { project: GcProject; start: string; template: ScheduleTemplate; stageDays?: Partial<Record<string, number>> }) {
  const fit = rowsFit(project, start, templateRows(template), stageDays)
  if (!fit) return <span>Nothing to draw from it. Pick another template.</span>
  return (
    <div data-rows-fit style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.1rem 0.6rem' }}>
      {rowsFitLines(fit).map((line) => (
        <span key={line.label} style={{ display: 'contents' }}>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{line.label}</span>
          <span>{line.words}</span>
        </span>
      ))}
    </div>
  )
}

/** On a job being built: save its schedule as a template, with its rows (#204), and the door to the Templates page. The press is a record. */
export function GcTemplatesCard({
  state,
  project,
  onSave,
}: {
  state: GcState
  project: GcProject
  /** Save as a template: its name refused first in the kernel's words (`templateSaveProblem`), then the table's. */
  onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(project.name)
  const problem = templateNameProblem(state, name)
  const press = useSchedulePress()
  const drawnFrom = project.schedule?.template
  return (
    <Card dataTour="gc-templates">
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
        <strong>Templates</strong>
        <div style={{ color: 'var(--text-600)', display: 'grid', gap: '0.15rem' }}>
          <span>Save this job&apos;s schedule as a template. The next job like it can start from it.</span>
          <span>A template keeps the schedule as phases and rows: each row&apos;s days, who does it and what it waits on.</span>
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
        <span style={{ color: 'var(--text-600)' }}>
          Every template is on the Templates page, where it is changed and saved as a new version.{' '}
          <PageLink to={templatesHref()}>Open the Templates page</PageLink>
        </span>
      </div>
    </Card>
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
  const choices: { id: string; name: string; lines: TemplateLine[]; rows?: ScheduleTemplate }[] = [
    ...(own ? [{ id: own.use.id, name: own.use.name, lines: own.lines }] : []),
    ...offered.filter((t) => t.id !== own?.use.id).map((t) => ({ id: t.id, name: t.name, lines: t.lines, ...(t.rows ? { rows: t } : {}) })),
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
          {picked.rows ? <RowsFit project={project} start={start} template={picked.rows} stageDays={stageDays} /> : templateFitWords(picked, project, start, stageDays)}
        </div>
      )}
    </>
  )
}
