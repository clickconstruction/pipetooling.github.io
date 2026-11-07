/**
 * The Development page's Plans look by part (punch list #239, PR 3). One row per part of the site: what it
 * builds from today with Open ↗, the date on the sheets, the day it came, the memo, the jobs that name the
 * part, and the older sets folded under a count with *Build from this set*; our as-builts under the row.
 * Under the table, the only two things left for a person: the parts with no set and the jobs that build from
 * plans and follow none yet, as chips that open their lists (a job that bills only or a service call is left out
 * of the count and named under the chips with its reason, v2.6351), with **Ask the estimators about the N**;
 * **+ Part** names a new part; **+ New
 * set** on a row adds a set through the one form (`PlanSetForm`). Bids keep their own pinned sets and are
 * listed as such. A job's empty Plans folder is no longer a set, and no job can be "on an older set".
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { JobChip } from './JobChip'
import { asBuiltLineWords, defaultSetName, emptyNewSetDraft, newSetDraftProblem, setLineWords, shortDayWords, type NewSetDraft, type PlanSetRow } from '../../lib/plans/planSets'
import { olderSetsFor, orderForPicking, sitePlansAskCount, sitePlansChipWords, sitePlansLeftOutWords, type SiteCarrier, type SitePartRow, type SitePlansView } from '../../lib/plans/sitePlans'
import { plansAskLine, type PlansAsk } from '../../lib/developments/plans'
import { EmptyState } from '../EmptyState'
import { partTimeline, setRowDayWords, setRowLineWords, timelineEntryFor } from '../../lib/plans/planSets'
import { PlanSetChangesLine } from '../plans/PlanSetChangesLine'
import { PlanSetForm } from '../plans/PlanSetForm'
import { Chip, LinkButton, shortDay, SmallButton } from './developmentPageBits'
import { countedLabel } from '../../lib/batchWords'
import { buildPapersView, kindLabel, paperChipWords, paperLineWords, partsToMoveTo, type Paper } from '../../lib/papers/papers'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { DEVELOPMENT_PHONE_QUERY } from './DevelopmentJumpStrip'

export type SitePlansWrites = {
  addPart: (name: string) => Promise<boolean>
  addSet: (partId: string, draft: NewSetDraft, makeCurrent: boolean, replacesSetId: string | null) => Promise<boolean>
  buildFrom: (partId: string, setId: string) => Promise<boolean>
  removeSet: (setId: string) => Promise<boolean>
  /** What changed from the set before it, written on a set already on the part (v2.6356). */
  writeChanges: (setId: string, changes: string) => Promise<boolean>
  /** Many jobs onto one part in one press (the Gun Dog spike, 2026-11-02); true when any took it. */
  putJobsOnPart: (partId: string, jobIds: string[]) => Promise<boolean>
  /** A paper onto another part of the site (v2.6632): the set it went with stays behind, and the History gets the line. */
  movePaper: (paper: Paper, toPartId: string) => Promise<boolean>
  /** A paper off its part (v2.6632), as the job's Papers section takes one off. */
  removePaper: (setId: string) => Promise<boolean>
}

const th: CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }
const td: CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: '12rem' }

