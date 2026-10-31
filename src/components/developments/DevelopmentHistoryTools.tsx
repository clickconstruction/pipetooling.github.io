/**
 * The History look's composer and chips (punch list #208 PR 2h; the owner's pick A of
 * `history-mockup.html`). The composer keeps an entry: what happened, about which piece, when (now,
 * or set back to the email's time), from what source; the page writes it (`historyWrites.ts`). The
 * chips narrow the stream by kind, and the amber chip by piece (*JP1098 only*, set from a Pieces
 * row). The words and rules come from `lib/developments/history.ts`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { draftIsKeepable, HISTORY_BODY_MAX, HISTORY_CHIPS, HISTORY_SOURCES, localInputValue, type HistoryChip, type HistoryDraft, type HistoryPiece, type HistorySource } from '../../lib/developments/history'
import { aboutRowsOf, type AboutGroup, type AboutRow } from '../../lib/developments/aboutPicker'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { capStyle, LinkButton, SmallButton } from './developmentPageBits'

/** One row of the About picker: the number and name, then the stage or status in muted small type. */
function AboutRowContent({ row }: { row: AboutRow }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.group === 'site' ? `🏠 ${row.label}` : row.label}</span>
      {row.meta ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{row.meta}</span> : null}
    </span>
  )
}

export function DevelopmentHistoryComposer({ groups, preferKey, phone, busy, onKeep, onClose }: { groups: AboutGroup[]; preferKey: string | null; phone: boolean; busy: boolean; onKeep: (draft: HistoryDraft) => Promise<boolean>; onClose?: () => void }) {
  const [body, setBody] = useState('')
  const rows = useMemo(() => aboutRowsOf(groups), [groups])
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const [aboutKey, setAboutKey] = useState(rows[0]?.key ?? 'site')
  // The amber *JP1098 only* chip sets About to that piece (v2.6205); clearing it goes back to the site.
  useEffect(() => {
    if (preferKey === null) setAboutKey('site')
    else if (rowsRef.current.some((r) => r.key === preferKey)) setAboutKey(preferKey)
  }, [preferKey])
  const [when, setWhen] = useState(() => localInputValue(Date.now()))
  const [source, setSource] = useState<HistorySource>('note')
  const [kept, setKept] = useState(false)
  useEffect(() => {
    if (!kept) return
    const t = window.setTimeout(() => setKept(false), 3000)
    return () => window.clearTimeout(t)
  }, [kept])
  const option = rows.find((r) => r.key === aboutKey) ?? rows[0]
  const keepable = !!option && draftIsKeepable({ body, happenedAt: when }, Date.now())
  const keep = async () => {
    if (!option || !keepable || busy) return
    const ok = await onKeep({ about: option.about, happenedAt: when, source, body })
    if (!ok) return
    setBody('')
    setWhen(localInputValue(Date.now()))
    setKept(true)
  }
  // The picker's rows: a labelled separator before each group but the site's; a piece written about last
  // appears twice, so its recent row carries its own value and the pick strips the prefix.
  const selectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      groups.flatMap((g) => [
        ...(g.group === 'site' ? [] : [{ kind: 'separator' as const, id: `about-${g.group}`, label: g.label }]),
        ...g.rows.map((r) => ({ value: g.group === 'recent' ? `recent:${r.key}` : r.key, label: r.search, labelContent: <AboutRowContent row={r} /> })),
      ]),
    [groups],
  )
  return (
    <div className="developmentHistoryBox" data-testid="history-composer" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '8px 10px', marginBottom: 10 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, HISTORY_BODY_MAX))}
        rows={2}
        placeholder="What happened? An email, a call, a visit, a letter, a decision."
        aria-label="What happened"
        data-testid="history-body"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            keep()
          }
        }}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: '0.8rem' }}>
        <span style={capStyle}>About</span>
        <span data-testid="history-about" style={{ display: 'inline-block', minWidth: phone ? '100%' : 260, maxWidth: '100%' }}>
          <SearchableSelect
            value={aboutKey}
            onChange={(v) => setAboutKey(v.replace(/^recent:/, ''))}
            options={selectOptions}
            listAriaLabel="About which piece"
            searchPlaceholder="Type a number or a name"
            listMaxHeightPx={320}
            fillViewportHeight
            listMinWidthPx={300}
            listOptionPadding="0.35rem 0.6rem"
            listOptionFontSize="0.8rem"
            triggerMinHeightPx={30}
            triggerStyle={{ fontSize: '0.8rem', padding: '0 0.5rem' }}
          />
        </span>
        <span style={capStyle}>When</span>
        <input type="datetime-local" value={when} max={localInputValue(Date.now() + 5 * 60_000)} onChange={(e) => setWhen(e.target.value)} aria-label="When it happened" title="When it happened: now, or set back to the email's time" data-testid="history-when" />
        <span style={capStyle}>Source</span>
        {/* A phone lays the six sources three a row, two rows, so the last never wraps alone. */}
        <span style={phone ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, width: '100%' } : { display: 'inline-flex', gap: 4, flexWrap: 'wrap' }} role="radiogroup" aria-label="Source">
          {HISTORY_SOURCES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={source === s.key} className="developmentHistoryChip" data-on={source === s.key ? '1' : undefined} style={phone ? { justifyContent: 'center' } : undefined} title={s.hint} onClick={() => setSource(s.key)} data-testid={`history-source-${s.key}`}>
              {s.label}
            </button>
          ))}
        </span>
        <span style={{ marginLeft: phone ? 0 : 'auto', width: phone ? '100%' : undefined, display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: phone ? 'stretch' : undefined }}>
          {kept ? <span style={{ fontSize: '0.76rem', color: 'var(--text-green-700)', fontWeight: 600 }} data-testid="history-kept">Kept · it reads at the top</span> : null}
          <SmallButton onClick={() => void keep()} primary disabled={!keepable || busy} title={keepable ? 'Keep this line; kept lines never change' : 'Say what happened, at a time that has come'}>
            {busy ? 'Keeping…' : 'Keep it'}
          </SmallButton>
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-faint)', display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0 }}>Kept lines never change. To correct one, keep a second line that says so.</span>
        {onClose ? (
          <LinkButton onClick={onClose} title="Fold the box; the lines stay" nowrap>
            Close
          </LinkButton>
        ) : null}
      </div>
    </div>
  )
}


