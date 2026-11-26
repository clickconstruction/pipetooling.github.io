/**
 * Add a part to a box (punch list #209): the sheet that asks which part and how many. It offers the names the job
 * already holds first, then the parts book, then the words as typed, and hands the part and the count up. The host
 * writes the row. It lived inside `TallyOnSiteTab.tsx` until v2.8282, when the office's Materials desk
 * (`JobsMaterialsTab.tsx`) needed the same sheet: a master technician is sent to that desk on his phone, and it had no
 * way to put a part into a box. The Tally draws and does what it did.
 *
 * `Stepper` is the number field every sheet of the On site tab asks a count with.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ADD_PART_MAX, QUANTITY_CHIPS, addAnotherLabel, addPartChoices, addPartDoneWords, chipAdds, type AddPartPick } from '../../lib/materials/addPart'
import { matchOnHandNames, onHandNameWords, type OnHandName } from '../../lib/materials/onSiteNames'
import type { Container } from '../../lib/materials/onSite'
import { stepperKeeps, stepperTyped } from '../../lib/materials/stepperInput'
import { Sheet } from './OnSiteSheet'

/** A part of the parts book, as the sheet's search lists it. */
export type OnSitePart = { id: string; name: string; manufacturer: string | null }

// The On site tab's own styles, as `TallyOnSiteTab.tsx` writes them.
const TOUCH_MIN = 48
const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: TOUCH_MIN, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const btnBlock: CSSProperties = { width: '100%' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 36, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }
const input: CSSProperties = { width: '100%', minHeight: TOUCH_MIN, padding: '0.6rem 0.9rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const dis = (off: boolean): CSSProperties => (off ? { opacity: 0.45, cursor: 'default' } : {})

export function Stepper({ n, max, onChange, autoSelect = false }: { n: number; max: number; onChange: (n: number) => void; /** The field takes the focus with its number selected, so the first key typed replaces it (v2.8284). */ autoSelect?: boolean }) {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!autoSelect) return
    field.current?.focus()
    field.current?.select()
  }, [autoSelect])
  const stepBtn: CSSProperties = { ...btn, width: 56, height: 56, padding: 0, fontSize: '1.5rem', borderRadius: 12 }
  // What is in the field while it is typed in; null when it shows `n`. Clearing the field used to put the 1 back at
  // once (v2.7252), so 25 could not be typed over it. A press of − or +, a quick number or leaving the field shows `n`.
  const [typed, setTyped] = useState<string | null>(null)
  useEffect(() => { setTyped(null) }, [n])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.9rem' }}>
      <button type="button" aria-label="One fewer" style={{ ...stepBtn, ...dis(n <= 1) }} disabled={n <= 1} onClick={() => onChange(Math.max(1, n - 1))}>−</button>
      <input ref={field} type="number" inputMode="numeric" value={typed ?? n} min={1} max={max} aria-label="How many" onChange={(e) => { setTyped(stepperKeeps(e.target.value, max)); const v = stepperTyped(e.target.value, max); if (v != null) onChange(v) }} onBlur={() => setTyped(null)} style={{ ...input, width: 96, textAlign: 'center', fontSize: '2rem', fontWeight: 800, minHeight: 56 }} />
      <button type="button" aria-label="One more" style={{ ...stepBtn, ...dis(n >= max) }} disabled={n >= max} onClick={() => onChange(Math.min(max, n + 1))}>+</button>
    </div>
  )
}

