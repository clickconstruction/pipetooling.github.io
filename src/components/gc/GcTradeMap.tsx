import { useEffect, useState, type Dispatch } from 'react'
import {
  BIDS_WANTED,
  TOWNS,
  answerRecord,
  bidsIn,
  daysUntil,
  declinedTitle,
  declinedWords,
  money,
  nextToAsk,
  partnerBlockers,
  shortDate,
  tradeLineup,
  travelWords,
  type GcAction,
  type GcProject,
  type GcState,
  type LineupRow,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { AskThread, PromiseChip } from './GcAskThread'
import { Btn, Chip, type Tone } from './gcUi'
import { GcDeclineForm } from './GcDeclineForm'

/**
 * GC mode design spike: line up quotes for one trade on one project. The map shows the project
 * and every company in the trade, numbered in the line's order (most reliable first, question 7),
 * with a ring every 50 miles. The column beside it is the same companies in the same order, to work
 * down: ask the first, and when one says no, offer it to the next. The map is drawn from town positions as a stand-in. The
 * real build puts the same pins on the app's own map.
 */

interface Props {
  state: GcState
  project: GcProject
  packageId: string
  dispatch: Dispatch<GcAction>
  onPickPackage: (packageId: string) => void
  onClose: () => void
  /** Open the project's Trades tab on this trade, to level the quotes. */
  onLevel: (packageId: string) => void
}

type PinKind = 'bid' | 'waiting' | 'open' | 'no' | 'far'

const PIN: Record<PinKind, { fill: string; stroke: string; text: string; dash?: string; word: string }> = {
  bid: { fill: '#16a34a', stroke: '#16a34a', text: 'white', word: 'quote in' },
  waiting: { fill: '#2563eb', stroke: '#2563eb', text: 'white', word: 'asked, waiting' },
  open: { fill: 'var(--surface)', stroke: '#2563eb', text: '#2563eb', word: 'not asked' },
  no: { fill: 'var(--bg-200)', stroke: 'var(--border-400)', text: 'var(--text-600)', word: 'said no' },
  far: { fill: 'var(--surface)', stroke: '#d97706', text: '#d97706', dash: '4 3', word: 'too far' },
}

function pinKind(row: LineupRow): PinKind {
  if (row.invite?.status === 'bid') return 'bid'
  if (row.invite?.status === 'declined') return 'no'
  if (row.invite) return 'waiting'
  return row.travel.inZone ? 'open' : 'far'
}

const RECORD: Record<ReturnType<typeof answerRecord>, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

export function GcTradeMap({ state, project, packageId, dispatch, onPickPackage, onClose, onLevel }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const packages = project.packages.filter((p) => !p.selfPerform)
  const pkg = packages.find((p) => p.id === packageId) ?? packages[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!pkg) return null
  const rows = tradeLineup(state, project, pkg)
  const quotes = bidsIn(pkg).length
  const waiting = rows.filter((r) => r.invite && (r.invite.status === 'invited' || r.invite.status === 'opened')).length
  const next = nextToAsk(rows)
  const ids = { projectId: project.id, packageId: pkg.id }
  const ask = (partnerId: string) => dispatch({ type: 'invite', ...ids, partnerId })
  const short = Math.max(0, BIDS_WANTED - quotes)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: line up quotes`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1280px, 100%)',
          height: 'min(860px, 96vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · line up quotes</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {project.address}. We want at least {BIDS_WANTED} quotes on every trade, from different companies.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div role="group" aria-label="Trade" style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {packages.map((p) => {
            const active = p.id === pkg.id
            const n = bidsIn(p).length
            const done = n >= BIDS_WANTED
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onPickPackage(p.id)
                  setSelected(null)
                }}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {p.trade}{' '}
                <span style={{ color: done ? 'var(--text-green-700)' : n === 0 ? 'var(--text-red-700)' : 'var(--text-amber-700)', fontWeight: 700 }}>
                  {n} of {BIDS_WANTED}
                </span>
              </button>
            )
          })}
        </div>

        <div
          style={{
            padding: '0.55rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: short === 0 ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: '0.9rem',
          }}
        >
          <strong>
            {pkg.trade}: {quotes} of {BIDS_WANTED} quotes in.
          </strong>
          {waiting > 0 && <span>{waiting} asked and waiting.</span>}
          {short === 0 ? (
            <Btn kind="primary" onClick={() => onLevel(pkg.id)}>Compare the quotes</Btn>
          ) : next ? (
            <>
              <span>
                Next in line we have not asked: <strong>{next.partner.company}</strong>
                {travelWords(next.travel, next.partner) ? `, ${travelWords(next.travel, next.partner)}` : ''}.
              </span>
              <Btn kind="primary" onClick={() => ask(next.partner.id)}>Ask {next.partner.company}</Btn>
            </>
          ) : (
            <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
              Everyone in range is asked. Add a company in Trade partners, or ask one that is too far.
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(20rem, 1fr)', minHeight: 0, flex: 1 }}>
          <div style={{ padding: '0.75rem', overflow: 'auto', background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)' }}>
            <LineupMap project={project} rows={rows} selected={selected} onSelect={setSelected} />
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-600)' }}>
              {(Object.keys(PIN) as PinKind[]).map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <circle cx="7" cy="7" r="5.5" style={{ fill: PIN[k].fill, stroke: PIN[k].stroke }} strokeWidth="1.5" strokeDasharray={PIN[k].dash} />
                  </svg>
                  {PIN[k].word}
                </span>
              ))}
              <span>Rings are drive miles from the project. Numbers match the list, most reliable first.</span>
            </div>
          </div>

          <div style={{ overflowY: 'auto' }}>
            {rows.length === 0 && (
              <div style={{ padding: '1rem', color: 'var(--text-red-700)' }}>
                No company in the directory does {pkg.trade.toLowerCase()}. Add one in Trade partners.
              </div>
            )}
            {rows.map((row) => (
              <LineupItem
                key={row.partner.id}
                state={state}
                project={project}
                pkg={pkg}
                row={row}
                isNext={next?.partner.id === row.partner.id && short > 0}
                selected={selected === row.partner.id}
                onSelect={() => setSelected(row.partner.id)}
                dispatch={dispatch}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const W = 640
const H = 520
const CX = W / 2
const CY = H / 2

function LineupMap({
  project,
  rows,
  selected,
  onSelect,
}: {
  project: GcProject
  rows: LineupRow[]
  selected: string | null
  onSelect: (partnerId: string) => void
}) {
  const home = TOWNS.find((t) => t.name === project.town)
  if (!home) return <div style={{ padding: '1rem' }}>This project has no place on the map yet.</div>
  const placed = rows.filter((r) => r.rank !== null)
  const farthest = placed.reduce((m, r) => Math.max(m, r.travel.miles ?? 0), 0)
  const reach = Math.max(110, farthest + 18)
  const scale = (H / 2 - 22) / reach
  /** A town's spot: east and north of the project in drive miles (the straight line plus a fifth). */
  const spot = (townName: string) => {
    const t = TOWNS.find((x) => x.name === townName)
    if (!t) return null
    const east = (t.lng - home.lng) * Math.cos((home.lat * Math.PI) / 180) * 69.17 * 1.2
    const north = (t.lat - home.lat) * 69.17 * 1.2
    return { x: CX + east * scale, y: CY - north * scale }
  }
  const byTown = new Map<string, LineupRow[]>()
  for (const r of placed) {
    const town = r.partner.base ?? ''
    byTown.set(town, [...(byTown.get(town) ?? []), r])
  }
  const rings = [50, 100, 150, 200].filter((miles) => miles <= reach)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Map of ${project.town} and the companies in this trade`}
      style={{ display: 'block', width: '100%', height: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
    >
      {rings.map((miles) => (
        <g key={miles}>
          <circle cx={CX} cy={CY} r={miles * scale} fill="none" style={{ stroke: 'var(--border-strong)' }} strokeDasharray="5 5" />
          <text x={CX} y={CY - miles * scale + 13} textAnchor="middle" fontSize="11" style={{ fill: 'var(--text-muted)' }}>
            {miles} mi
          </text>
        </g>
      ))}

      {[...byTown.entries()].map(([town, group]) => {
        const at = spot(town)
        if (!at) return null
        const below = at.y + (group.length > 1 ? 34 : 26)
        return (
          <g key={town}>
            <text x={at.x} y={below} textAnchor="middle" fontSize="11" style={{ fill: 'var(--text-600)' }}>
              {town}
            </text>
            {group.map((row, i) => {
              const fan = group.length > 1 ? { x: Math.cos((2 * Math.PI * i) / group.length - Math.PI / 2) * 15, y: Math.sin((2 * Math.PI * i) / group.length - Math.PI / 2) * 15 } : { x: 0, y: 0 }
              const pin = PIN[pinKind(row)]
              const isSel = selected === row.partner.id
              return (
                <g
                  key={row.partner.id}
                  onClick={() => onSelect(row.partner.id)}
                  style={{ cursor: 'pointer' }}
                  aria-label={`${row.rank}. ${row.partner.company}`}
                >
                  {isSel && <circle cx={at.x + fan.x} cy={at.y + fan.y} r="17" fill="none" stroke="#7c3aed" strokeWidth="2.5" />}
                  <circle cx={at.x + fan.x} cy={at.y + fan.y} r="11.5" style={{ fill: pin.fill, stroke: pin.stroke }} strokeWidth="2" strokeDasharray={pin.dash} />
                  <text x={at.x + fan.x} y={at.y + fan.y + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" style={{ fill: pin.text }}>
                    {row.rank}
                  </text>
                  <title>{`${row.rank}. ${row.partner.company} · ${travelWords(row.travel, row.partner)}`}</title>
                </g>
              )
            })}
          </g>
        )
      })}

      <g>
        <path d={`M${CX} ${CY - 15} L${CX + 13} ${CY - 3} L${CX + 9} ${CY - 3} L${CX + 9} ${CY + 10} L${CX - 9} ${CY + 10} L${CX - 9} ${CY - 3} L${CX - 13} ${CY - 3} Z`} fill="#dc2626" stroke="white" strokeWidth="1.5" />
        <text x={CX} y={CY + 25} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--text-strong)' }}>
          {project.name}
        </text>
      </g>
    </svg>
  )
}

function LineupItem({
  state,
  project,
  pkg,
  row,
  isNext,
  selected,
  onSelect,
  dispatch,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  row: LineupRow
  isNext: boolean
  selected: boolean
  onSelect: () => void
  dispatch: Dispatch<GcAction>
}) {
  const { partner, travel, invite } = row
  const kind = pinKind(row)
  const pin = PIN[kind]
  const record = RECORD[answerRecord(partner)]
  const blockers = partnerBlockers(partner, state.today)
  const ids = { projectId: project.id, packageId: pkg.id }
  const [declining, setDeclining] = useState<'wont' | 'cant' | null>(null)
  const waited = invite ? daysUntil(state.today, invite.invitedOn) : 0
  const far = travelWords(travel, partner)

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '0.6rem 0.9rem',
        borderBottom: '1px solid var(--border)',
        borderLeft: `4px solid ${selected ? '#7c3aed' : isNext ? '#2563eb' : 'transparent'}`,
        background: selected ? 'var(--bg-violet-100)' : isNext ? 'var(--bg-blue-tint)' : undefined,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: '0.6rem',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden style={{ marginTop: 2 }}>
        <circle cx="13" cy="13" r="11" style={{ fill: pin.fill, stroke: pin.stroke }} strokeWidth="2" strokeDasharray={pin.dash} />
        <text x="13" y="17" textAnchor="middle" fontSize="11.5" fontWeight="700" style={{ fill: pin.text }}>
          {row.rank ?? '?'}
        </text>
      </svg>
      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong>{partner.company}</strong>
          {isNext && <Chip tone="blue">next to ask</Chip>}
          <span style={{ color: 'var(--text-muted)' }}>{partner.contact}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          <Chip tone={travel.miles === null || !travel.inZone ? 'amber' : 'grey'}>
            {travel.miles === null ? 'coverage not set' : far}
          </Chip>
          <Chip tone={record.tone}>
            {record.word}
            {partner.invited > 0 ? ` · ${partner.bids} of ${partner.invited}` : ''}
          </Chip>
          {blockers.length > 0 && <Chip tone="red" title={blockers.join(' ')}>paperwork missing</Chip>}
        </div>

        {invite?.status === 'bid' && invite.bid && (
          <div style={{ color: 'var(--text-green-700)', fontWeight: 600, display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            Quote in: {money(invite.bid.amount)} · {shortDate(invite.bid.submittedOn)}
            <PromiseChip invite={invite} today={state.today} />
          </div>
        )}
        {invite?.status === 'declined' && (
          <div style={{ color: 'var(--text-600)' }} title={declinedTitle(invite)}>
            Said no: {declinedWords(invite)}
            {invite.declineReason?.note ? `. "${invite.declineReason.note}"` : ''}.
          </div>
        )}
        {invite && (invite.status === 'invited' || invite.status === 'opened') && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ color: invite.status === 'invited' && waited > 3 ? 'var(--text-red-700)' : 'var(--text-600)' }}>
              {invite.status === 'invited' ? 'Has not opened it' : 'Looking at the plans'} · asked {waited === 0 ? 'today' : `${waited} days ago`}
              {invite.nudgedOn === state.today ? ' · nudged today' : ''}
            </span>
            <Btn kind="quiet" onClick={() => dispatch({ type: 'nudge', ...ids, inviteId: invite.id, about: `are you quoting ${pkg.trade.toLowerCase()} on ${project.name}?` })}>
              Nudge
            </Btn>
            <Btn onClick={() => setDeclining('wont')}>Will not do it</Btn>
            <Btn onClick={() => setDeclining('cant')}>Cannot do it</Btn>
          </div>
        )}
        {invite && declining && (invite.status === 'invited' || invite.status === 'opened') && (
          <GcDeclineForm
            company={partner.company}
            why={declining}
            onCancel={() => setDeclining(null)}
            onSave={(reason, note) => {
              dispatch({ type: 'officeDecline', ...ids, inviteId: invite.id, why: declining, reason, note })
              setDeclining(null)
            }}
          />
        )}
        {invite && (invite.status === 'invited' || invite.status === 'opened') && (
          <AskThread state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} />
        )}
        {!invite && (
          <div onClick={(e) => e.stopPropagation()}>
            <Btn kind={isNext ? 'primary' : 'plain'} onClick={() => dispatch({ type: 'invite', ...ids, partnerId: partner.id })}>
              {travel.inZone ? 'Ask them' : 'Ask anyway'}
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
