/**
 * The History look's composer and chips (punch list #208 PR 2h; the owner's pick A of
 * `history-mockup.html`). The composer keeps an entry: what happened, about which piece, when (now,
 * or set back to the email's time), from what source; the page writes it (`historyWrites.ts`). The
 * chips narrow the stream by kind, and the amber chip by piece (*JP1098 only*, set from a Pieces
 * row). The words and rules come from `lib/developments/history.ts`.
 */
import { useEffect, useState } from 'react'
import { draftIsKeepable, HISTORY_BODY_MAX, HISTORY_CHIPS, HISTORY_SOURCES, localInputValue, type HistoryAbout, type HistoryChip, type HistoryDraft, type HistoryPiece, type HistorySource } from '../../lib/developments/history'
import { capStyle, SmallButton } from './developmentPageBits'

export type HistoryAboutOption = { key: string; label: string; about: HistoryAbout; group: 'site' | 'jobs' | 'bids' | 'customer' }

const GROUP_LABEL: Record<HistoryAboutOption['group'], string> = { site: 'The site', jobs: 'Jobs', bids: 'Bids', customer: 'The customer' }

export function DevelopmentHistoryComposer({ options, phone, busy, onKeep }: { options: HistoryAboutOption[]; phone: boolean; busy: boolean; onKeep: (draft: HistoryDraft) => Promise<boolean> }) {
  const [body, setBody] = useState('')
  const [aboutKey, setAboutKey] = useState(options[0]?.key ?? 'site')
  const [when, setWhen] = useState(() => localInputValue(Date.now()))
  const [source, setSource] = useState<HistorySource>('note')
  const [kept, setKept] = useState(false)
  useEffect(() => {
    if (!kept) return
    const t = window.setTimeout(() => setKept(false), 3000)
    return () => window.clearTimeout(t)
  }, [kept])
  const option = options.find((o) => o.key === aboutKey) ?? options[0]
  const keepable = !!option && draftIsKeepable({ body, happenedAt: when }, Date.now())
  const keep = async () => {
    if (!option || !keepable || busy) return
    const ok = await onKeep({ about: option.about, happenedAt: when, source, body })
    if (!ok) return
    setBody('')
    setWhen(localInputValue(Date.now()))
    setKept(true)
  }
  const groups = (['site', 'jobs', 'bids', 'customer'] as const).map((g) => ({ g, items: options.filter((o) => o.group === g) })).filter((x) => x.items.length > 0)
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
        <select value={aboutKey} onChange={(e) => setAboutKey(e.target.value)} aria-label="About which piece" data-testid="history-about">
          {groups.map(({ g, items }) => (
            <optgroup key={g} label={GROUP_LABEL[g]}>
              {items.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
      <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-faint)' }}>Kept lines never change. To correct one, keep a second line that says so.</div>
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
