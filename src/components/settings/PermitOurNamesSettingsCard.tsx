import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { OUR_NAMES_ADD_LABEL, OUR_NAMES_CARD, OUR_NAMES_INTRO, OUR_NAMES_TAB, OUR_NAME_MAX_LENGTH, companyNameLine, ourNamesValueLine, type OurNames } from '../../lib/research/ourNames'
import { changeOurNames, loadOurNames } from '../../lib/research/ourNamesIo'
import { EmptyState } from '../EmptyState'
import { SettingsFoldCard } from './SettingsFoldCard'

/**
 * Settings → Company → Our names on plumbing permits (punch list #307, PR 3's leftover): the
 * short list of names a city lists that are us. Add a name, take one back, and nothing else. A
 * bid's permit lines and the Bid Board read a plumbing permit under one of them as ours, never as
 * another plumber's. The company name on paper bills counts without being added, and the card
 * says so. The owner or a dev edits it (`app_settings.permit_our_names_v1`, a key-scoped policy);
 * a refusal reads its reason.
 */
const muted: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }
const ghost: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '6px 12px', minHeight: 34, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const add: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '6px 12px', minHeight: 34, borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }

type Loaded = { state: 'loading' } | { state: 'done'; ours: OurNames } | { state: 'failed'; message: string }

export function PermitOurNamesSettingsCard() {
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const read = useCallback(() => {
    let live = true
    setLoaded({ state: 'loading' })
    loadOurNames()
      .then((ours) => {
        if (live) setLoaded({ state: 'done', ours })
      })
      .catch((e) => {
        if (live) setLoaded({ state: 'failed', message: formatErrorMessage(e, 'Could not read the names.') })
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => read(), [read])

  const change = async (what: { add: string } | { remove: string }) => {
    setBusy(true)
    setWhy(null)
    try {
      const { result, ours } = await changeOurNames(what)
      setLoaded({ state: 'done', ours })
      if (!result.ok) {
        setWhy(result.reason)
        return
      }
      if ('add' in what) {
        setTyped('')
        showToast('Added. A plumbing permit under that name now reads as ours.', 'success')
      } else {
        showToast(`${what.remove} is off the list.`, 'success')
      }
    } catch (e) {
      setWhy(formatErrorMessage(e, 'Could not save the names.'))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void change({ add: typed })
  }

  const ours = loaded.state === 'done' ? loaded.ours : null

  return (
    <SettingsFoldCard card={OUR_NAMES_CARD} track={OUR_NAMES_TAB} valueLine={ours ? ourNamesValueLine(ours) : null}>
      <div data-our-permit-names style={{ padding: '1rem', display: 'grid', gap: 10 }}>
        <p style={muted}>{OUR_NAMES_INTRO}</p>
        {loaded.state === 'loading' && <p style={muted}>Reading the list…</p>}
        {loaded.state === 'failed' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...muted, color: 'var(--text-red-700)' }}>{loaded.message}</span>
            <button type="button" onClick={() => read()} style={ghost}>
              Try again
            </button>
          </div>
        )}
        {ours && (
          <>
            <p style={muted}>{companyNameLine(ours.companyName)}</p>
            {ours.names.length === 0 ? (
              <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'names', control: OUR_NAMES_ADD_LABEL }), { onPress: () => inputRef.current?.focus() })} />
            ) : (
              <ul aria-label="Names that are us" style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--border)' }}>
                {ours.names.map((name) => (
                  <li key={name} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <strong style={{ flex: '1 1 180px', minWidth: 0, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{name}</strong>
                    <button type="button" disabled={busy} aria-label={`Take back ${name}`} onClick={() => void change({ remove: name })} style={{ ...ghost, opacity: busy ? 0.6 : 1 }}>
                      Take back
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={inputRef}
                aria-label="A name as the city lists it"
                placeholder="A name as the city lists it"
                value={typed}
                maxLength={OUR_NAME_MAX_LENGTH}
                disabled={busy}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setWhy(null)
                }}
                style={{ flex: '1 1 220px', minWidth: 0, font: 'inherit', fontSize: '0.875rem', padding: '6px 8px', minHeight: 34, boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
              />
              <button type="submit" disabled={busy} style={{ ...add, opacity: busy ? 0.6 : 1 }}>
                {OUR_NAMES_ADD_LABEL}
              </button>
            </form>
            {why && (
              <p role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
                {why}
              </p>
            )}
          </>
        )}
      </div>
    </SettingsFoldCard>
  )
}
