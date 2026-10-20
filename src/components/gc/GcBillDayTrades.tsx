import { useEffect, useMemo, useState } from 'react'
import { askDrawText, askWaiverText, firstNameOf, remindDrawText, superintendentText, type AskTo } from '../../lib/gc/billDay/asks'
import { loadJobSuperintendent } from '../../lib/gc/billDay/billDayIo'
import type { RiverKey } from '../../lib/gc/billDay/summary'
import { canItGo, notInRows, tradesSums, walkDraws, type GateAct, type TradeDraw } from '../../lib/gc/billDay/trades'
import type { DrawTables } from '../../lib/gc/drawRows'
import { tradeMailLang } from '../../lib/gc/tradeEmail'
import { tradeLinkStatus } from '../../lib/gc/tradePortalLinks'
import { tradePortalUrl } from '../../lib/gc/tradePortalPage'
import { loadTradePortalLinks } from '../../lib/gc/tradePortalLinksIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'
import { GcBillDayAsk, type BillDayAskText } from './GcBillDayAsk'
import { GcBillDayDates, GcBillDayGates } from './GcBillDayFolds'
import { GcBillDayRows, type RowAsk } from './GcBillDayRows'
import { GcBillDayTop } from './GcBillDayTop'
import { Btn, Card } from './gcUi'
import { useBillDay } from './useBillDay'

/**
 * Messages, cut 9 (wave 2, helper 7): Money → Bill day → From the trades, for one job being built. The trades' pay
 * applications against the bill day: the top (the river, the dates, the ring, Today), the dates and the gates folded,
 * then one row per trade by where it stands, each ask its own text. The money team's, as Money is. Approve and Send back
 * stay the Draws window's own. `state` is Money's: the board with the draws, the bills and each job's schedule.
 */
export interface BillDayTradesProps {
  state: GcState
  /** The jobs being built with a signed statement of work to draw on. */
  jobs: GcProject[]
  projectId: string | null
  onPickJob: (projectId: string) => void
  drawTables: DrawTables | null
  /** A dev, while Bill day is built: Nothing this period and Put it back. */
  canWrite: boolean
  /** Opens the Draws window, where Approve and Send back live. Unset: it does not open for this reader. */
  onOpenDraws?: (projectId: string) => void
  onOpenBill?: (projectId: string) => void
  onToOwner: () => void
}

type Panel = { title: string; texts: BillDayAskText[]; packageId: string | null }

