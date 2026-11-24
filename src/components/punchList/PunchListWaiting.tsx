import { useState, type CSSProperties } from 'react'
import type { PickPatch } from '../../hooks/usePunchListPicks'
import type { UserRole } from '../../hooks/useAuth'
import { emptyWords } from '../../lib/emptyWords'
import { ASK_KIND_LABEL, type AskWho } from '../../lib/todos/punchListAsk'
import { GROUP_COLOR, fileHref, mockupHref, type PickMap } from '../../lib/todos/punchListView'
import {
  answeredLine,
  defaultWho,
  isWhoPill,
  mineFor,
  otherPills,
  picturesLine,
  waitingCounts,
  waitingHeadline,
  waitingRows,
  whoInSentence,
  type AskedCard,
  type WhoPill,
} from '../../lib/todos/punchListWaiting'
import type { BoardItem, CardLead } from '../../lib/todos/todoBoard'
import { EmptyState } from '../EmptyState'
import { PunchListAnswer } from './PunchListAnswer'

/** What the device remembers the pill under. */
export const WAITING_WHO_KEY = 'pt-punch-waiting-who'

/**
 * The Punch list's **Waiting on me** view (punch list #438, the mock-up's D): the cards that carry a
 * question, the question first, a lead picture, and one control to answer. It opens on the reader's
 * own questions; the pills show one person's, or everyone's. An answered card folds into one line at
 * the foot, where the answer can be changed or taken back. `visible` is the page's search.
 */
