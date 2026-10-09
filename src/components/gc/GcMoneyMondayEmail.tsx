import { useCallback, useEffect, useMemo, useState } from 'react'
import { Btn, Card, Why, input } from './gcUi'
import { moneyMondayChainWords, moneyMondayChains, planMoneyMondayEdit, type MoneyMondayChain, type MoneyMondayRequestRow } from '../../lib/gc/moneyMondayEmail'

/**
 * GC mode, the real build, Owner Billing's O7b: the Monday money email on Money (the gc_money_monday stream). Who owes
 * us and what went last week, by email, on the days a member of the money team picks, for themselves or each other.
 * Each weekday is a weekly chain (`moneyMondayChains`); Save adds and stops chains (`planMoneyMondayEdit`). See the
 * email draws it as it would go now, and Email me a test sends a [TEST] copy to the signed-in member only. The reads
 * and writes come in as `io`, gcIo's in the page.
 */

export interface MoneyMondayIo {
  list: () => Promise<MoneyMondayRequestRow[]>
  apply: (plan: { inserts: Omit<MoneyMondayRequestRow, 'id'>[]; cancelIds: string[] }) => Promise<void>
  preview: () => Promise<{ subject: string; html: string }>
  test: () => Promise<void>
}

const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
]

export function GcMoneyMondayEmail({
  me,
  team,
  io,
}: {
  me: { id: string; name: string }
  /** The money team, who may get it. */
  team: { id: string; name: string }[]
  io: MoneyMondayIo
}) {
  const [rows, setRows] = useState<MoneyMondayRequestRow[] | null>(null)
  const [recipient, setRecipient] = useState(me.id)
  const [days, setDays] = useState<number[]>([1])
  const [time, setTime] = useState('07:00')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await io.list())
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The Monday emails did not load.')
      setRows([])
    }
  }, [io])
  useEffect(() => {
    void load()
  }, [load])

  const chains = useMemo(() => moneyMondayChains(rows ?? []), [rows])
  const current = chains.find((c) => c.recipientUserId === recipient) ?? null
  // Picking someone shows the days and time they get it on now, or Monday at 7 for someone new.
  useEffect(() => {
    setDays(current ? current.weekdays : [1])
    setTime(current ? current.timeHm : '07:00')
  }, [recipient, current])
  const people = useMemo(() => {
    const byId = new Map(team.map((p) => [p.id, p.name]))
    if (!byId.has(me.id)) byId.set(me.id, me.name)
    return [...byId.entries()].map(([id, name]) => ({ id, name }))
  }, [team, me])
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? ''

  const run = async (key: string, work: () => Promise<void>, failed: string) => {
    setBusy(key)
    setProblem(null)
    setNote(null)
    try {
      await work()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : failed)
    } finally {
      setBusy(null)
    }
  }
  const save = () => {
    const plan = planMoneyMondayEdit({ requestedBy: me.id, recipientUserId: recipient, desiredWeekdays: days, desiredTimeHm: time, current })
    if (!plan.ok) {
      setProblem(plan.error)
      return
    }
    void run(
      'save',
      async () => {
        await io.apply(plan)
        await load()
        setNote(days.length === 0 ? 'It stopped.' : 'Saved.')
      },
      'The Monday email was not saved.',
    )
  }
  const stop = (chain: MoneyMondayChain) =>
    void run(
      `stop-${chain.recipientUserId}`,
      async () => {
        await io.apply({ inserts: [], cancelIds: chain.allRowIds })
        await load()
      },
      'The Monday email did not stop.',
    )
  const toggle = (dow: number) => setDays((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]))
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>The Monday money email</div>
      <Why>Who owes us and what went last week, by email. Pick the days and the time. It goes then each week.</Why>
      <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.6rem', fontSize: '0.875rem' }}>
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        )}
        {rows === null ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : chains.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Nobody gets it yet.</div>
        ) : (
          chains.map((c) => (
            <div key={c.recipientUserId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{moneyMondayChainWords(c, nameOf(c.recipientUserId), c.recipientUserId === me.id)}</span>
              <Btn kind="quiet" disabled={busy !== null} onClick={() => stop(c)}>
                Stop it
              </Btn>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={label}>
            Who gets it
            <select aria-label="Who gets the Monday money email" style={input} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === me.id ? `${p.name || 'Me'} (me)` : p.name}
                </option>
              ))}
            </select>
          </label>
          <div style={label}>
            The days
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {DAYS.map((d) => (
                <button
                  key={d.dow}
                  type="button"
                  aria-pressed={days.includes(d.dow)}
                  onClick={() => toggle(d.dow)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    borderRadius: 999,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    border: '1px solid var(--border-strong)',
                    background: days.includes(d.dow) ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: days.includes(d.dow) ? 'var(--text-blue-800)' : 'var(--text-base)',
                    fontWeight: days.includes(d.dow) ? 600 : 400,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <label style={label}>
            At, Central time
            <input aria-label="The time it goes" style={input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <Btn kind="primary" disabled={busy !== null || (days.length === 0 && !current)} onClick={save}>
            {days.length === 0 && current ? 'Stop it' : 'Save'}
          </Btn>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            kind="quiet"
            disabled={busy !== null}
            onClick={() =>
              void run(
                'preview',
                async () => {
                  setPreview(await io.preview())
                },
                'The email did not load.',
              )
            }
          >
            See the email as it would go now
          </Btn>
          <Btn
            kind="quiet"
            disabled={busy !== null}
            onClick={() =>
              void run(
                'test',
                async () => {
                  await io.test()
                  setNote('A test went to your email.')
                },
                'The test did not go.',
              )
            }
          >
            Email me a test
          </Btn>
          {note && <span style={{ color: 'var(--text-muted)' }}>{note}</span>}
        </div>
        {preview && (
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>{preview.subject}</div>
            {/* The email's own page, sandboxed (no scripts, no reach into the app), and light as an inbox shows it. */}
            <div data-theme="light">
              <iframe title="The Monday money email" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
