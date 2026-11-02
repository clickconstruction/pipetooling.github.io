import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  countWords,
  paceAsOfWords,
  paceFreshness,
  paceHeadlineWords,
  paceTicks,
  paceYMax,
  type PaceHour,
  type ShipPacePicture,
} from '../../../supabase/functions/_shared/shipPace'
import type { UserRole } from '../../hooks/useAuth'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { type ShipPaceIo, shipPaceIo } from '../../lib/settings/shipPaceIo'
import { SHIP_PACE_WORDS } from '../../lib/settings/shipPaceWords'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'


/** The line's blue: the app's press blue, which reads on both surfaces. */
const LINE = '#2563eb'

type Props = {
  /** The viewer's role: a dev sees Read GitHub now. */
  role?: UserRole | null
  io?: ShipPaceIo
  /** The clock, for the smoke: the as-of words compare the row's stamp with now. */
  now?: () => number
}

const TILE: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--surface)',
  padding: '0.6rem 0.9rem',
  minWidth: '8rem',
  flex: '1 1 8rem',
}

/**
 * Settings → How fast a change ships (v2.6399): the headline the owner says out loud when the office asks for a
 * feature, the 72-hour chart of the median hours from a pull request opening to its merge, what landed today, and
 * one sentence on what the number means. The row is the `ship-pace` cron's; the client never reads GitHub.
 */
export default function SettingsShipPaceSection({ role = null, io = shipPaceIo, now = Date.now }: Props) {
  // undefined while the first read runs; null when there is no row yet.
  const [picture, setPicture] = useState<ShipPacePicture | null | undefined>(undefined)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [readLine, setReadLine] = useState<{ ok: boolean; line: string } | null>(null)

  const load = useCallback(async () => {
    setFailure(null)
    try {
      setPicture(await io.load())
    } catch (e) {
      setPicture(null)
      setFailure(recoveryFailureFromError(e, 'The read failed.'))
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  const readNow = useCallback(async () => {
    setReading(true)
    setReadLine(null)
    try {
      const answer = await io.readNow()
      setReadLine(answer)
      if (answer.ok) await load()
    } finally {
      setReading(false)
    }
  }, [io, load])

  const nowMs = now()
  const stale = picture ? paceFreshness(picture.asOf, nowMs).stale : false

  return (
    <div data-settings-ship-pace>
      <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)' }}>{SHIP_PACE_WORDS.intro}</p>

      {failure ? (
        <OfflineRetryPanel failure={failure} onRetry={load} surface="settings-ship-pace" idempotent />
      ) : picture === undefined ? (
        <p style={{ color: 'var(--text-muted)' }}>{SHIP_PACE_WORDS.loading}</p>
      ) : picture === null ? (
        <EmptyState main={SHIP_PACE_WORDS.emptyMain} tail={SHIP_PACE_WORDS.emptyTail} compact />
      ) : (
        <>
          <p data-ship-pace-headline style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 0.25rem' }}>
            {paceHeadlineWords(picture.last24h)}
          </p>
          <p data-ship-pace-as-of style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: stale ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>
            {paceAsOfWords(picture.asOf, nowMs)}
          </p>

          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', padding: '0.75rem 1rem 0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{SHIP_PACE_WORDS.chartTitle}</div>
            <PaceChart hours={picture.hours} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{SHIP_PACE_WORDS.gaps}</div>
          </div>

          <div data-ship-pace-today style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' }}>
            <Tile label={SHIP_PACE_WORDS.openedToday} value={picture.today.created.toLocaleString('en-US')} />
            <Tile label={SHIP_PACE_WORDS.mergedToday} value={picture.today.merged.toLocaleString('en-US')} />
            <Tile
              label={SHIP_PACE_WORDS.openNow}
              value={picture.now.open.toLocaleString('en-US')}
              small={picture.now.drafts > 0 ? `${countWords(picture.now.drafts, picture.now.drafts === 1 ? 'draft' : 'drafts')} among them` : undefined}
            />
            <Tile label={SHIP_PACE_WORDS.inQueue} value={picture.now.queue == null ? SHIP_PACE_WORDS.queueNotRead : picture.now.queue.toLocaleString('en-US')} />
          </div>

          <p data-ship-pace-meaning style={{ marginTop: '1rem', marginBottom: 0, color: 'var(--text-muted)' }}>{SHIP_PACE_WORDS.meaning}</p>
        </>
      )}

      {role === 'dev' && (
        <div data-ship-pace-dev style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void readNow()}
            disabled={reading}
            style={{
              padding: '0.4rem 0.9rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              cursor: reading ? 'default' : 'pointer',
              opacity: reading ? 0.7 : 1,
            }}
          >
            {reading ? SHIP_PACE_WORDS.reading : SHIP_PACE_WORDS.readNow}
          </button>
          {readLine && (
            <span data-ship-pace-read-line style={{ fontSize: '0.85rem', color: readLine.ok ? 'var(--text-muted)' : 'var(--text-red-600)' }}>
              {readLine.line}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <div style={TILE}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-strong)' }}>{value}</div>
      {small && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{small}</div>}
    </div>
  )
}

type ChartRow = { t: string; label: string; h: number | null; merged: number; created: number }

function PaceChart({ hours }: { hours: PaceHour[] }) {
  const rows = useMemo<ChartRow[]>(() => hours.map((h) => ({ t: h.t, label: h.label, h: h.cycleMedianH, merged: h.merged, created: h.created })), [hours])
  const labelOf = useMemo(() => new Map(hours.map((h) => [h.t, h.label])), [hours])
  const ticks = useMemo(() => paceTicks(hours), [hours])
  const yMax = paceYMax(hours)
  const yTicks = useMemo(() => Array.from({ length: yMax / 4 + 1 }, (_, i) => i * 4), [yMax])
  return (
    <div data-ship-pace-chart style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="t" ticks={ticks} interval={0} tickFormatter={(t: string) => labelOf.get(t) ?? ''} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, yMax]} ticks={yTicks} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<PaceTip />} cursor={{ stroke: 'var(--border)' }} />
          <Line type="linear" dataKey="h" stroke={LINE} strokeWidth={2} dot={{ r: 3, fill: LINE, stroke: LINE }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function PaceTip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  const row = active && payload && payload[0] ? payload[0].payload : null
  if (!row) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-strong)' }}>
      <div style={{ fontWeight: 600 }}>{row.label}</div>
      <div>{row.h == null ? 'This hour had no merge.' : `Median ${row.h} hours from opening to merge.`}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        {countWords(row.merged, 'merged')}, {countWords(row.created, 'opened')}.
      </div>
    </div>
  )
}