export function PunchListWaiting({
  items,
  visible,
  picks,
  onSave,
  role,
  firstName,
}: {
  items: readonly BoardItem[]
  visible: (it: BoardItem) => boolean
  picks: PickMap
  onSave: (slug: string, patch: PickPatch) => void | Promise<void>
  role: UserRole | null | undefined
  firstName: string
}) {
  const mine = mineFor(role)
  const counts = waitingCounts(items, picks, mine)
  const [chosen, setChosen] = useState<WhoPill | null>(() => readWho())
  // The pill the reader pressed, while it still names someone; else their own questions, else everyone's.
  const who: WhoPill = chosen && (chosen !== 'mine' || mine.length > 0) ? chosen : defaultWho(counts)
  const choose = (next: WhoPill): void => {
    setChosen(next)
    writeWho(next)
  }
  const [open, setOpen] = useState(false)
  const rows = waitingRows(items.filter(visible), picks, who, mine)
  const pills: Array<{ who: WhoPill; label: string; count: number }> = [
    ...(mine.length > 0 ? [{ who: 'mine' as WhoPill, label: 'Me', count: counts.mine }] : []),
    ...otherPills(counts, mine),
  ]
  return (
    <section data-testid="punch-waiting" style={{ marginTop: '1.25rem' }}>
      <style>{`
        .punch-wait-row { display: grid; grid-template-columns: 6px 3.75rem minmax(0, 1fr) auto minmax(220px, 250px); }
        .punch-wait-num { border-right: 1px solid var(--border); padding: 0.9rem 0.5rem 0.9rem 0.7rem; }
        .punch-wait-act { border-left: 1px solid var(--border); }
        .punch-wait-num-inline { display: none; }
        @media (max-width: 860px) {
          .punch-wait-row { grid-template-columns: 6px minmax(0, 1fr); }
          .punch-wait-stripe { grid-row: 1 / span 3; }
          .punch-wait-num { display: none; }
          .punch-wait-num-inline { display: inline; }
          .punch-wait-act { border-left: 0; border-top: 1px solid var(--border); }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span data-testid="punch-waiting-headline" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-strong)', marginRight: '0.25rem' }}>
          {waitingHeadline(who, rows.waiting.length, firstName)}
        </span>
        {pills.map((p) => (
          <button key={p.who} type="button" onClick={() => choose(p.who)} aria-pressed={who === p.who} style={whoPillStyle(who === p.who)}>
            {p.label} <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>{p.count}</span>
          </button>
        ))}
      </div>

      {rows.waiting.length > 0 ? (
        <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
          {rows.waiting.map((it, i) => (
            <WaitingRow key={it.slug} item={it} picks={picks} onSave={onSave} first={i === 0} />
          ))}
        </div>
      ) : (
        <div data-testid="punch-waiting-empty" style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
          <EmptyState main={emptyWords({ kind: 'waiting', who: nobodyWords(who) }).main} />
        </div>
      )}

      {rows.answered.length > 0 ? (
        <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            data-testid="punch-waiting-answered"
            style={{
              fontFamily: 'inherit',
              fontSize: '0.88rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              minHeight: 44,
              padding: '0.5rem 0.85rem',
              border: 0,
              background: 'transparent',
              color: 'var(--text-base)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ color: 'var(--text-muted)' }}>
              {open ? '▾' : '▸'}
            </span>
            <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Answered</b>
            <span style={{ ...MONO, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rows.answered.length}</span>
            <span>{answeredLine(rows.answered, picks)}</span>
          </button>
          {open ? rows.answered.map((it) => <WaitingRow key={it.slug} item={it} picks={picks} onSave={onSave} first={false} />) : null}
        </div>
      ) : null}
    </section>
  )
}

function WaitingRow({ item, picks, onSave, first }: { item: AskedCard; picks: PickMap; onSave: (slug: string, patch: PickPatch) => void | Promise<void>; first: boolean }) {
  const page = item.pictures?.page ?? null
  const line = picturesLine(item.pictures)
  return (
    <article data-number={item.number} data-testid={`punch-waiting-row-${item.number}`} className="punch-wait-row" style={{ borderTop: first ? 0 : '1px solid var(--border)' }}>
      <div className="punch-wait-stripe" style={{ background: GROUP_COLOR[item.group] }} />
      <div className="punch-wait-num">
        <span style={{ ...MONO, fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>#{item.number}</span>
      </div>
      <div style={{ padding: '0.9rem 1rem', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
          <span style={KIND_CHIP}>{ASK_KIND_LABEL[item.ask.kind]}</span>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>{item.ask.question}</p>
        </div>
        <a href={fileHref(item)} target="_blank" rel="noopener" style={{ fontSize: '0.85rem', color: 'var(--text-link)', alignSelf: 'flex-start' }}>
          <span className="punch-wait-num-inline" style={{ ...MONO, fontWeight: 700 }}>
            #{item.number}{' '}
          </span>
          {item.name}
        </a>
        {line && page ? (
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {line} ·{' '}
            <a href={mockupHref(page)} target="_blank" rel="noopener" style={{ color: 'var(--text-link)' }}>
              See all
            </a>
          </p>
        ) : null}
      </div>
      <div style={{ padding: item.pictures?.lead ? '0.75rem 0.75rem 0.75rem 1rem' : 0 }}>{item.pictures?.lead ? <Lead lead={item.pictures.lead} page={page} name={item.name} /> : null}</div>
      <div className="punch-wait-act" style={{ padding: '0.75rem 0.875rem' }}>
        <PunchListAnswer item={item} rec={picks[item.slug]} onSave={onSave} />
      </div>
    </article>
  )
}

/** The row's picture: the built screen, or the app today beside the card's mock-up. A press opens the pictures page. */
function Lead({ lead, page, name }: { lead: CardLead; page: string | null; name: string }) {
  const frames =
    lead.kind === 'built'
      ? [{ path: lead.path, label: 'Built', alt: `Built: ${name}`, mock: false }]
      : [
          { path: lead.today, label: 'Today', alt: `Today: ${name}`, mock: false },
          { path: lead.ifBuilt, label: 'If built · a mock-up', alt: `If built, the mock-up: ${name}`, mock: true },
        ]
  const pictures = (
    <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
      {frames.map((f, i) => (
        <span key={f.path} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          {i > 0 ? (
            <span aria-hidden style={{ marginTop: 48, color: 'var(--text-muted)' }}>
              →
            </span>
          ) : null}
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <img
              src={mockupHref(f.path)}
              alt={f.alt}
              loading="lazy"
              style={{
                height: 118,
                width: 'auto',
                maxWidth: 206,
                objectFit: 'cover',
                objectPosition: 'top left',
                borderRadius: 5,
                border: f.mock ? '1px dashed var(--border-strong)' : '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.label}</span>
          </span>
        </span>
      ))}
    </span>
  )
  return page ? (
    <a href={mockupHref(page)} target="_blank" rel="noopener" aria-label={`See all the pictures of ${name}`} style={{ textDecoration: 'none', display: 'inline-block' }}>
      {pictures}
    </a>
  ) : (
    pictures
  )
}

/** "you", or who the pill names, for *Nothing waiting on …*. */
function nobodyWords(who: WhoPill): string {
  if (who === 'mine') return 'you'
  if (who === 'everyone') return 'anyone'
  return whoInSentence(who as AskWho)
}

function readWho(): WhoPill | null {
  try {
    const raw = localStorage.getItem(WAITING_WHO_KEY)
    return isWhoPill(raw) ? raw : null
  } catch {
    return null
  }
}

function writeWho(who: WhoPill): void {
  try {
    localStorage.setItem(WAITING_WHO_KEY, who)
  } catch {
    // storage unavailable: the pill still holds for this page load
  }
}

const MONO: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

/** The word in front of the question: what kind of thing is asked. */
const KIND_CHIP: CSSProperties = {
  ...MONO,
  flex: 'none',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '1px 6px',
  borderRadius: 3,
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-subtle)',
  color: 'var(--text-strong)',
}

/** A who pill: dark when it is the one chosen, as the page's View pills are. */
function whoPillStyle(active: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: active ? 600 : 500,
    padding: '0.3rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'var(--surface)',
    color: active ? 'var(--surface)' : 'var(--text-base)',
    cursor: 'pointer',
  }
}