export function GcBillDayTrades({ state, jobs, projectId, onPickJob, drawTables, canWrite, onOpenDraws, onOpenBill, onToOwner }: BillDayTradesProps) {
  const project = jobs.find((p) => p.id === projectId) ?? jobs[0] ?? null
  const [superintendent, setSuperintendent] = useState<{ name: string; phone: string | null } | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [datesOpen, setDatesOpen] = useState(false)
  const [gatesOpen, setGatesOpen] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [linesFor, setLinesFor] = useState<string | null>(null)
  const { read, writes, busy, problem } = useBillDay(state, project, drawTables, superintendent?.name ?? null)
  const companyIds = useMemo(() => [...new Set((read?.rows ?? []).flatMap((r) => (r.partnerId ? [r.partnerId] : [])))], [read])
  const jobId = project?.id ?? null

  useEffect(() => {
    if (!jobId) return
    let live = true
    setSuperintendent(null)
    setPanel(null)
    loadJobSuperintendent(jobId)
      .then((s) => {
        if (live) setSuperintendent(s)
      })
      .catch(() => {
        if (live) setSuperintendent(null)
      })
    return () => {
      live = false
    }
  }, [jobId])

  const linkKey = companyIds.join(',')
  useEffect(() => {
    if (companyIds.length === 0) return
    let live = true
    // The links are a dev's to read; anyone else on the money team reads none, and each text says so.
    loadTradePortalLinks(companyIds)
      .then(({ links: rows }) => {
        if (!live) return
        const on: Record<string, string> = {}
        for (const id of companyIds) {
          const token = tradeLinkStatus(rows, id, null).token
          if (token) on[id] = token
        }
        setLinks(on)
      })
      .catch(() => {
        if (live) setLinks({})
      })
    return () => {
      live = false
    }
    // `linkKey` stands for the companies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey])

  if (!project) {
    return <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 1rem 1rem' }}>No job is being built with a signed trade yet.</div>
  }
  if (!read) {
    return (
      <div style={{ fontSize: '0.875rem', padding: '0.5rem 1rem 1rem', color: problem ? 'var(--text-red-700)' : 'inherit' }} role={problem ? 'alert' : undefined}>
        {problem ?? 'Loading Bill day…'}
      </div>
    )
  }
  const { dates, rows, gates, river } = read
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  const partnerOf = (row: TradeDraw) => state.partners.find((p) => p.id === row.partnerId)
  const askTo = (row: TradeDraw): { to: AskTo; held?: string } => {
    const partner = partnerOf(row)
    const token = row.partnerId ? links[row.partnerId] : undefined
    return {
      to: { firstName: firstNameOf(row.person), link: token ? `${tradePortalUrl(origin, token)}#draws` : '[their portal link]', lang: tradeMailLang(partner?.lang) },
      ...(token ? {} : { held: 'They have no portal link yet. Make it in their company window first.' }),
    }
  }
  const textFor = (row: TradeDraw, text: string | null, held?: string): BillDayAskText[] =>
    text ? [{ key: row.packageId, to: row.person || row.company, phone: partnerOf(row)?.phone ?? null, text, ...(held ? { held } : {}) }] : []

  const askRow = (ask: RowAsk, row: TradeDraw) => {
    const { to, held } = askTo(row)
    const text = ask === 'askDraw' ? askDrawText(row, dates, project.name, to) : ask === 'remind' ? remindDrawText(row, to) : askWaiverText(row, to)
    const title = ask === 'askDraw' ? `Ask ${row.company} for its draw` : ask === 'remind' ? `Remind ${row.company}` : `Ask ${row.company} for the waiver`
    setPanel({ title, texts: textFor(row, text, held), packageId: row.packageId })
  }
  const askAll = () => {
    const texts = notInRows(rows).flatMap((row) => {
      const { to, held } = askTo(row)
      return textFor(row, askDrawText(row, dates, project.name, to), held)
    })
    setPanel({ title: `Ask the ${texts.length} not in`, texts, packageId: null })
  }
  const askWalk = () => {
    const name = superintendent?.name ?? null
    setPanel({
      title: name ? `Ask ${firstNameOf(name)} to walk it` : 'Ask the superintendent to walk it',
      texts: name
        ? [{ key: 'walk', to: name, phone: superintendent?.phone ?? null, text: superintendentText(firstNameOf(name), walkDraws(rows).length, project.name, dates) }]
        : [{ key: 'walk', to: 'the superintendent', phone: null, text: superintendentText('Hello', walkDraws(rows).length, project.name, dates), held: 'No superintendent is on this job. Add one on its Workflow page.' }],
      packageId: null,
    })
  }
  const onAct = (act: GateAct) => {
    const row = 'packageId' in act ? rows.find((r) => r.packageId === act.packageId) : undefined
    if (act.kind === 'askNotIn') askAll()
    else if (act.kind === 'askSuperintendent') askWalk()
    else if (act.kind === 'remind' && row) askRow('remind', row)
    else if (act.kind === 'askWaiver' && row) askRow('askWaiver', row)
    else if (act.kind === 'openLines' && row) {
      setLinesFor(row.packageId)
      document.getElementById('bill-day-waiting')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }
  const jump = (key: RiverKey) => document.getElementById(`bill-day-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  const sums = tradesSums(rows)
  const go = canItGo(gates)
  const canSend = go.yes && state.today >= dates.billDay && Boolean(onOpenBill)
  const pagePanel = panel && panel.packageId === null ? <GcBillDayAsk title={panel.title} texts={panel.texts} onClose={() => setPanel(null)} /> : null
  const rowPanel = panel && panel.packageId !== null ? { packageId: panel.packageId, node: <GcBillDayAsk title={panel.title} texts={panel.texts} onClose={() => setPanel(null)} /> } : null

  return (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '0 1rem 1rem' }} data-bill-day-trades={project.id}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        {jobs.length > 1 &&
          jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              aria-pressed={j.id === project.id}
              onClick={() => onPickJob(j.id)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '0.2rem 0.65rem',
                background: j.id === project.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                fontWeight: j.id === project.id ? 700 : 400,
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              {j.name}
            </button>
          ))}
        <span style={{ color: 'var(--text-muted)' }}>
          {project.name} · pay application {dates.number} · the period to {shortDate(dates.billDay)} · cut-off {dates.cutoffDays} days before
        </span>
      </div>
      <GcBillDayTop
        river={river}
        dates={dates}
        gates={gates}
        rows={rows}
        today={state.today}
        datesOpen={datesOpen}
        gatesOpen={gatesOpen}
        onDates={() => setDatesOpen((o) => !o)}
        onGates={() => setGatesOpen((o) => !o)}
        onJump={jump}
        onAct={onAct}
      />
      {pagePanel}
      {datesOpen && <GcBillDayDates project={project} dates={dates} rows={rows} superintendent={superintendent?.name ?? null} today={state.today} />}
      {gatesOpen && <GcBillDayGates gates={gates} number={dates.number} onAct={onAct} />}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <GcBillDayRows
        project={project}
        rows={rows}
        dates={dates}
        checks={read.checks}
        photos={read.photos}
        today={state.today}
        canWrite={canWrite}
        busy={busy}
        ours={river.owner.ours}
        onAsk={askRow}
        onAskAll={askAll}
        onNothing={writes.sayNothing}
        onPutBack={writes.putBack}
        onOpenDraws={onOpenDraws ? () => onOpenDraws(project.id) : undefined}
        askPanel={rowPanel}
        openLinesFor={linesFor}
      />
      <Card style={{ padding: '0.65rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span data-bill-day-total style={{ flex: '1 1 280px' }}>
          As it stands: approved <strong>{money(sums.approved)}</strong>, waiting on us <strong>{money(sums.waiting)}</strong>, sent back <strong>{money(sums.back)}</strong>, expected from the rest{' '}
          <strong>{money(sums.notIn)}</strong>. Pay application {dates.number} comes to about <strong>{money(river.owner.amount)}</strong>.
        </span>
        <Btn kind="quiet" onClick={onToOwner}>
          To the owner ›
        </Btn>
        <Btn kind="primary" disabled={!canSend} onClick={() => onOpenBill?.(project.id)} title={canSend ? `Opens Bill the customer for pay application ${dates.number}.` : 'It goes on bill day, once every gate is clear.'}>
          {`Send pay application ${dates.number}`}
        </Btn>
      </Card>
    </div>
  )
}
