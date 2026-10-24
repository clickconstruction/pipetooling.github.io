/**
 * Quickfill's Email station (punch list #159, v2.5824): Settings → Phone and texts → **Mail the app counts**, for the
 * owner and a dev. The switch for the `gmail-count` sweep (`email_count_on_v1`, turned on after a confirm since it
 * starts reading the listed mailboxes), the limit in days (`email_count_limit_days_v1`), the app's own list of what it
 * reads (`email_box_watch`): the shared boxes and the people, each with its labels, its own switch, what the last count
 * found and how it is doing; and the one lead who sees every person's rows (`email_count_lead_v1`). The rules and the
 * words are `emailIn/countCard.ts`; the reads and writes `countCardIo.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import {
  ADD_PERSON,
  ADD_SHARED,
  addressProblem,
  boxHealthWords,
  cleanAddress,
  COUNT_ADMIN_STEP,
  COUNT_CONFIRM,
  COUNT_OFF_TOAST,
  COUNT_ON_TOAST,
  COUNT_TITLE,
  COUNT_WHAT,
  LABELS_HINT,
  labelCountsWords,
  labelsFromText,
  labelsText,
  LEAD_NOBODY,
  LEAD_NOTE,
  LEAD_TITLE,
  LIMIT_AFTER,
  LIMIT_BEFORE,
  LIMIT_MAX,
  LIMIT_MIN,
  PEOPLE_TITLE,
  peopleToAdd,
  PERSON_OFF_NOTE,
  REMOVE,
  REMOVE_CONFIRM,
  SHARED_TITLE,
  splitWatch,
  type CountPerson,
  type WatchView,
} from '../../lib/emailIn/countCard'
import { supabaseEmailCountIo, type EmailCountIo } from '../../lib/emailIn/countCardIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const DEFAULT_IO = supabaseEmailCountIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const cell: CSSProperties = { padding: '0.45rem 0.5rem 0.45rem 0', borderTop: '1px solid var(--border)', verticalAlign: 'top', textAlign: 'left' }
const sub: CSSProperties = { margin: '0.35rem 0 0', fontSize: '0.9rem', fontWeight: 600 }

type Loaded = { on: boolean; leadId: string | null; limitDays: number; rows: WatchView[]; people: CountPerson[] }

function Switch({ on, label, busy, onFlip }: { on: boolean; label: string; busy: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onFlip}
      disabled={busy}
      style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 999,
        padding: '0.15rem 0.7rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: busy ? 'default' : 'pointer',
        background: on ? '#16a34a' : 'var(--surface)',
        color: on ? 'white' : 'var(--text-base)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? 'Saving…' : on ? 'On' : 'Off'}
    </button>
  )
}

/** One row of the list: who or which box, its labels (typed, saved with Save), what the count found, its switch. */
function WatchRowView({ row, name, nowIso, busy, onLabels, onSwitch, onRemove }: { row: WatchView; name: string; nowIso: string; busy: boolean; onLabels: (labels: string[]) => void; onSwitch: () => void; onRemove: () => void }) {
  const saved = labelsText(row.labels)
  const [text, setText] = useState(saved)
  useEffect(() => setText(saved), [saved])
  const dirty = labelsText(labelsFromText(text)) !== saved
  return (
    <tr data-count-row={row.address}>
      <td style={{ ...cell, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {name}
        {name !== row.address && <div style={{ ...muted, fontWeight: 400 }}>{row.address}</div>}
      </td>
      <td style={{ ...cell, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <input aria-label={`${name}: labels`} title={LABELS_HINT} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} style={{ ...clauseInputStyle, minWidth: 160 }} />
          {dirty && (
            <button type="button" disabled={busy} onClick={() => onLabels(labelsFromText(text))} style={clausePrimaryStyle}>
              Save
            </button>
          )}
        </div>
        <div style={{ ...muted, marginTop: '0.25rem' }} data-count-found>
          {labelCountsWords(row)}
        </div>
      </td>
      <td style={{ ...cell, ...muted, fontSize: '0.8rem', maxWidth: 260 }} data-count-health>
        {boxHealthWords(row, nowIso)}
      </td>
      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <Switch on={row.is_on} label={`Count ${name}`} busy={busy} onFlip={onSwitch} />
          <button type="button" disabled={busy} onClick={onRemove} style={clauseButtonStyle}>
            {REMOVE}
          </button>
        </div>
      </td>
    </tr>
  )
}

export function EmailCountSettingsCard({ io = DEFAULT_IO, nowIso }: { io?: EmailCountIo; nowIso?: string }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [limitText, setLimitText] = useState('')
  const [newShared, setNewShared] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const now = nowIso ?? new Date().toISOString()

  const reload = () =>
    io.load().then(
      (r) => {
        setLoaded(r)
        setLimitText(String(r.limitDays))
      },
      (e: unknown) => setProblem(formatErrorMessage(e)),
    )

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setLoaded(r)
        setLimitText(String(r.limitDays))
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [io])

  const split = useMemo(() => (loaded ? splitWatch(loaded.rows, loaded.people) : { shared: [], persons: [] }), [loaded])
  const toAdd = useMemo(() => (loaded ? peopleToAdd(loaded.people, loaded.rows) : []), [loaded])

  /** One press: `key` marks what is busy; the write, then a fresh read, or the write's own words. */
  const act = async (key: string, write: () => Promise<unknown>, done?: string) => {
    setBusy(key)
    setProblem(null)
    try {
      await write()
      await reload()
      if (done) showToast(done, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const flip = async () => {
    if (!loaded) return
    const next = !loaded.on
    // Turning it on starts reading the listed mailboxes, so it asks first. Turning it off does not.
    if (next && !(await confirm({ ...COUNT_CONFIRM, cancelIsSafe: true }))) return
    await act('switch', () => io.setOn(next), next ? COUNT_ON_TOAST : COUNT_OFF_TOAST)
  }

  const remove = async (row: WatchView, what: string) => {
    if (!(await confirm({ ...REMOVE_CONFIRM(what), cancelIsSafe: true, danger: true }))) return
    await act(`remove:${row.id}`, () => io.remove(row.id))
  }

  const limitNumber = Number.parseInt(limitText, 10)
  const limitOk = Number.isInteger(limitNumber) && limitNumber >= LIMIT_MIN && limitNumber <= LIMIT_MAX
  const sharedProblem = newShared.trim() && loaded ? addressProblem(newShared, loaded.rows) : null
  const neverCounted = loaded !== null && !loaded.rows.some((r) => r.last_ok_at)

  const rowFor = (row: WatchView, name: string) => (
    <WatchRowView
      key={row.id}
      row={row}
      name={name}
      nowIso={now}
      busy={busy !== null}
      onLabels={(labels) => void act(`labels:${row.id}`, () => io.setLabels(row.id, labels))}
      onSwitch={() => void act(`row:${row.id}`, () => io.setRowOn(row.id, !row.is_on))}
      onRemove={() => void remove(row, name)}
    />
  )

  const head = (
    <thead>
      <tr>
        {['Box', 'Labels', 'How it is going', ''].map((h) => (
          <th key={h} scope="col" style={{ ...muted, ...cell, borderTop: 'none', fontWeight: 600 }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  )

  return (
    <section aria-labelledby="phone-texts-email-count" id="settings-phone-texts-email-count" data-settings-email-count style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-email-count" style={{ margin: 0, fontSize: '1rem' }}>
          {COUNT_TITLE}
        </h3>
        {loaded && <Switch on={loaded.on} label={COUNT_TITLE} busy={busy === 'switch'} onFlip={() => void flip()} />}
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{COUNT_WHAT}</p>
      {!loaded && !problem && <p style={muted}>Loading the list…</p>}
      {loaded && (
        <>
          {neverCounted && (
            <p style={muted} data-count-admin-step>
              {COUNT_ADMIN_STEP}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <label htmlFor="email-count-limit" style={{ fontWeight: 600 }}>
              {LIMIT_BEFORE}
            </label>
            <input id="email-count-limit" inputMode="numeric" value={limitText} disabled={busy !== null} onChange={(e) => setLimitText(e.target.value)} style={{ ...clauseInputStyle, width: '4rem', textAlign: 'right' }} />
            <span>{LIMIT_AFTER}</span>
            {limitText !== String(loaded.limitDays) && (
              <button type="button" disabled={!limitOk || busy !== null} onClick={() => void act('limit', () => io.setLimit(limitNumber))} style={clausePrimaryStyle}>
                Save the limit
              </button>
            )}
          </div>

          <h4 style={sub}>{SHARED_TITLE}</h4>
          {split.shared.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem', width: '100%' }}>
                {head}
                <tbody>{split.shared.map((r) => rowFor(r, r.address))}</tbody>
              </table>
            </div>
          ) : (
            <p style={muted}>No shared box yet.</p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input aria-label="A shared box's address" placeholder="work@…" value={newShared} disabled={busy !== null} onChange={(e) => setNewShared(e.target.value)} style={{ ...clauseInputStyle, width: 'auto', minWidth: 220 }} />
            <button
              type="button"
              disabled={!newShared.trim() || !!sharedProblem || busy !== null}
              onClick={() =>
                void act('add-shared', async () => {
                  await io.addShared(cleanAddress(newShared)!)
                  setNewShared('')
                })
              }
              style={clauseButtonStyle}
            >
              {ADD_SHARED}
            </button>
            {sharedProblem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{sharedProblem}</span>}
          </div>

          <h4 style={sub}>{PEOPLE_TITLE}</h4>
          {split.persons.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem', width: '100%' }}>
                {head}
                <tbody>{split.persons.map((r) => rowFor(r, r.name))}</tbody>
              </table>
            </div>
          ) : (
            <p style={muted}>No one yet.</p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select aria-label="A person to count" value={newPerson} disabled={busy !== null || toAdd.length === 0} onChange={(e) => setNewPerson(e.target.value)} style={{ ...clauseInputStyle, width: 'auto', minWidth: 220 }}>
              <option value="">{toAdd.length ? 'Pick someone' : 'Everyone with an email is on the list'}</option>
              {toAdd.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!newPerson || busy !== null}
              onClick={() =>
                void act('add-person', async () => {
                  const person = toAdd.find((p) => p.id === newPerson)
                  if (person) await io.addPerson(person)
                  setNewPerson('')
                })
              }
              style={clauseButtonStyle}
            >
              {ADD_PERSON}
            </button>
          </div>
          <p style={muted}>{PERSON_OFF_NOTE}</p>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <label htmlFor="email-count-lead" style={{ fontWeight: 600 }}>
              {LEAD_TITLE}
            </label>
            <select id="email-count-lead" value={loaded.leadId ?? ''} disabled={busy !== null} onChange={(e) => void act('lead', () => io.setLead(e.target.value || null))} style={{ ...clauseInputStyle, width: 'auto', minWidth: 180 }}>
              <option value="">{LEAD_NOBODY}</option>
              {loaded.leadId && !loaded.people.some((p) => p.id === loaded.leadId) && <option value={loaded.leadId}>Someone no longer on the team</option>}
              {loaded.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <p style={muted}>{LEAD_NOTE}</p>
        </>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
