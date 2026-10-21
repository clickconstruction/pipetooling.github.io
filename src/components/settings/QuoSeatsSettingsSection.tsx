/**
 * Messages, cut 5's screens: Settings → Phone and texts → **Company phone seats**, under cut 2's Who gets a new message
 * in the same group and written the same way. A seat is one of Quo's workspace users, by Quo's id, and the person who
 * answers on it, or **Shared by the office** (v2.5548, one login on several phones): `quo-send` texts as the sender's own
 * seat, else the shared one, and `quo-webhook` names a call or a text by the seat it rang, the shared one as the office.
 * The GC office team reads the seats with their people; the owner and a dev add, change and remove them and save
 * (`app_settings.messages_quo_seats_v1` through `quo/seatsCardIo.ts`, the words `quo/seatsCard.ts`'s). Since v2.5718
 * the Quo user id is picked from Quo's own members when the Quo connection above has a key and Quo answered
 * (`useQuoConnection`), with **Type it by hand** for a seat the list does not hold; without a key, or when Quo did not
 * answer, the id is typed as before.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { canSetAssignSeats, SEAT_GONE, seatOptions } from '../../lib/messages/assignRule'
import type { SeatPerson } from '../../lib/messages/assignRuleIo'
import { BY_HAND, idListed, memberLabel, pickerShows, QUO_NO_KEY_FOR_PICKERS, QUO_PICK_MEMBER, QUO_READ_FAILED_FOR_PICKERS, QUO_TYPE_BY_HAND } from '../../lib/quo/connection'
import { isSharedSeat, QUO_SEATS_INTRO, QUO_SEATS_NONE, QUO_SEATS_SAVED_TOAST, QUO_SEATS_WHY, quoSeatsProblem, sameQuoSeats, SEAT_SHARED, SEAT_SHARED_LABEL, type QuoSeatRow } from '../../lib/quo/seatsCard'
import { supabaseQuoSeatsIo, type QuoSeatsIo } from '../../lib/quo/seatsCardIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'
import { useQuoConnection } from './QuoConnectionContext'

const DEFAULT_IO = supabaseQuoSeatsIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const cell: CSSProperties = { padding: '0.4rem 0.5rem 0.4rem 0', borderTop: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'left' }
const small: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }
const linkButton: CSSProperties = { ...clauseButtonStyle, padding: '0.2rem 0.5rem', fontSize: '0.78rem', marginLeft: '0.4rem' }

/** The by-hand rows after row `removed` is gone: each later row moves up one. */
function handWithout(hand: ReadonlySet<number>, removed: number): Set<number> {
  const next = new Set<number>()
  for (const i of hand) {
    if (i < removed) next.add(i)
    else if (i > removed) next.add(i - 1)
  }
  return next
}