export function AddPartSheet({ container, names, searchParts, words, onClose, onAdd, onAddAnother }: { container: Container; /** Other words for the sheet, when the part is not being added to the box (Take from a box). */ words?: { title: string; sub: string; press: (n: number) => string }; /** The names this job already holds (punch list #330): offered first, so a part is not typed a second way. */ names: ReadonlyArray<OnHandName>; searchParts: (term: string) => Promise<OnSitePart[]>; onClose: () => void; onAdd: (part: AddPartPick, n: number) => void; /** **Add 40 and another part** (v2.8284): the host writes the part and answers whether it did; the sheet then stays, back on the picker. With none there is no such press. */ onAddAnother?: (part: AddPartPick, n: number) => boolean }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<OnSitePart[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<AddPartPick | null>(null)
  const [n, setN] = useState(1)
  /** Whether the number has been set by hand or by a chip: a chip on the opening 1 gives its own number. */
  const [touched, setTouched] = useState(false)
  /** What the last **and another part** wrote, said quietly in the sheet while the next part is picked. */
  const [note, setNote] = useState<string | null>(null)
  const pick = (part: AddPartPick) => { setPicked(part); setN(1); setTouched(false) }
  useEffect(() => {
    if (!term.trim() || picked) {
      setResults([])
      return
    }
    let live = true
    setSearching(true)
    const t = setTimeout(() => {
      searchParts(term).then((r) => { if (live) { setResults(r); setSearching(false) } }).catch(() => { if (live) setSearching(false) })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [term, picked, searchParts])
  const matches = picked ? [] : matchOnHandNames(names, term)
  // The sheet opens with choices (v2.8284): the box's own words, then the job's names. The Take flow keeps its own opening.
  const choices = addPartChoices({ term, names: words ? [] : names, matches, boxSaid: words ? null : container.said })
  const already = picked ? [] : term.trim() ? matches : choices.already
  const listHead: CSSProperties = { ...muted, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit', minHeight: TOUCH_MIN }
  // The press that acts stays on the screen while the number it acts on is typed (punch list #398, finding 263): it
  // stands in the sheet's foot, which does not scroll, so it sits on the keys' top at any height. Last in the scroller,
  // it was a sliver at the fold on a 375 by 667 phone with the number pad up.
  const addPress = picked ? (
    <button type="button" data-testid="add-part-primary" style={{ ...btnPrimary, ...btnBlock, minHeight: 52 }} onClick={() => onAdd(picked, n)}>
      {words ? words.press(n) : `Add ${n} to ${container.label}`}
    </button>
  ) : undefined
  return (
    <Sheet title={words?.title ?? `Add a part to ${container.label}`} sub={picked ? `${picked.partName}${picked.manufacturer ? ` · ${picked.manufacturer}` : ''}` : (words?.sub ?? 'Pick a name this job already has, find it in the parts book, or type its name.')} onClose={onClose} footer={addPress}>
      {!picked ? (
        <>
          {note ? <p role="status" style={{ ...muted, margin: 0, fontWeight: 600 }} data-testid="add-part-note">{note}</p> : null}
          <input type="search" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Part name or manufacturer" aria-label="Search the parts book" style={input} />
          {/* The words as typed come first (v2.8284): under the lists the keyboard hid them. */}
          {choices.asTyped ? <button type="button" style={{ ...btn, ...btnBlock, fontWeight: 500 }} onClick={() => pick({ partId: null, partName: choices.asTyped as string, manufacturer: null })} data-testid="add-part-as-typed">Use “{choices.asTyped}” as typed</button> : null}
          {choices.boxSays ? (
            <div style={{ display: 'grid', gap: '0.3rem' }} data-testid="add-part-box-says">
              <span style={listHead}>This box says</span>
              <button type="button" onClick={() => pick(choices.boxSays as AddPartPick)} style={{ ...row, border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{choices.boxSays.partName}{choices.boxSays.manufacturer ? <span style={{ ...muted, marginLeft: '0.5rem', fontWeight: 400 }}>· {choices.boxSays.manufacturer}</span> : null}</span>
                <span style={{ ...muted, whiteSpace: 'nowrap' }}>Use these words</span>
              </button>
            </div>
          ) : null}
          {already.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.3rem' }} data-testid="add-part-already">
              <span style={listHead}>Already on this job</span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflow: 'auto' }}>
                {already.map((a) => (
                  <li key={a.key}>
                    <button type="button" onClick={() => pick({ partId: a.partId, partName: a.partName, manufacturer: a.manufacturer })} style={row}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{a.partName}{a.manufacturer ? <span style={{ ...muted, marginLeft: '0.5rem', fontWeight: 400 }}>· {a.manufacturer}</span> : null}</span>
                      <span style={{ ...muted, whiteSpace: 'nowrap' }}>{onHandNameWords(a)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {searching ? <p style={{ ...muted, margin: 0 }}>Searching…</p> : null}
          {already.length > 0 && results.length > 0 ? <span style={listHead}>In the parts book</span> : null}
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflow: 'auto' }}>
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => pick({ partId: p.id, partName: p.name, manufacturer: p.manufacturer })} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit', minHeight: TOUCH_MIN }}>
                    {p.name}{p.manufacturer ? <span style={{ ...muted, marginLeft: '0.5rem' }}>· {p.manufacturer}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          {/* The way back sits where the choice is made, under the picked name in the head (punch list #398, v2.8635): last of the step it fell under the fold on a phone with the number pad up, since the sheet follows the keyboard (v2.8583). The second Add press stays last in the scroller, and the first stands in the sheet's foot (finding 263). */}
          <button type="button" style={{ ...quiet, justifySelf: 'start' }} onClick={() => setPicked(null)}>Pick a different part</button>
          <Stepper n={n} max={ADD_PART_MAX} onChange={(v) => { setN(v); setTouched(true) }} autoSelect />
          {/* A real load is 27, 50 or 94 (v2.8284): the chips get there in a press or two. */}
          <div role="group" aria-label="Add to the number" style={{ display: 'grid', gridTemplateColumns: `repeat(${QUANTITY_CHIPS.length}, minmax(0, 1fr))`, gap: '0.4rem' }}>
            {QUANTITY_CHIPS.map((c) => <button key={c} type="button" style={{ ...btn, minHeight: 44, padding: 0 }} onClick={() => { setN(chipAdds(n, c, touched)); setTouched(true) }}>+{c}</button>)}
          </div>
          {onAddAnother ? <button type="button" style={{ ...btn, ...btnBlock }} onClick={() => { if (!onAddAnother(picked, n)) return; setNote(addPartDoneWords(n, picked.partName, container.label)); setPicked(null); setTerm(''); setN(1); setTouched(false) }} data-testid="add-part-another">{addAnotherLabel(n)}</button> : null}
        </>
      )}
    </Sheet>
  )
}
