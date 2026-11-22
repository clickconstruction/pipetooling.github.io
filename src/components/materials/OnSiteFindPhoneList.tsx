/**
 * *Find a part or a box on any job* on a phone (v2.8291): the hits as rows, one press each.
 *
 * It draws `findPhoneRow`'s rows and nothing else. A row reads down: what was found, the box it is in and where the
 * box stands, the job, and how the box's count stands. How many are on hand is a figure at the row's end, the number
 * over its words, as the page's tiles read. The whole row is the press, and where it leads is the caller's to say.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { FIND_PHONE_ON_HAND, type FindPhoneRow } from '../../lib/materials/onSiteFindPhone'

const card: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }
const rowBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '10px 12px', color: 'var(--text-strong)', textDecoration: 'none', boxSizing: 'border-box', minWidth: 0 }
const titleWords: CSSProperties = { display: 'block', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }
const quietWords: CSSProperties = { display: 'block', marginTop: 2, fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }

export type FindPhoneListRow = FindPhoneRow & { /** Where the row's press leads. */ href: string }

export default function OnSiteFindPhoneList({ rows }: { rows: ReadonlyArray<FindPhoneListRow> }) {
  return (
    <div style={card} data-testid="on-site-find-phone">
      {rows.map((r, i) => (
        <Link key={r.key} to={r.href} aria-label={r.openLabel} style={{ ...rowBox, ...(i === 0 ? {} : { borderTop: '1px solid var(--border)' }) }} data-find-phone-row={r.key}>
          <span style={{ flex: '1 1 auto', minWidth: 0 }}>
            <span style={titleWords}>
              {r.title}
              {r.maker ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {r.maker}</span> : null}
              {/* A box that matched by its own name is the title, so what it is and where it stands sit beside it: one line fewer on a list of boxes. */}
              {!r.boxLabel && r.boxWords ? <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}> · {r.boxWords}</span> : null}
            </span>
            {r.boxLabel ? (
              <span style={quietWords}>
                <strong style={{ color: 'var(--text-strong)' }}>{r.boxLabel}</strong>
                {r.boxWords ? ` · ${r.boxWords}` : null}
              </span>
            ) : null}
            <span style={quietWords}>{r.jobWords}</span>
            {r.countWords ? <span style={{ ...quietWords, ...(r.due ? { fontWeight: 600, color: 'var(--text-amber-700)' } : {}) }} data-find-phone-count data-due={r.due ? '' : undefined}>{r.countWords}</span> : null}
          </span>
          {r.onHand != null ? (
            <span style={{ flex: '0 0 auto', display: 'grid', justifyItems: 'center', gap: 1, minWidth: 48 }} data-find-phone-on-hand>
              <b style={{ fontSize: '1.05rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{r.onHand}</b>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{FIND_PHONE_ON_HAND}</span>
            </span>
          ) : null}
          <span aria-hidden style={{ flex: '0 0 auto', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)' }}>›</span>
        </Link>
      ))}
    </div>
  )
}
