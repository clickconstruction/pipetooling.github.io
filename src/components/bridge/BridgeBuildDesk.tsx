/**
 * The Build desk (punch list #192, v2.5929): the modal behind the Bridge's
 * Build card. Hours in, work out. Since punch list #334 (PR 1) it opens in the shared
 * step frame (`BridgeStepWindow`): where Build stands in one headline, then
 * three short lists named by what to do, each row one job and one press, the
 * rest behind Show all. A row's press opens the job's detail under it: the
 * why-line, the crew chip and the doors. The percent window
 * (`FieldPctUpdateModal`) opens from that detail, the one write here, and the
 * page patches the Build reads so the desk recomputes. What moved, the whole
 * ledger of every open job and How this is counted wait behind the presses
 * at the foot. Pure on its props: `src/lib/bridge/build/buildDesk.ts` does
 * the arithmetic and `buildSteps.ts` shapes the three lists and their words.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import FieldPctUpdateModal from '../dashboard/FieldPctUpdateModal'
import { STAGE_META } from '../../lib/bridge/stageFlow'
import { type BuildDesk, type BuildDeskRow, type BuildDeskTone } from '../../lib/bridge/build/buildDesk'
import { buildBuildSteps } from '../../lib/bridge/build/buildSteps'
import { BridgeStepWindow, type StepFoldSpec, type StepGroup } from './BridgeStepWindow'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { font: 'inherit', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }
const footLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: '0.84rem', color: 'var(--text-link)', textDecoration: 'none' }

const TONE_COLOR: Record<BuildDeskTone, string> = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', grey: 'var(--text-muted)' }
const CHIP_BG: Record<BuildDeskTone, string> = { red: 'var(--bg-red-tint, var(--bg-subtle))', amber: 'var(--bg-amber-tint, var(--bg-subtle))', green: 'var(--bg-green-tint, var(--bg-subtle))', grey: 'var(--bg-subtle)' }

export type BridgeBuildDeskProps = {
  desk: BuildDesk
  /** The desk's own reads are still in flight: a line near the top says so, the rows draw without the crew chips. */
  readsPending: boolean
  readError: string | null
  /** Build is the lit link: the headline reads red. */
  isLink: boolean
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
  /** The page's savePct: patches the Build reads in place so the desk recomputes. */
  onSavePct: (jobId: string, pct: number) => void
}

function Chip({ tone, words }: { tone: BuildDeskTone; words: string }) {
  return <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: CHIP_BG[tone], color: TONE_COLOR[tone] }}>{words}</span>
}

/** The cells the ledger prints on a row's head: hours, percent, what moved and the chip. */
function Cells({ row }: { row: BuildDeskRow }) {
  return (
    <span style={{ display: 'flex', gap: '4px 16px', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
      <span>
        <b style={{ color: 'var(--text-strong)' }}>{row.hoursWords}</b>
      </span>
      <span>
        % <b style={{ color: 'var(--text-strong)' }}>{row.pctWords}</b>
      </span>
      <span>
        moved <b style={{ color: 'var(--text-strong)' }}>{row.movedWords}</b>
      </span>
      <Chip tone={row.chip.tone} words={row.chip.words} />
    </span>
  )
}

/** What a job opens to: its why-line, its crew chip and its doors. `cells` adds the ledger's cells, for a row whose head does not print them. `pctFirst` puts the percent window ahead of the doors, under a row whose press is Set the percent. */
function Detail({ row, id, cells, pctFirst, onSetPct }: { row: BuildDeskRow; id: string; cells: boolean; pctFirst: boolean; onSetPct: () => void }) {
  const setPct = row.canSetPct ? (
    <button type="button" onClick={onSetPct} style={{ ...door, border: '1px solid var(--border-strong)', fontWeight: 700 }} data-testid="bridge-build-set-pct">
      Open the percent window ›
    </button>
  ) : null
  return (
    <div id={id} style={{ fontSize: '0.85rem', color: 'var(--text-700)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }} data-testid="bridge-build-row-detail">
      {cells && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={det}>{row.sub}</span>
          <Cells row={row} />
        </div>
      )}
      <div>{row.why}</div>
      {row.crew && (
        <div>
          <Chip tone={row.crew.tone} words={row.crew.words} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pctFirst && setPct}
        {row.doors.map((d) => (
          <Link key={d.label} to={d.href} style={door}>
            {d.label} ›
          </Link>
        ))}
        {!pctFirst && setPct}
      </div>
    </div>
  )
}

/** One job as the ledger prints it: the head with its cells, opening to the detail. */
function Row({ row, open, onToggle, onSetPct }: { row: BuildDeskRow; open: boolean; onToggle: () => void; onSetPct: () => void }) {
  const edge = TONE_COLOR[row.chip.tone]
  return (
    <div style={{ ...card, padding: 0, borderLeft: `4px solid ${edge}`, minWidth: 0 }} data-testid="bridge-build-row">
      <button type="button" aria-expanded={open} aria-controls={`bridge-build-row-${row.id}`} onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '8px 12px', background: 'none', border: 0, font: 'inherit', color: 'var(--text-strong)', textAlign: 'left', cursor: 'pointer', borderRadius: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, minWidth: 0, flex: '1 1 200px', overflowWrap: 'anywhere' }}>
          {row.label}
          <span style={{ ...det, display: 'block', fontWeight: 400 }}>{row.sub}</span>
        </span>
        <Cells row={row} />
        <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.12s' }}>
          ›
        </span>
      </button>
      {open && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)' }}>
          <Detail row={row} id={`bridge-build-row-${row.id}`} cells={false} pctFirst={false} onSetPct={onSetPct} />
        </div>
      )}
    </div>
  )
}