export function DevelopmentPartsCard({
  view,
  names,
  canWrite,
  openCarrier,
  askAbout,
  askOnRecord,
  openQuestions,
  writes,
  papers,
}: {
  /** Null while the parts read. */
  view: SitePlansView | null
  /** The papers on the site's parts, with their asks resolved; undefined hides the column. */
  papers?: ReadonlyArray<Paper>
  names: Record<string, string>
  canWrite: boolean
  openCarrier: (c: SiteCarrier) => void
  askAbout: (count: number) => void
  askOnRecord?: PlansAsk | null
  openQuestions?: () => void
  writes?: SitePlansWrites
}) {
  const [openChip, setOpenChip] = useState<'noSet' | 'noPart' | null>(null)
  const [openOlder, setOpenOlder] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<{ partId: string; draft: NewSetDraft } | null>(null)
  const [partName, setPartName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [openPapers, setOpenPapers] = useState<Record<string, boolean>>({})
  // The paper being moved to another part (v2.6632) and the part picked for it.
  const [moving, setMoving] = useState<{ paperId: string; toPartId: string } | null>(null)
  // The papers on the site's parts (the papers train): the column draws only when the page hands them in.
  const hasPapers = papers !== undefined
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  // The jobs ticked for a part and the part picked, under the *N jobs follow no plans yet* chip.
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [partForJobs, setPartForJobs] = useState<string>('')

  if (!view) return <p style={{ ...muted, margin: 0 }}>Reading the plans…</p>

  const run = async (act: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    const ok = await act()
    setBusy(false)
    if (ok) {
      setForm(null)
      setPartName(null)
      setPendingRemove(null)
      setMoving(null)
    }
  }
  const saveChanges = async (setId: string, changes: string): Promise<boolean> => {
    if (!writes || busy) return false
    setBusy(true)
    setProblem(null)
    const ok = await writes.writeChanges(setId, changes)
    setBusy(false)
    return ok
  }
  const openSetForm = (row: SitePartRow) => {
    const kind = row.current ? 'addendum' : 'issued'
    const draft = emptyNewSetDraft(kind)
    const existing = [...row.older, ...(row.current ? [row.current] : []), ...row.asBuilts]
    draft.name = defaultSetName(kind, existing)
    setProblem(null)
    setForm({ partId: row.part.id, draft })
  }
  const addSet = (row: SitePartRow, draft: NewSetDraft, makeCurrent: boolean) => {
    const p = newSetDraftProblem(draft)
    if (p) {
      setProblem(p)
      return
    }
    void run(() => writes!.addSet(row.part.id, draft, makeCurrent, makeCurrent && row.current ? row.current.id : null))
  }
  const chips = sitePlansChipWords(view)
  const leftOut = sitePlansLeftOutWords(view)
  const askCount = sitePlansAskCount(view)
  const carriers = (list: SiteCarrier[]) => (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {list.map((c) =>
        c.kind === 'job' ? (
          <JobChip key={`${c.kind}:${c.id}`} jobId={c.id} onOpen={() => openCarrier(c)}>
            {c.label}
          </JobChip>
        ) : (
          <LinkButton key={`${c.kind}:${c.id}`} onClick={() => openCarrier(c)}>
            {c.label}
          </LinkButton>
        ),
      )}
    </span>
  )
  const openLink = (s: Pick<PlanSetRow, 'link'>) =>
    s.link ? (
      <LinkButton onClick={() => openInExternalBrowser(s.link)} nowrap>
        Open ↗
      </LinkButton>
    ) : (
      <span style={muted}>link still to come</span>
    )
  // A paper kept on the wrong part (v2.6632): **Move to…** names another part of the site and moves the paper there, the set it
  // went with left behind; **×** takes it off, as the job's Papers section does. The one door when no job names the part.
  const paperPresses = (p: Paper, row: SitePartRow): ReactNode => {
    if (!canWrite || !writes) return null
    const others = partsToMoveTo(view.parts.map((r) => r.part), row.part.id)
    if (moving?.paperId === p.id) {
      const to = moving.toPartId
      return (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-testid={`site-paper-move-${p.id}`}>
          <select aria-label={`Move ${p.name} to`} value={to} onChange={(e) => setMoving({ paperId: p.id, toPartId: e.target.value })} disabled={busy} style={{ ...input, minWidth: '9rem' }}>
            <option value="">on which part…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <SmallButton onClick={() => void run(() => writes.movePaper(p, to))} disabled={busy || !to} primary>
            Move it
          </SmallButton>
          <LinkButton onClick={() => setMoving(null)} nowrap>
            Leave it
          </LinkButton>
        </span>
      )
    }
    if (pendingRemove === p.id) {
      return (
        <>
          <LinkButton onClick={() => void run(() => writes.removePaper(p.id))} nowrap>
            Remove
          </LinkButton>
          <LinkButton onClick={() => setPendingRemove(null)} nowrap>
            Keep
          </LinkButton>
        </>
      )
    }
    return (
      <>
        {others.length ? (
          <LinkButton
            onClick={() => {
              setProblem(null)
              setMoving({ paperId: p.id, toPartId: '' })
            }}
            nowrap
          >
            Move to…
          </LinkButton>
        ) : null}
        <button type="button" aria-label={`Remove ${p.name}`} disabled={busy} onClick={() => setPendingRemove(p.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', font: 'inherit' }}>
          ×
        </button>
      </>
    )
  }
  const removePress = (s: PlanSetRow) =>
    canWrite && writes ? (
      pendingRemove === s.id ? (
        <>
          <LinkButton onClick={() => void run(() => writes.removeSet(s.id))} nowrap>
            Remove
          </LinkButton>
          <LinkButton onClick={() => setPendingRemove(null)} nowrap>
            Keep
          </LinkButton>
        </>
      ) : (
        <button type="button" aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => setPendingRemove(s.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', font: 'inherit' }}>
          ×
        </button>
      )
    ) : null

  // One column as wide as the box and never wider: an auto column grows to its widest child's min-content, and on a
  // phone the all-good chip below is 356 px of nowrap words in a 329 px column, so every card ended 4 px past the screen (v2.6442).
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {view.parts.length === 0 ? (
        <EmptyState
          compact
          main="No part of the site has plans yet."
          {...(canWrite && writes ? { next: { label: '+ Part', onPress: () => setPartName('') }, tail: 'names the first part, such as the Lodge or the Bunker. Then + New set puts its plans on it.' } : { tail: 'The office names the parts of the site and puts each one’s plans on it.' })}
        />
      ) : (
        (() => {
          // Each part's pieces, drawn once: a table row on the desk, a card on a phone (the Gun Dog spike, 2026-11-02: the seven-column table ran 584 wide in a 375 screen).
          const partBlocks = view.parts.map((row) => {
            const older = olderSetsFor(row)
            const timeline = partTimeline([...(row.current ? [row.current] : []), ...row.older])
            const setBy = row.part.current_set_by ? (names[row.part.current_set_by] ?? null) : null
            const replacedLine = [row.replaced ? `replaced ${row.replaced.name}${row.part.current_set_at ? ` on ${shortDayWords(row.part.current_set_at)}` : ''}` : '', setBy ? `set by ${setBy}` : ''].filter(Boolean).join(' · ')
            const building = (
              <>
                {row.current ? (
                  <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600 }}>{row.current.name}</span>
                    <span style={muted}>{setLineWords(row.current)}</span>
                    {openLink(row.current)}
                  </span>
                ) : (
                  <Chip label="no set yet" color="#b45309" soft />
                )}
                {replacedLine ? <div style={muted}>{replacedLine}</div> : null}
              </>
            )
            const dated = row.current?.dated ? shortDay(row.current.dated) : <span style={{ color: 'var(--text-faint)' }}>—</span>
            const came = row.current ? shortDay(row.current.came_at) : <span style={{ color: 'var(--text-faint)' }}>—</span>
            const memo = row.current?.memo ? row.current.memo : <span style={{ color: 'var(--text-faint)' }}>—</span>
            const changes = row.current ? <PlanSetChangesLine entry={timelineEntryFor(timeline, row.current)} canWrite={!!(canWrite && writes)} busy={busy} onSave={saveChanges} style={{ display: 'flex', marginTop: 2 }} /> : null
            const jobsCell = row.jobs.length ? carriers(row.jobs) : <span style={muted}>none yet</span>
            const olderPress = (
              <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {older.length ? (
                  <button type="button" className={`developmentChipPress${openOlder[row.part.id] ? ' isOn' : ''}`} aria-expanded={!!openOlder[row.part.id]} onClick={() => setOpenOlder((o) => ({ ...o, [row.part.id]: !o[row.part.id] }))} data-testid={`site-older-${row.part.id}`}>
                    {older.length} older <span aria-hidden>{openOlder[row.part.id] ? '▾' : '▸'}</span>
                  </button>
                ) : (
                  <span style={muted}>—</span>
                )}
                {canWrite && writes ? (
                  <LinkButton onClick={() => openSetForm(row)} nowrap>
                    + New set
                  </LinkButton>
                ) : null}
              </span>
            )
            const olderList =
              openOlder[row.part.id] && older.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} data-testid={`site-older-list-${row.part.id}`}>
                  {/* Each set reads date first, as people sort them; a dashed rule between neighbours; Open ↗, Build
                      from this set and × as one group at the right edge that wraps as a unit (the owner, 2026-11-02),
                      on a phone on a line of its own under the words, inside the card (2026-11-03). */}
                  {older.map((s, i) => {
                    // The three presses as one group. On the desk it sits at the right of the words and drops under them as a
                    // unit when the row is narrow (v2.6355). On a phone the words column is narrower than the group (a 356 px
                    // card leaves it 214; *link still to come · Build from this set · ×* is 239), so there the group takes a
                    // line of its own across both columns, still at the right, and wraps inside itself before it leaves the card.
                    const presses = (
                      <span
                        style={
                          phone
                            ? { display: 'inline-flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'flex-end', gridColumn: '1 / -1', justifySelf: 'end', maxWidth: '100%', minWidth: 0, marginTop: 2 }
                            : { display: 'inline-flex', gap: 10, alignItems: 'baseline', marginLeft: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap' }
                        }
                        data-testid="site-older-presses"
                      >
                        {openLink(s)}
                        {canWrite && writes ? (
                          <LinkButton onClick={() => void run(() => writes.buildFrom(row.part.id, s.id))} nowrap>
                            Build from this set
                          </LinkButton>
                        ) : null}
                        {removePress(s)}
                      </span>
                    )
                    return (
                      <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '7rem minmax(0, 1fr)', columnGap: 10, alignItems: 'baseline', padding: '5px 0', borderTop: i ? '1px dashed var(--border)' : 'none' }} data-testid="site-older-set">
                        <span style={muted} data-testid="site-older-day">
                          {setRowDayWords(s)}
                        </span>
                        <div style={{ display: 'flex', columnGap: 10, rowGap: 2, flexWrap: 'wrap', alignItems: 'baseline', minWidth: 0 }}>
                          <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
                            <span>{s.name}</span> <span style={muted}>{setRowLineWords(s)}</span>
                            {s.memo ? <div style={muted}>{s.memo}</div> : null}
                            <PlanSetChangesLine entry={timelineEntryFor(timeline, s)} canWrite={!!(canWrite && writes)} busy={busy} onSave={saveChanges} style={{ display: 'flex' }} />
                          </div>
                          {phone ? null : presses}
                        </div>
                        {phone ? presses : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null
            const asBuilts = row.asBuilts.length ? (
              <>
                <span style={{ ...muted, fontWeight: 600 }}>Our as-builts · {row.asBuilts.length}</span>
                <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                  {row.asBuilts.map((s) => (
                    <li key={s.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span>{s.name}</span>
                      <span style={muted}>{asBuiltLineWords(s, s.created_by ? (names[s.created_by] ?? null) : null, [...row.older, ...(row.current ? [row.current] : [])])}</span>
                      {s.memo ? <span style={muted}>{s.memo}</span> : null}
                      {openLink(s)}
                      {removePress(s)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null
            // The papers' two pieces (the papers train): the count that folds, with its chips, and the list it opens.
            const paperView = hasPapers ? buildPapersView(papers ?? [], row.part.id) : null
            const paperWords = paperView ? paperChipWords(paperView) : null
            const papersCell = paperWords ? (
              <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {paperWords.papers ? (
                  <button type="button" className={`developmentChipPress${openPapers[row.part.id] ? ' isOn' : ''}`} aria-expanded={!!openPapers[row.part.id]} onClick={() => setOpenPapers((o) => ({ ...o, [row.part.id]: !o[row.part.id] }))} data-testid={`site-papers-${row.part.id}`}>
                    {paperWords.papers} <span aria-hidden>{openPapers[row.part.id] ? '▾' : '▸'}</span>
                  </button>
                ) : (
                  <span style={muted}>—</span>
                )}
                {paperWords.asks ? <Chip label={paperWords.asks} color="#b45309" soft /> : null}
                {paperWords.owed ? <Chip label={paperWords.owed} color="#b45309" soft /> : null}
              </span>
            ) : null
            const papersList =
              paperView && openPapers[row.part.id] ? (
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }} data-testid={`site-papers-list-${row.part.id}`}>
                  {paperView.bySet.map((g) => (
                    <div key={g.setId || 'part'} style={{ marginBottom: 6 }}>
                      <div style={{ ...muted, fontWeight: 600 }}>{g.setId ? `With ${[...row.older, ...(row.current ? [row.current] : [])].find((s) => s.id === g.setId)?.name ?? 'a set'}` : `On ${row.part.name}`}</div>
                      {g.papers.map((p) => (
                        <div key={p.id} style={{ fontSize: '0.82rem' }}>
                          <Chip label={kindLabel(p.kind)} color="#64748b" soft /> {p.name} <span style={muted}>· {paperLineWords(p)}</span>
                          {p.ask && !p.ask.answeredAt ? <Chip label="asks" color="#b45309" soft /> : null}
                          {p.link ? (
                            <LinkButton onClick={() => openInExternalBrowser(p.link)} nowrap>
                              Open ↗
                            </LinkButton>
                          ) : null}{' '}
                          {paperPresses(p, row)}
                        </div>
                      ))}
                    </div>
                  ))}
                  {paperView.owed.map((p) => (
                    <div key={p.id} style={{ fontSize: '0.82rem', color: 'var(--text-amber-800)' }}>
                      <Chip label="owed" color="#b45309" soft /> {p.name} <span style={muted}>· {paperLineWords(p)}</span> {p.ask ? <span style={muted}>· {p.ask.words}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null
            const setFormNode =
              form && form.partId === row.part.id ? (
                <PlanSetForm mode="set" draft={form.draft} onChange={(d) => setForm({ partId: row.part.id, draft: d })} existing={[...row.older, ...(row.current ? [row.current] : []), ...row.asBuilts]} current={row.current} busy={busy} problem={problem} onAdd={(mk) => addSet(row, form.draft, mk)} onCancel={() => setForm(null)} />
              ) : null
            return { row, building, dated, came, memo, changes, jobsCell, olderPress, olderList, papersCell, papersList, asBuilts, setForm: setFormNode, hasMemo: !!row.current?.memo }
          })
          if (phone) {
            // The phone's shape: one card per part, the dates on one line, the memo as a paragraph, the older sets and + New set at the foot.
            return (
              <div style={{ display: 'grid', gap: 8 }} data-testid="site-plans-cards">
                {partBlocks.map((b) => (
                  <div key={b.row.part.id} data-testid={`site-part-${b.row.part.id}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', display: 'grid', gap: 6, fontSize: '0.84rem', minWidth: 0 }}>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '0.92rem' }}>{b.row.part.name}</strong>
                    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{b.building}</div>
                    {b.row.current ? (
                      <div style={muted}>
                        dated {b.dated} · came {b.came}
                      </div>
                    ) : null}
                    {b.hasMemo ? <div style={{ ...muted, overflowWrap: 'anywhere' }}>{b.memo}</div> : null}
                    {b.changes}
                    <div>
                      <span style={{ ...muted, fontWeight: 600 }}>Jobs</span> {b.jobsCell}
                    </div>
                    <div>{b.olderPress}</div>
                    {b.olderList}
                    {b.papersCell ? (
                      <div>
                        <span style={{ ...muted, fontWeight: 600 }}>Papers</span> {b.papersCell}
                      </div>
                    ) : null}
                    {b.papersList}
                    {b.asBuilts ? <div>{b.asBuilts}</div> : null}
                    {b.setForm}
                  </div>
                ))}
              </div>
            )
          }
          const restSpan = hasPapers ? 7 : 6
          return (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="site-plans-table">
              <thead>
                <tr>
                  <th style={th}>Part</th>
                  <th style={th}>Building from</th>
                  <th style={th}>Dated</th>
                  <th style={th}>Came</th>
                  <th style={th}>Memo</th>
                  <th style={th}>Jobs</th>
                  <th style={th}>Older sets</th>
                  {hasPapers ? <th style={th}>Papers</th> : null}
                </tr>
              </thead>
              <tbody>
                {partBlocks.map((b) => (
                  <RowGroup key={b.row.part.id}>
                    <tr data-testid={`site-part-${b.row.part.id}`}>
                      <td style={{ ...td, fontWeight: 700 }}>{b.row.part.name}</td>
                      <td style={td}>{b.building}</td>
                      <td style={td}>{b.dated}</td>
                      <td style={td}>{b.came}</td>
                      <td style={{ ...td, minWidth: 160 }}>
                        {b.memo}
                        {b.changes}
                      </td>
                      <td style={td}>{b.jobsCell}</td>
                      <td style={td}>{b.olderPress}</td>
                      {hasPapers ? <td style={td}>{b.papersCell}</td> : null}
                    </tr>
                    {b.papersList ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={restSpan}>
                          {b.papersList}
                        </td>
                      </tr>
                    ) : null}
                    {b.olderList ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={restSpan}>
                          {b.olderList}
                        </td>
                      </tr>
                    ) : null}
                    {b.asBuilts ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={restSpan}>
                          {b.asBuilts}
                        </td>
                      </tr>
                    ) : null}
                    {b.setForm ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={restSpan}>
                          {b.setForm}
                        </td>
                      </tr>
                    ) : null}
                  </RowGroup>
                ))}
              </tbody>
            </table>
          )
        })()
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-testid="site-plans-chips">
        {chips.noSet ? (
          <button type="button" className={`developmentChipPress${openChip === 'noSet' ? ' isOn' : ''}`} aria-expanded={openChip === 'noSet'} onClick={() => setOpenChip((v) => (v === 'noSet' ? null : 'noSet'))} data-testid="site-chip-no-set">
            {chips.noSet} <span aria-hidden>{openChip === 'noSet' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {chips.noPart ? (
          <button type="button" className={`developmentChipPress${openChip === 'noPart' ? ' isOn' : ''}`} aria-expanded={openChip === 'noPart'} onClick={() => setOpenChip((v) => (v === 'noPart' ? null : 'noPart'))} data-testid="site-chip-no-part">
            {chips.noPart} <span aria-hidden>{openChip === 'noPart' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {chips.allGood ? (
          // A sentence, not a count: wider than a phone's row (338 px of words in 329), so there it wraps inside the row, in a softer corner, instead of running past the screen (v2.6442).
          <span className="developmentCountChip" style={phone ? { whiteSpace: 'normal', borderRadius: 12 } : undefined} data-testid="site-chip-all-good">
            {chips.allGood}
          </span>
        ) : null}
        {canWrite && writes && view.parts.length > 0 && partName === null ? (
          <SmallButton onClick={() => setPartName('')} title="Name a new part of the site: a building, an area, the whole site">
            + Part
          </SmallButton>
        ) : null}
        {askCount > 0 && !(askOnRecord && askOnRecord.open) ? (
          <span style={{ marginLeft: 'auto' }}>
            <SmallButton onClick={() => askAbout(askCount)} title="Writes one question to the estimators about these parts and jobs; the answer reads back here">
              Ask the estimators about the {askCount}
            </SmallButton>
          </span>
        ) : null}
        {askOnRecord && askOnRecord.open ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-amber-800)', fontWeight: 600 }} data-testid="plans-ask-waiting">
            {openQuestions ? (
              <LinkButton onClick={openQuestions} title="The question, under Questions">
                {plansAskLine(askOnRecord, shortDay)} ›
              </LinkButton>
            ) : (
              plansAskLine(askOnRecord, shortDay)
            )}
          </span>
        ) : null}
      </div>
      {leftOut ? (
        <div style={{ ...muted, fontSize: '0.78rem' }} data-testid="site-left-out">
          {leftOut}
        </div>
      ) : null}
      {askOnRecord && !askOnRecord.open ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="plans-ask-answered">
          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{plansAskLine(askOnRecord, shortDay).split(' · ')[0]}</span>
          {' · '}
          {plansAskLine(askOnRecord, shortDay).split(' · ').slice(1).join(' · ')}
          {openQuestions ? (
            <>
              {' '}
              <LinkButton onClick={openQuestions}>Questions ›</LinkButton>
            </>
          ) : null}
        </div>
      ) : null}
      {openChip === 'noSet' && view.partsWithNoSet.length ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="site-list-no-set">
          {view.partsWithNoSet.map((r) => r.part.name).join(' · ')}
          <span style={muted}>{canWrite ? ' · press + New set on the part’s row' : ''}</span>
        </div>
      ) : null}
      {openChip === 'noPart' && view.jobsWithNoPart.length ? (
        canWrite && writes && view.parts.length > 0 ? (
          // A writer ticks the jobs and names the part; one press puts them all on it (the Gun Dog spike, 2026-11-02: 24 jobs on no part, one at a time before).
          <div style={{ fontSize: '0.8rem', display: 'grid', gap: 8 }} data-testid="site-list-no-part">
            {/* One row per job with its name (the owner, 2026-11-02: a person picks the part by the name, not the number), by name so a building's jobs sit together; the row ticks, the number opens. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: '2px 18px' }}>
              {orderForPicking(view.jobsWithNoPart).map((c) => (
                <label key={c.id} className={`developmentPickRow${picked.has(c.id) ? ' isOn' : ''}`} data-testid={`site-pick-${c.id}`}>
                  <input
                    type="checkbox"
                    checked={picked.has(c.id)}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })
                    }
                    aria-label={`Put ${c.label} on the part`}
                  />
                  <span className="developmentPickNumber">
                    <JobChip jobId={c.id} onOpen={() => openCarrier(c)}>
                      {c.label}
                    </JobChip>
                  </span>
                  <span className="developmentPickName" title={c.name ?? undefined}>
                    {c.name ?? <span style={muted}>no name</span>}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <LinkButton onClick={() => setPicked(new Set(view.jobsWithNoPart.map((c) => c.id)))} nowrap>
                Tick all {view.jobsWithNoPart.length}
              </LinkButton>
              {picked.size ? (
                <LinkButton onClick={() => setPicked(new Set())} nowrap>
                  Clear
                </LinkButton>
              ) : null}
              <select value={partForJobs} onChange={(e) => setPartForJobs(e.target.value)} aria-label="The part the ticked jobs go on" style={{ ...input, minWidth: '10rem' }} data-testid="site-part-for-jobs">
                <option value="">on which part…</option>
                {view.parts.map((r) => (
                  <option key={r.part.id} value={r.part.id}>
                    {r.part.name}
                  </option>
                ))}
              </select>
              <SmallButton
                primary
                disabled={busy || picked.size === 0 || !partForJobs}
                onClick={() =>
                  void run(async () => {
                    const ok = await writes.putJobsOnPart(partForJobs, [...picked])
                    if (ok) setPicked(new Set())
                    return ok
                  })
                }
                title="Names the part on each ticked job, as its Documents tab would, one write per job; a job that will not take it is named afterwards"
              >
                {countedLabel('Put', picked.size, 'job')}
                {partForJobs ? ` on ${view.parts.find((r) => r.part.id === partForJobs)?.part.name ?? 'the part'}` : ' on a part'}
              </SmallButton>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem' }} data-testid="site-list-no-part">
            {carriers(view.jobsWithNoPart)} <span style={muted}>· a job names its part on its Documents tab, under Plans</span>
          </div>
        )
      ) : null}
      {partName !== null && canWrite && writes ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-testid="site-part-form">
          <input style={input} value={partName} placeholder="The part’s name: Lodge, Bunker, Whole site" aria-label="The part's name" onChange={(e) => setPartName(e.target.value)} />
          <SmallButton onClick={() => void run(() => writes.addPart(partName.trim()))} primary disabled={busy || !partName.trim()}>
            Make the part
          </SmallButton>
          <LinkButton onClick={() => setPartName(null)} nowrap>
            Cancel
          </LinkButton>
          {problem ? <span style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</span> : null}
        </div>
      ) : null}
      {view.bidsPinned.length ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="site-bids-pinned">
          <span style={muted}>Bids pin their own set: </span>
          {view.bidsPinned.map((b, i) => (
            <span key={b.id}>
              {i ? ' · ' : ''}
              <LinkButton onClick={() => openCarrier(b)}>{b.label}</LinkButton> <LinkButton onClick={() => openInExternalBrowser(b.link)}>Open ↗</LinkButton>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** A fragment that keeps a part's rows together; React needs one element per map item. */
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>
}
