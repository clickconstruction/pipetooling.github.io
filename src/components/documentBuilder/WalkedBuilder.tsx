/**
 * A walked builder, open in the Document builder tab (punch list #404, step 7): the Sub NDA. Two sides. On the right,
 * what a GC sees: the flow, where every piece of words is a field a dev presses and types over. On the left, the map
 * (a row a topic, a column a level), the pages changed since the published revision with the way back, and the press
 * that publishes the draft as the next revision. Under them, the builder's link (step 8): switched on, anyone who holds
 * it walks the published revision at `/d/<code>`, look only.
 *
 * A change is to the draft, saved a moment after the typing rests. Nobody outside sees a draft. No clause wording is
 * typed here: a clause stays grey bars, and its wording stays in the Contract Book. Every rule is
 * `lib/documentBuilder/paperEdit.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { BuilderChip, BuilderChipTone, DocumentBuilderEntry } from '../../lib/documentBuilder/builders'
import { DOCUMENT_BUILDER_WORDS as WORDS } from '../../lib/documentBuilder/builders'
import { readPaperDef } from '../../lib/documentBuilder/definition'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { walkedLinkCardWords } from '../../lib/documentBuilder/linkPage'
import { movedOnWords } from '../../lib/documentBuilder/movedOn'
import { changedPages, isPathChanged, mapRows, pageName, pageOpens, revertPage, walkedNote, walkedPublishPress, withPaperLine, withPaperWords, withoutPaperLine } from '../../lib/documentBuilder/paperEdit'
import { readPress } from '../../lib/documentBuilder/sheetScreen'
import * as defaultIo from '../../lib/documentBuilder/sheetsIo'
import type { BuilderRecord } from '../../lib/documentBuilder/standing'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { BUILDER_LINK_CARD_IO, BuilderLinkCard, type BuilderLinkCardIo } from './BuilderLinkCard'
import { DocumentBuilderFlow, type FlowEdit, type FlowOpen } from './DocumentBuilderFlow'
import { LevelBars } from './DocumentBuilderSlider'
import { levelTone } from './levelTone'
import { MovedOnPanel } from './MovedOnPanel'

/** The writes the builder makes. A smoke hands its own in. */
export type WalkedBuilderIo = Pick<typeof defaultIo, 'saveBuilderDraft' | 'publishBuilder' | 'markBuilderRead'>

type Props = {
  entry: DocumentBuilderEntry
  rec: BuilderRecord
  /** The draft, shaped like a paper. It may break a rule of the paper: the Publish press lists that. The tab draws what is wrong with a draft that has no such shape. */
  def: PaperDef
  onBack: () => void
  onRecord: (rec: BuilderRecord) => void
  /** What sits under the link on the left: the send, as a later step adds it. */
  share?: ReactNode
  io?: WalkedBuilderIo
  /** The link card's own reads and presses. A smoke hands its own in. */
  linkIo?: BuilderLinkCardIo
}

/** How long the typing rests before the draft is saved. */
const SAVE_AFTER_MS = 700

/** Where the draft stands on the bar. `failed` holds from a save that did not land until a later one does. */
type SaveState = 'saved' | 'saving' | 'failed'
const SAVE_WORDS: Record<SaveState, string> = { saved: 'Draft saved', saving: 'Saving the draft…', failed: 'Draft not saved' }

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const CAP: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'normal' }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const SMALL_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', borderRadius: 8, padding: '3px 10px', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, minHeight: 28, cursor: 'pointer' }
const SECOND_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, minHeight: 36, cursor: 'pointer' }
const INPUT: CSSProperties = { width: '100%', color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box' }
const LABEL: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)' }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }

function mainPress(dead: boolean): CSSProperties {
  return { border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 40, cursor: dead ? 'not-allowed' : 'pointer' }
}

function Chip({ chip }: { chip: BuilderChip }) {
  return <span style={{ ...CHIP, ...CHIP_TONES[chip.tone] }}>{chip.words}</span>
}