export function BridgeBuildDesk(props: BridgeBuildDeskProps) {
  const { desk, readsPending, readError, isLink, readStamp, onClose, onSavePct } = props
  // One detail is open at a time: `step:<job>` under a row of the three lists, `fold:<job>` on a row of the ledger.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<BuildDeskRow['modalJob'] | null>(null)
  const steps = useMemo(() => buildBuildSteps(desk), [desk])
  const toggle = (key: string) => setOpenKey((v) => (v === key ? null : key))

  // The first thing to do is drawn blue: the first row of the first list that has one.
  const firstId = steps.groups.find((g) => g.rows.length > 0)?.rows[0]?.id ?? null
  const groups: StepGroup[] = steps.nothingWaiting
    ? [{ key: 'none', title: 'Do this week', rows: [], empty: steps.nothingWaiting }]
    : steps.groups.map((g) => ({
        key: g.key,
        title: g.title,
        shown: g.shown,
        rows: g.rows.map((s) => {
          const key = `step:${s.id}`
          const primary = s.id === firstId
          const testId = `bridge-build-press-${g.key}`
          return {
            key: s.id,
            title: s.title,
            sub: s.sub,
            press: s.href ? { label: s.press, to: s.href, primary, testId } : { label: s.press, onClick: () => toggle(key), primary, testId },
            under: openKey === key ? (
              <div style={{ ...card, padding: '0.6rem 0.75rem' }}>
                <Detail row={s.row} id={`bridge-build-step-${s.id}`} cells pctFirst={g.key === 'percent'} onSetPct={() => setEditing(s.row.modalJob)} />
              </div>
            ) : undefined,
          }
        }),
      }))

  const ledger = (rows: BuildDeskRow[]) => rows.map((r) => <Row key={r.id} row={r} open={openKey === `fold:${r.id}`} onToggle={() => toggle(`fold:${r.id}`)} onSetPct={() => setEditing(r.modalJob)} />)

  const folds: StepFoldSpec[] = [
    {
      key: 'moved',
      label: steps.moved.label,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="bridge-build-moved">
          <div style={det}>{steps.moved.words}</div>
          {ledger(steps.moved.rows)}
        </div>
      ),
    },
    {
      key: 'every',
      label: steps.everyLabel,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="bridge-build-every">
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-strong)' }} data-testid="bridge-build-verdict">
            {desk.verdict}
          </div>
          <div style={det}>{desk.subLine}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {desk.tiles.map((t) => (
              <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }} data-testid="bridge-build-tile">
                <div style={label}>{t.head}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-700)' }}>{t.words}</div>
              </div>
            ))}
          </div>
          <div style={det}>Every open job, by what the hours did. The worst is first. Press a row for the why and the doors.</div>
          {desk.noPctLine && <div style={det}>{desk.noPctLine}</div>}
          {ledger(desk.rows)}
        </div>
      ),
    },
    {
      key: 'counted',
      label: 'How this is counted',
      content: (
        <div style={{ ...det, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }} data-testid="bridge-build-footnote">
          <div>{steps.counted.join(' ')}</div>
          <div>Read {readStamp}</div>
        </div>
      ),
    },
  ]

  const summary =
    readError || readsPending ? (
      <div style={{ fontSize: '0.84rem', lineHeight: 1.4 }}>
        {readError ? (
          <div style={{ color: 'var(--text-red-700)' }} data-testid="bridge-build-read-error">
            The Schedule and the expected hours could not be read. The rows read without them. The reason given: {readError}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }} data-testid="bridge-build-reading">
            Reading the Schedule and the expected hours. Each job’s crew shows when they land.
          </div>
        )}
      </div>
    ) : undefined

  return (
    <BridgeStepWindow
      testId="bridge-build-desk"
      ariaLabel="Build, broken down"
      eyebrow={`Build · ${STAGE_META.build.object} · last ${desk.days} days`}
      headline={steps.headline}
      headlineTestId="bridge-build-headline"
      tone={isLink ? 'bad' : 'plain'}
      line={steps.line || undefined}
      summary={summary}
      groups={groups}
      folds={folds}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 1.1rem' }}>
          <Link to="/schedule-dispatch" style={footLink}>
            Open the Schedule ›
          </Link>
          <Link to="/jobs?tab=stages" style={footLink}>
            Open Stages ›
          </Link>
        </div>
      }
      onClose={onClose}
      escCloses={!editing}
    >
      {editing && <FieldPctUpdateModal job={editing} onClose={() => setEditing(null)} onSaved={(pct) => onSavePct(editing.id, pct)} />}
    </BridgeStepWindow>
  )
}
