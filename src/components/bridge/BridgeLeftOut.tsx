import { useMemo, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { LEFT_OUT_ADDRESS_MIN, LEFT_OUT_KIND_WORDS, addressRule, leftOutWords, sameRule, type LeftOutKind, type LeftOutRule } from '../../lib/bridge/leftOut'
import type { LeftOutName } from '../../lib/bridge/leftOutIo'

/**
 * What the Bridge leaves out (punch list #334, PR 2): one line under the page's title that says what
 * is left out, and behind its press the list itself, where a person puts a thing back or leaves out a development,
 * a customer or an address. The page follows at once and the list is saved behind it.
 */

const KINDS: LeftOutKind[] = ['development', 'customer', 'address']
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '2px 4px 2px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const pressBase: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, minHeight: 32, padding: '0.2rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }
const linkPressBase: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: 0, minHeight: 28, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }
const fieldBase: CSSProperties = { font: 'inherit', fontSize: '0.86rem', minHeight: 34, padding: '0.2rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }

export function BridgeLeftOut({
  rules,
  isDefault,
  developments,
  customers,
  jobCount,
  narrow = false,
  onChange,
}: {
  rules: ReadonlyArray<LeftOutRule>
  /** True while the list was never saved. */
  isDefault: boolean
  developments: ReadonlyArray<LeftOutName>
  customers: ReadonlyArray<LeftOutName>
  /** How many jobs the list names today; null while that is being read. */
  jobCount: number | null
  /** A phone: every press and the field are 44 px tall. */
  narrow?: boolean
  onChange: (next: LeftOutRule[]) => void
}) {
  const [open, setOpen] = useState(false)
  const press: CSSProperties = narrow ? { ...pressBase, minHeight: 44 } : pressBase
  const linkPress: CSSProperties = narrow ? { ...linkPressBase, minHeight: 44 } : linkPressBase
  const field: CSSProperties = narrow ? { ...fieldBase, minHeight: 44 } : fieldBase
  const [kind, setKind] = useState<LeftOutKind>('development')
  const [typed, setTyped] = useState('')
  const names = kind === 'development' ? developments : customers
  const matches = useMemo(() => {
    if (kind === 'address') return []
    const q = typed.trim().toLowerCase()
    return names.filter((n) => (q === '' || n.name.toLowerCase().includes(q)) && !rules.some((r) => r.kind === kind && r.key === n.id)).slice(0, 8)
  }, [kind, typed, names, rules])
  const address = kind === 'address' ? addressRule(typed) : null
  const addressTaken = address != null && rules.some((r) => sameRule(r, address))
  const add = (rule: LeftOutRule) => {
    onChange([...rules, rule])
    setTyped('')
  }
  return (
    <section aria-label="What the Bridge leaves out" data-testid="bridge-left-out" style={{ marginBottom: '0.6rem', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.2rem 0.6rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <span data-testid="bridge-left-out-words">{leftOutWords(rules)}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="bridge-left-out-toggle" style={linkPress}>
          {open ? 'Done ▴' : 'Change ›'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 6, padding: '0.6rem 0.8rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', gap: 8 }} data-testid="bridge-left-out-panel">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>
            The Bridge does not count the jobs, bids and estimates of anything on this list.{jobCount != null ? ` Today that is ${jobCount.toLocaleString('en-US')} ${jobCount === 1 ? 'job' : 'jobs'}.` : ''}
            {isDefault ? ' This list has not been saved yet.' : ''}
          </div>
          {rules.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rules.map((r) => (
                <span key={`${r.kind}:${r.key}`} style={chip} data-testid="bridge-left-out-rule">
                  <span style={{ color: 'var(--text-muted)' }}>{LEFT_OUT_KIND_WORDS[r.kind]}</span>
                  <b>{r.label}</b>
                  <button type="button" onClick={() => onChange(rules.filter((x) => !sameRule(x, r)))} aria-label={`Put ${r.label} back`} style={{ ...linkPress, padding: '0 8px' }}>
                    Put back
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nothing is left out. Pick a development, a customer or an address below to leave it out.</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>Leave out a</span>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k)
                  setTyped('')
                }}
                aria-pressed={kind === k}
                data-testid={`bridge-left-out-kind-${k}`}
                style={{ ...press, border: kind === k ? '2px solid #2563eb' : '1px solid var(--border-strong)' }}
              >
                {LEFT_OUT_KIND_WORDS[k]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={kind === 'address' ? 'Words of the address' : `Find a ${kind}`}
              placeholder={kind === 'address' ? 'Words of the address, like 48 Quarry Road' : `Type to find a ${kind}`}
              data-testid="bridge-left-out-input"
              style={{ ...field, flex: '1 1 14rem' }}
            />
            {kind === 'address' && (
              <button
                type="button"
                disabled={address == null || addressTaken}
                onClick={() => address && add(address)}
                data-testid="bridge-left-out-add-address"
                style={{ ...press, ...(address == null || addressTaken ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : { background: '#2563eb', border: '1px solid #2563eb', color: '#ffffff' }) }}
              >
                Leave out this address
              </button>
            )}
          </div>
          {kind === 'address' ? (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {addressTaken ? 'That address is already left out.' : address == null ? `Type at least ${LEFT_OUT_ADDRESS_MIN} letters. Every job, bid and estimate whose address holds these words is left out.` : 'Every job, bid and estimate whose address holds these words is left out.'}
            </div>
          ) : matches.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {matches.map((n) => (
                <button key={n.id} type="button" onClick={() => add({ kind, key: n.id, label: n.name })} data-testid="bridge-left-out-match" style={press}>
                  Leave out {n.name}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{typed.trim() ? 'That name matches nothing here. Try fewer letters.' : `Every ${kind} is already on the list.`}</div>
          )}
        </div>
      )}
    </section>
  )
}