export function QuoSeatsSettingsSection({ io = DEFAULT_IO }: { io?: QuoSeatsIo }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const quo = useQuoConnection()
  const canSet = canSetAssignSeats(role)
  const [loaded, setLoaded] = useState<{ seats: QuoSeatRow[]; team: SeatPerson[] } | null>(null)
  const [draft, setDraft] = useState<QuoSeatRow[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** The rows whose Quo id is typed, by choice, while the picker shows. */
  const [hand, setHand] = useState<Set<number>>(() => new Set())
  const members = quo.directory?.members ?? []
  const picker = canSet && pickerShows(quo.state, members.length)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setLoaded(r)
        setDraft(r.seats)
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [io])

  const options = useMemo(() => seatOptions(loaded?.team ?? []), [loaded])
  const nameOf = (id: string) => (isSharedSeat(id) ? SEAT_SHARED_LABEL : loaded?.team.find((t) => t.id === id)?.name || SEAT_GONE)
  const changed = loaded !== null && !sameQuoSeats(draft, loaded.seats)
  const shown = canSet ? draft : (loaded?.seats ?? [])

  const setRow = (i: number, change: Partial<QuoSeatRow>) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...change } : r)))

  const save = async () => {
    const stop = quoSeatsProblem(draft)
    if (stop) {
      setProblem(stop)
      return
    }
    setSaving(true)
    setProblem(null)
    const clean = draft.map((r) => ({ quoUserId: r.quoUserId.trim(), userId: r.userId }))
    try {
      await io.save(clean)
      setLoaded((l) => (l ? { ...l, seats: clean } : l))
      setDraft(clean)
      showToast(QUO_SEATS_SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const head = { ...muted, ...cell, borderTop: 'none', fontWeight: 600 }

  return (
    <section aria-labelledby="phone-texts-quo-seats" id="settings-phone-texts-quo-seats" data-settings-quo-seats style={cardStyle}>
      <h3 id="phone-texts-quo-seats" style={{ margin: 0, fontSize: '1rem' }}>
        Company phone seats
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{QUO_SEATS_INTRO}</p>
      <p style={muted}>{QUO_SEATS_WHY}</p>
      {loaded ? (
        shown.length === 0 && !canSet ? (
          <p style={muted}>{QUO_SEATS_NONE}</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th scope="col" style={head}>
                  {picker ? 'Quo member' : 'Quo user id'}
                </th>
                <th scope="col" style={head}>
                  Who answers on it
                </th>
                {canSet && <th scope="col" style={head} aria-label="Remove" />}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...cell, ...muted }}>
                    {QUO_SEATS_NONE}
                  </td>
                </tr>
              )}
              {shown.map((r, i) => {
                const gone = r.userId !== '' && !isSharedSeat(r.userId) && !options.some((o) => o.id === r.userId)
                // With the picker up, a row is typed by hand when the owner chose to, or when its id is not one Quo listed.
                const byHand = hand.has(i) || (r.quoUserId.trim() !== '' && !idListed(r.quoUserId, members))
                const picked = picker ? members.find((m) => m.id === r.quoUserId.trim()) : undefined
                return (
                  <tr key={i} data-quo-seat={i}>
                    <td style={cell}>
                      {canSet && picker && !byHand ? (
                        <>
                          <select
                            aria-label={`Seat ${i + 1}: Quo member`}
                            value={picked ? picked.id : ''}
                            disabled={saving}
                            onChange={(e) => {
                              if (e.target.value === BY_HAND) {
                                setHand((h) => new Set(h).add(i))
                                setRow(i, { quoUserId: '' })
                              } else setRow(i, { quoUserId: e.target.value })
                            }}
                            style={{ ...clauseInputStyle, width: 'auto', minWidth: 220 }}
                          >
                            <option value="">{QUO_PICK_MEMBER}</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {memberLabel(m)}
                              </option>
                            ))}
                            <option value={BY_HAND}>{QUO_TYPE_BY_HAND}</option>
                          </select>
                          {picked && <code style={small}>{picked.id}</code>}
                        </>
                      ) : canSet ? (
                        <>
                          <input
                            aria-label={`Seat ${i + 1}: Quo user id`}
                            value={r.quoUserId}
                            placeholder="US…"
                            disabled={saving}
                            onChange={(e) => setRow(i, { quoUserId: e.target.value })}
                            style={{ ...clauseInputStyle, width: 180 }}
                          />
                          {picker && (
                            <button
                              type="button"
                              aria-label={`Seat ${i + 1}: pick from Quo`}
                              disabled={saving}
                              onClick={() => {
                                setHand((h) => {
                                  const next = new Set(h)
                                  next.delete(i)
                                  return next
                                })
                                setRow(i, { quoUserId: '' })
                              }}
                              style={linkButton}
                            >
                              Pick from Quo
                            </button>
                          )}
                        </>
                      ) : (
                        <code>{r.quoUserId}</code>
                      )}
                    </td>
                    <td style={cell}>
                      {canSet ? (
                        <select
                          aria-label={`Seat ${i + 1}: who answers on it`}
                          value={r.userId}
                          disabled={saving}
                          onChange={(e) => setRow(i, { userId: e.target.value })}
                          style={{ ...clauseInputStyle, width: 'auto', minWidth: 200 }}
                        >
                          <option value="">Pick someone</option>
                          <option value={SEAT_SHARED}>{SEAT_SHARED_LABEL}</option>
                          {gone && <option value={r.userId}>{SEAT_GONE}</option>}
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        nameOf(r.userId)
                      )}
                    </td>
                    {canSet && (
                      <td style={cell}>
                        <button
                          type="button"
                          aria-label={`Remove seat ${i + 1}`}
                          disabled={saving}
                          onClick={() => {
                            setDraft((d) => d.filter((_, j) => j !== i))
                            setHand((h) => handWithout(h, i))
                          }}
                          style={clauseButtonStyle}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      ) : (
        !problem && <p style={muted}>Loading the seats…</p>
      )}
      {canSet && !picker && quo.state === 'no-key' && <p style={muted}>{QUO_NO_KEY_FOR_PICKERS}</p>}
      {canSet && !picker && quo.state === 'read-failed' && <p style={muted}>{QUO_READ_FAILED_FOR_PICKERS}</p>}
      {canSet ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setDraft((d) => [...d, { quoUserId: '', userId: '' }])} disabled={!loaded || saving} style={clauseButtonStyle}>
            Add a seat
          </button>
          <button type="button" onClick={() => void save()} disabled={!changed || saving} style={changed && !saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
            {saving ? 'Saving…' : 'Save the seats'}
          </button>
          {changed && !saving && (
            <button
              type="button"
              onClick={() => {
                if (loaded) setDraft(loaded.seats)
                setHand(new Set())
                setProblem(null)
              }}
              style={clauseButtonStyle}
            >
              Put them back
            </button>
          )}
        </div>
      ) : (
        <p style={muted}>The owner or a dev sets the seats.</p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
