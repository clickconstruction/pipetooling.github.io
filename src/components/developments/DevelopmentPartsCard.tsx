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
import { olderSetsFor, sitePlansAskCount, sitePlansChipWords, sitePlansLeftOutWords, type SiteCarrier, type SitePartRow, type SitePlansView } from '../../lib/plans/sitePlans'
import { plansAskLine, type PlansAsk } from '../../lib/developments/plans'
import { EmptyState } from '../EmptyState'
import { partTimeline, setRowDayWords, setRowLineWords, timelineEntryFor } from '../../lib/plans/planSets'
import { PlanSetChangesLine } from '../plans/PlanSetChangesLine'
import { PlanSetForm } from '../plans/PlanSetForm'
import { Chip, LinkButton, shortDay, SmallButton } from './developmentPageBits'
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
}: {
  /** Null while the parts read. */
  view: SitePlansView | null
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
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)

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

  return (
    <div style={{ display: 'grid', gap: 10 }}>
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
                      from this set and × as one group at the right edge that wraps as a unit (the owner, 2026-11-02). */}
                  {older.map((s, i) => (
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
                        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'baseline', marginLeft: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap' }} data-testid="site-older-presses">
                          {openLink(s)}
                          {canWrite && writes ? (
                            <LinkButton onClick={() => void run(() => writes.buildFrom(row.part.id, s.id))} nowrap>
                              Build from this set
                            </LinkButton>
                          ) : null}
                          {removePress(s)}
                        </span>
                      </div>
                    </li>
                  ))}
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
            const setFormNode =
              form && form.partId === row.part.id ? (
                <PlanSetForm mode="set" draft={form.draft} onChange={(d) => setForm({ partId: row.part.id, draft: d })} existing={[...row.older, ...(row.current ? [row.current] : []), ...row.asBuilts]} current={row.current} busy={busy} problem={problem} onAdd={(mk) => addSet(row, form.draft, mk)} onCancel={() => setForm(null)} />
              ) : null
            return { row, building, dated, came, memo, changes, jobsCell, olderPress, olderList, asBuilts, setForm: setFormNode, hasMemo: !!row.current?.memo }
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
                    {b.asBuilts ? <div>{b.asBuilts}</div> : null}
                    {b.setForm}
                  </div>
                ))}
              </div>
            )
          }
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
                    </tr>
                    {b.olderList ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={6}>
                          {b.olderList}
                        </td>
                      </tr>
                    ) : null}
                    {b.asBuilts ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={6}>
                          {b.asBuilts}
                        </td>
                      </tr>
                    ) : null}
                    {b.setForm ? (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        <td style={td} colSpan={6}>
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
        {chips.allGood ? <span className="developmentCountChip">{chips.allGood}</span> : null}
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
        <div style={{ fontSize: '0.8rem' }} data-testid="site-list-no-part">
          {carriers(view.jobsWithNoPart)} <span style={muted}>· a job names its part on its Documents tab, under Plans</span>
        </div>
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
