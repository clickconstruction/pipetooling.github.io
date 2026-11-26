/** Settings → Data & recovery → "Kept map addresses (dev)" (punch list #443, row 9): the take-back of an address
 * typed in a Job Address box and left, which the map's look-up keeps in its cache though no job was made. A dev
 * finds a kept address by its words and clears it, and only when no record anywhere holds its street line. The rule
 * and its refusals are lib/map/keptAddressClear.ts; the reads and the delete lib/map/keptAddressClearIo.ts.
 * Self-contained like the sibling sections, and it draws nothing for any role but a dev. */
import { useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { KEPT_ADDRESS_SEARCH_LIMIT, keptAddressClearConfirm, keptAddressClearDrawn, keptAddressClearedWords, keptAddressClearProblem, keptAddressLikePattern, keptAddressSearchProblem } from '../../lib/map/keptAddressClear'
import { geocodeMissAsksAgainAt } from '../../../supabase/functions/_shared/geocodeMissMemory'
import { clearKeptAddress, readKeptAddressHits, searchKeptAddresses, type KeptAddress } from '../../lib/map/keptAddressClearIo'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const dayOf = (iso: string | null | undefined): string => {
  const ymd = iso && Number.isFinite(Date.parse(iso)) ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : ''
}
const keptDay = (iso: string | null): string => {
  const day = dayOf(iso)
  return day ? `Kept ${day}.` : ''
}
/** A miss's line (#443, row 16): the day the services were asked, and the day it stops counting by itself. */
const missLine = (iso: string | null): string => {
  const checked = dayOf(iso)
  const again = dayOf(geocodeMissAsksAgainAt(iso)?.toISOString())
  return [checked ? `No map service could place it. Checked ${checked}.` : 'No map service could place it.', again ? `It stops counting ${again} by itself.` : ''].filter(Boolean).join(' ')
}

export default function KeptMapAddressesBlock({ role }: { role: string | null | undefined }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [finding, setFinding] = useState(false)
  /** What the last search found; null before any search. */
  const [found, setFound] = useState<{ words: string; rows: KeptAddress[] } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  /** Why an address stayed when its clear was pressed, by its key: what is written under it, kept on its line. */
  const [stayed, setStayed] = useState<Record<string, string>>({})
  if (!keptAddressClearDrawn(role)) return null

  const searchProblem = keptAddressSearchProblem(typed)
  const find = async () => {
    if (searchProblem || finding) return
    setFinding(true)
    try {
      const words = typed.trim()
      setFound({ words, rows: await searchKeptAddresses(words) })
      setStayed({})
    } catch (e) {
      showToast(formatErrorMessage(e, 'The kept addresses did not read.'), 'error')
    } finally {
      setFinding(false)
    }
  }

  const clear = async (row: KeptAddress) => {
    if (busyKey || !keptAddressLikePattern(row.key)) return
    setBusyKey(row.key)
    try {
      const problem = keptAddressClearProblem(row.key, await readKeptAddressHits(row.key))
      if (problem) {
        setStayed((s) => ({ ...s, [row.key]: problem }))
        return
      }
      if (!(await confirmDialog({ ...keptAddressClearConfirm(row.key, row.kind), danger: true }))) return
      await clearKeptAddress(row.key, row.kind)
      showToast(keptAddressClearedWords(row.kind), 'success')
      setFound((f) => (f ? { ...f, rows: f.rows.filter((r) => !(r.key === row.key && r.kind === row.kind)) } : f))
    } catch (e) {
      showToast(formatErrorMessage(e, 'The address was not cleared.'), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8125rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
  const findDead = !!searchProblem || finding
  return (
    <div data-testid="kept-map-addresses" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left', color: 'var(--text-base)' }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Kept map addresses (dev)
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ ...muted, margin: '0.75rem 0', fontSize: '0.875rem' }}>
            The map keeps every address it looks up, and an address typed in a Job Address box is kept even when no job is made. An address no map service could place is kept beside them as a miss for 30 days. Find either by its words. One is cleared only when no record anywhere holds its street line.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void find()
                }
              }}
              placeholder="Words of the address"
              aria-label="Words of the address"
              style={{ flex: '1 1 14rem', minWidth: 0, minHeight: 44, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)', fontFamily: 'inherit', fontSize: '1rem' }}
            />
            <button
              type="button"
              onClick={() => void find()}
              disabled={findDead}
              style={{ minHeight: 44, padding: '0.5rem 1rem', border: 'none', borderRadius: 4, fontFamily: 'inherit', fontWeight: 500, cursor: findDead ? 'default' : 'pointer', background: findDead ? DEAD_PRESS_FILL : '#2563eb', color: findDead ? DEAD_PRESS_TEXT : '#fff' }}
            >
              {finding ? 'Finding…' : 'Find kept addresses'}
            </button>
          </div>
          {typed.trim() && searchProblem ? <p style={{ ...muted, margin: '0.35rem 0 0' }}>{searchProblem}</p> : null}
          {found && found.rows.length === 0 ? (
            <p style={{ ...muted, margin: '0.75rem 0 0' }} data-testid="kept-map-addresses-none">
              The map keeps no address with the words {found.words}. Type fewer words and press Find kept addresses.
            </p>
          ) : null}
          {found && found.rows.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              {found.rows.map((row) => {
                const problem = (keptAddressLikePattern(row.key) ? '' : keptAddressClearProblem(row.key, [])) || stayed[row.key] || ''
                const dead = !!problem || busyKey != null
                return (
                  <div key={`${row.kind}:${row.key}`} data-testid="kept-map-address" data-kind={row.kind} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.75rem', alignItems: 'center', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      <b style={{ color: 'var(--text-strong)' }}>{row.key}</b>
                      <span style={{ ...muted, display: 'block' }}>{row.kind === 'miss' ? missLine(row.keptAtIso) : [keptDay(row.keptAtIso), row.placed ? '' : 'The map could not place it.'].filter(Boolean).join(' ')}</span>
                      {problem ? (
                        <span style={{ ...muted, display: 'block' }} data-testid="kept-map-address-why">
                          {problem}
                        </span>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => void clear(row)} disabled={dead} aria-label={`Clear ${row.kind === 'miss' ? 'the miss ' : ''}${row.key}`} style={problem ? { ...word, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : { ...word, color: 'var(--text-red-700)', cursor: dead ? 'default' : 'pointer' }}>
                      {busyKey === row.key ? 'Checking…' : 'Clear…'}
                    </button>
                  </div>
                )
              })}
              {found.rows.length >= KEPT_ADDRESS_SEARCH_LIMIT ? <p style={{ ...muted, margin: '0.5rem 0 0' }}>These are the {KEPT_ADDRESS_SEARCH_LIMIT} kept last. Type more words to narrow them.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
