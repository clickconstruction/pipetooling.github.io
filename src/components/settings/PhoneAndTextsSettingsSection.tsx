/**
 * Messages, cut 2's screens, PR D: Settings → Phone and texts → **Who gets a new message**, the prototype's settings card
 * (v1.178's `renderSettings`). The GC office team reads the rule with the seats' names; the owner and a dev pick each
 * seat and save it (`app_settings.messages_assign_rule_v1` through `assignRuleIo.ts`, the words `assignRule.ts`'s).
 * Quo's rows (cut 5) join the group below this card.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import {
  ASSIGN_RULE_AFTER,
  ASSIGN_RULE_FIRST,
  NO_SEATS,
  SEAT_GONE,
  SEAT_LABELS,
  SEATS_SAVED_TOAST,
  assignRuleRows,
  canSetAssignSeats,
  sameSeats,
  seatOptions,
  type AssignRuleSeats,
  type SeatKind,
} from '../../lib/messages/assignRule'
import { supabaseAssignRuleIo, type AssignRuleIo, type SeatPerson } from '../../lib/messages/assignRuleIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const DEFAULT_IO = supabaseAssignRuleIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const cell: CSSProperties = { padding: '0.4rem 0.5rem 0.4rem 0', borderTop: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'left' }

/** What an empty seat's choice says: nobody, or for the architects, the trade partners' seat. */
const EMPTY_CHOICE: Readonly<Record<SeatKind, string>> = { customer: 'Nobody', trade: 'Nobody', arch: 'Same as trade partners' }

export function PhoneAndTextsSettingsSection({ io = DEFAULT_IO }: { io?: AssignRuleIo }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const canSet = canSetAssignSeats(role)
  const [loaded, setLoaded] = useState<{ seats: AssignRuleSeats; team: SeatPerson[] } | null>(null)
  const [draft, setDraft] = useState<AssignRuleSeats>(NO_SEATS)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
  const nameOf = (id: string) => loaded?.team.find((t) => t.id === id)?.name ?? null
  const rows = assignRuleRows(canSet ? draft : (loaded?.seats ?? NO_SEATS), nameOf)
  const changed = loaded !== null && !sameSeats(draft, loaded.seats)

  const save = async () => {
    setSaving(true)
    setProblem(null)
    try {
      await io.save(draft)
      setLoaded((l) => (l ? { ...l, seats: draft } : l))
      showToast(SEATS_SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const picker = (kind: SeatKind) => {
    const value = draft[kind]
    const gone = value !== null && !options.some((o) => o.id === value)
    return (
      <select
        aria-label={`${SEAT_LABELS[kind]} seat`}
        value={value ?? ''}
        disabled={saving}
        onChange={(e) => setDraft((d) => ({ ...d, [kind]: e.target.value || null }))}
        style={{ ...clauseInputStyle, width: 'auto', minWidth: 200 }}
      >
        <option value="">{EMPTY_CHOICE[kind]}</option>
        {gone && <option value={value}>{SEAT_GONE}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <section aria-labelledby="phone-texts-who-gets-it" id="settings-phone-texts-who-gets-it" data-settings-who-gets-it style={cardStyle}>
      <h3 id="phone-texts-who-gets-it" style={{ margin: 0, fontSize: '1rem' }}>
        Who gets a new message
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{ASSIGN_RULE_FIRST}</p>
      {loaded ? (
        <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...muted, ...cell, borderTop: 'none', fontWeight: 600 }}>
                A message from
              </th>
              <th scope="col" style={{ ...muted, ...cell, borderTop: 'none', fontWeight: 600 }}>
                Goes to
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} data-seat-row={r.key}>
                <th scope="row" style={{ ...cell, fontWeight: 500 }}>
                  {r.who}
                </th>
                <td style={cell}>
                  {canSet && r.key !== 'unknown' ? (
                    <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {picker(r.key)}
                      {r.key === 'arch' && draft.arch === null && <span style={muted}>{r.goesTo}</span>}
                    </span>
                  ) : (
                    r.goesTo
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !problem && <p style={muted}>Loading the seats…</p>
      )}
      <p style={muted}>{ASSIGN_RULE_AFTER}</p>
      {canSet ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void save()} disabled={!changed || saving} style={changed && !saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
            {saving ? 'Saving…' : 'Save the seats'}
          </button>
          {changed && !saving && (
            <button type="button" onClick={() => loaded && setDraft(loaded.seats)} style={clauseButtonStyle}>
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