export function DevelopmentHistoryChips({ chip, onChip, piece, onClearPiece, phone = false }: { chip: HistoryChip; onChip: (chip: HistoryChip) => void; piece: HistoryPiece | null; onClearPiece: () => void; phone?: boolean }) {
  const chips = HISTORY_CHIPS.map((c) => (
    <button key={c.key} type="button" className="developmentHistoryChip" data-on={chip === c.key ? '1' : undefined} aria-pressed={chip === c.key} title={c.title} style={phone ? { flexShrink: 0 } : undefined} onClick={() => onChip(c.key)} data-testid={`history-chip-${c.key}`}>
      {c.label}
    </button>
  ))
  const pieceChip = piece ? (
    <button type="button" className="developmentChipPress isOn" onClick={onClearPiece} title="Every piece again" data-testid="history-piece-chip">
      {piece.label} only <span aria-hidden>×</span>
    </button>
  ) : null
  if (phone) {
    // A phone keeps the seven chips in one row that scrolls sideways, as the Pipeline's stage strip does,
    // so none wraps onto a line of its own; the piece chip sits under the strip where it is always in view.
    return (
      <div style={{ marginBottom: 8 }} data-testid="history-chips" data-phone="1">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }} data-testid="history-chips-strip">
          <span style={{ ...capStyle, flexShrink: 0 }}>Show</span>
          {chips}
        </div>
        {pieceChip ? <div style={{ marginTop: 4 }}>{pieceChip}</div> : null}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }} data-testid="history-chips">
      <span style={capStyle}>Show</span>
      {chips}
      {pieceChip}
    </div>
  )
}