export function WalkedBuilder({ entry, rec, def, onBack, onRecord, share, io = defaultIo, linkIo = BUILDER_LINK_CARD_IO }: Props) {
  const [draft, setDraft] = useState<PaperDef>(def)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [marks, setMarks] = useState(true)
  const [open, setOpen] = useState<FlowOpen | undefined>(undefined)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [refusal, setRefusal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** The draft's number as this page last read it. Set from each write's answer, ahead of the next draw. */
  const draftNo = useRef(rec.draftNo)
  draftNo.current = Math.max(draftNo.current, rec.draftNo)
  /** The builder moved on somewhere else: the row as it now reads. Saves wait until the person chooses. */
  const [hold, setHoldState] = useState<BuilderRecord | null>(null)
  const holdRef = useRef(hold)
  const setHold = (next: BuilderRecord | null) => {
    holdRef.current = next
    setHoldState(next)
  }
  const [readOpen, setReadOpen] = useState(false)
  const [readName, setReadName] = useState('')

  /** The published revision as a paper. Null before the first publish. */
  const published = useMemo(() => {
    if (rec.revision < 1) return null
    const parsed = readPaperDef(rec.published)
    return parsed.ok ? parsed.def : null
  }, [rec.revision, rec.published])

  // ---- Saving: the draft is saved a moment after the typing rests, one save after another.
  const here = useRef(true)
  const timer = useRef<number | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  /** The last save did not land, and no save has been asked for since. Leaving the builder sends the draft again. */
  const unsaved = useRef(false)
  const save = useCallback(async () => {
    // Held: the builder moved on somewhere else, and the person has not chosen yet.
    if (holdRef.current) {
      unsaved.current = true
      if (here.current) setSaveState('failed')
      return
    }
    const res = await io.saveBuilderDraft(entry.id, draftRef.current, draftNo.current)
    unsaved.current = !res.ok
    // The saved row goes up to the tab even after the builder is left: the tab opens the builder from it next time.
    if (res.ok) {
      draftNo.current = res.value.draftNo
      onRecord(res.value)
    }
    if (!here.current) return
    if (!res.ok) {
      // A save refused because the builder moved on is held, and the panel says the rest.
      if (res.movedOn) setHold(res.movedOn)
      else setRefusal(res.error)
      setSaveState('failed')
    } else setSaveState(timer.current == null ? 'saved' : 'saving')
  }, [io, entry.id, onRecord])
  const send = useCallback(() => {
    unsaved.current = false
    chain.current = chain.current.then(save)
  }, [save])
  const flush = useCallback(async () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
      send()
    } else if (unsaved.current) send()
    await chain.current
  }, [send])
  useEffect(() => {
    here.current = true
    return () => {
      // Leaving the builder saves what was typed last.
      void flush()
      here.current = false
    }
  }, [flush])

  const change = (next: PaperDef) => {
    if (next === draftRef.current) return
    draftRef.current = next
    setDraft(next)
    setRefusal(null)
    setSaveState((was) => (was === 'failed' ? was : 'saving'))
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      send()
    }, SAVE_AFTER_MS)
  }

  const edit: FlowEdit = {
    mark: (path) => (isPathChanged(draft, published, path) ? 'own' : 'usual'),
    onWords: (path, words) => change(withPaperWords(draftRef.current, path, words)),
    onAddLine: (listPath) => change(withPaperLine(draftRef.current, listPath)),
    onRemoveLine: (listPath, index) => change(withoutPaperLine(draftRef.current, listPath, index)),
  }

  const said = <T,>(res: Landed<T>): res is { ok: true; value: T } => {
    if (!res.ok) setRefusal(res.error)
    return res.ok
  }
  const publish = async () => {
    if (busy || holdRef.current) return
    setBusy(true)
    setRefusal(null)
    await flush()
    if (holdRef.current) {
      setBusy(false)
      return
    }
    const res = await io.publishBuilder(entry.id, rec.revision, draftRef.current, draftNo.current)
    setBusy(false)
    if (!res.ok && res.movedOn) {
      setHold(res.movedOn)
      return
    }
    if (said(res)) {
      draftNo.current = res.value.draftNo
      onRecord(res.value)
    }
  }
  /** Load the newer one: the builder as it now reads replaces what was typed here. */
  const loadNewer = () => {
    const newer = holdRef.current
    if (!newer) return
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
    unsaved.current = false
    setHold(null)
    setRefusal(null)
    const parsed = readPaperDef(newer.draft)
    if (parsed.ok) {
      draftRef.current = parsed.def
      setDraft(parsed.def)
    }
    draftNo.current = newer.draftNo
    onRecord(newer)
    setSaveState('saved')
  }
  /** Save mine over it: what was typed here is saved over the newer draft, naming the number that draft is on. */
  const keepMine = () => {
    const newer = holdRef.current
    if (!newer) return
    setHold(null)
    setRefusal(null)
    draftNo.current = newer.draftNo
    onRecord(newer)
    setSaveState('saving')
    send()
  }
  const markRead = async () => {
    if (busy || !readName.trim()) return
    setBusy(true)
    setRefusal(null)
    const res = await io.markBuilderRead(entry.id, rec.revision, readName, todayYmdInAppTz())
    setBusy(false)
    if (!said(res)) return
    onRecord(res.value)
    setReadOpen(false)
    setReadName('')
  }

  const changed = changedPages(draft, published)
  const press = walkedPublishPress(draft, rec)
  const read = readPress(entry, rec)
  const rows = mapRows(draft, published)
  const show = (page: string) => setOpen({ ...pageOpens(page), at: Date.now() })

  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
        <button type="button" style={SMALL_PRESS} onClick={onBack}>
          {`‹ ${WORDS.back}`}
        </button>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{entry.name}</span>
        <Chip chip={rec.revision > 0 ? { tone: 'ok', words: `Published, revision ${rec.revision}` } : { tone: 'wait', words: 'Draft, not published' }} />
        {changed.length > 0 ? <Chip chip={{ tone: 'warn', words: 'Changes not published' }} /> : null}
        {read.read ? (
          <Chip chip={{ tone: 'ok', words: read.words }} />
        ) : read.canMark ? (
          <button type="button" aria-expanded={readOpen} onClick={() => setReadOpen((o) => !o)} style={{ ...CHIP, ...CHIP_TONES.warn, border: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 24 }}>
            {read.words}
          </button>
        ) : (
          <Chip chip={{ tone: 'warn', words: read.words }} />
        )}
        <span style={{ flex: '1 1 auto' }} />
        <span style={saveState === 'failed' ? { ...FINE, fontWeight: 600, color: 'var(--text-red-700)' } : FINE} aria-live="polite">
          {SAVE_WORDS[saveState]}
        </span>
        <button type="button" disabled={press.dead || busy || hold != null} style={mainPress(press.dead || busy || hold != null)} onClick={() => void publish()}>
          {press.label}
        </button>
      </div>
      <span style={MUTED}>{walkedNote(rec, changed.length)}</span>

      {readOpen && !read.read ? (
        <div style={{ ...CARD, background: 'var(--bg-amber-tint)', borderColor: 'var(--text-amber-700)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', alignItems: 'end' }}>
            <label style={{ ...LABEL, flex: '1 1 220px', maxWidth: 320 }}>
              <span>{read.formLabel}</span>
              <input type="text" value={readName} onChange={(e) => setReadName(e.target.value)} style={INPUT} />
            </label>
            <button type="button" disabled={busy || !readName.trim()} style={mainPress(busy || !readName.trim())} onClick={() => void markRead()}>
              {read.pressLabel}
            </button>
            <button type="button" style={SECOND_PRESS} onClick={() => setReadOpen(false)}>
              Cancel
            </button>
          </div>
          <p style={FINE}>Kept with the revision. A new revision is unread again until someone marks it.</p>
        </div>
      ) : null}

      {refusal ? (
        <p role="alert" style={REFUSAL}>
          {refusal}
        </p>
      ) : null}
      {hold ? <MovedOnPanel words={movedOnWords(entry.name, { revision: rec.revision }, hold)} busy={busy} onLoad={loadNewer} onKeep={keepMine} /> : null}
      {press.dead && press.why.length > 0 ? (
        <div style={CARD}>
          <h3 style={CARD_TITLE}>Before this can be published</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-base)' }}>
            {press.why.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={CARD}>
            <h3 style={CARD_TITLE}>The map: a row a topic, a column a level</h3>
            {/* The grid's columns, a head's words or bars and a cell's shape are `index.css`'s: they differ on a phone. */}
            <div role="table" aria-label="The map" className="documentBuilderMap" style={{ ['--map-levels' as string]: draft.levels.length, fontSize: '0.72rem' }}>
              <span />
              {draft.levels.map((l) => (
                <span key={l.id} className="documentBuilderMapHead" title={l.name} style={{ ...CAP, fontSize: '0.62rem', color: levelTone(draft, l.id) }}>
                  <span className="documentBuilderMapHeadWords">{l.shortName ?? l.name}</span>
                  <span className="documentBuilderMapHeadBars">
                    <LevelBars def={draft} stop={l.id} />
                  </span>
                </span>
              ))}
              {rows.map((row) => (
                <div key={row.key} role="row" style={{ display: 'contents' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)', alignSelf: 'center', minWidth: 0, overflowWrap: 'anywhere' }}>{row.label}</span>
                  {row.cells.map((cell) => (
                    <button
                      key={cell.level}
                      type="button"
                      className="documentBuilderMapCell"
                      data-changed={cell.changed ? '' : undefined}
                      aria-label={`${row.label}, ${cell.levelName}${cell.changed ? ', changed' : ''}`}
                      title={cell.says}
                      onClick={() => show(cell.page)}
                      style={{ ['--tone' as string]: levelTone(draft, cell.level), border: `1px solid ${cell.changed ? 'var(--text-amber-700)' : 'var(--border)'}`, background: cell.changed ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', color: 'var(--text-700)', minWidth: 0, textAlign: 'left', fontFamily: 'inherit', fontSize: '0.7rem', lineHeight: 1.25, cursor: 'pointer' }}
                    >
                      <span className="documentBuilderMapWords">{cell.says}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <p style={FINE}>Press a cell to open that page at that level. Nobody types in the map.</p>
          </div>

          <div style={CARD}>
            <h3 style={CARD_TITLE}>{rec.revision > 0 ? `Changed since revision ${rec.revision}` : 'Not published yet'}</h3>
            {rec.revision === 0 ? <p style={MUTED}>Every word here is a draft. Publish to make revision 1.</p> : null}
            {rec.revision > 0 && changed.length === 0 ? <p style={MUTED}>{`Nothing waiting on a publish. This is revision ${rec.revision}.`}</p> : null}
            {changed.map((page) => (
              <div key={page} data-changed-page={page} style={{ display: 'grid', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.84rem' }}>{pageName(draft, page)}</div>
                <div style={BTNS}>
                  <button type="button" aria-label={`Open ${pageName(draft, page)}`} style={SMALL_PRESS} onClick={() => show(page)}>
                    Open it
                  </button>
                  {published ? (
                    <button type="button" aria-label={`Put ${pageName(draft, page)} back to revision ${rec.revision}`} style={SMALL_PRESS} onClick={() => change(revertPage(draftRef.current, published, page))}>
                      {`Back to revision ${rec.revision}`}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {/* The builder's own link, with no sheet: it opens the published revision and never the draft on the right. */}
          <BuilderLinkCard builderKey={entry.id} sheetId={null} published={rec.revision > 0} io={linkIo} words={walkedLinkCardWords(rec.revision)} />
          {share}
        </div>

        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div style={{ ...BTNS, justifyContent: 'space-between' }}>
            <div style={CAP}>{marks ? 'What a GC sees. Press any words to change them.' : 'What a GC sees'}</div>
            <button type="button" role="switch" aria-checked={marks} onClick={() => setMarks((m) => !m)} style={{ ...SMALL_PRESS, color: 'var(--text-strong)' }}>
              {marks ? 'Marks are on' : 'Marks are off, as a GC sees it'}
            </button>
          </div>
          <DocumentBuilderFlow def={draft} edit={marks ? edit : undefined} open={open} style={{ height: 'min(780px, calc(100dvh - 96px))' }} />
          <p style={FINE}>Placeholder words. No attorney has read them. A clause is drawn as grey bars, and its wording is not typed here.</p>
        </div>
      </div>
    </div>
  )
}
