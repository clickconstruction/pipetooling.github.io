import { SITES, countUnmatchedSiteAccounts, siteFlagTitle, siteSeatFor, siteSeatWords, unmatchedSiteWords, unreadSiteWords, type SiteKey, type SitePerson, type SiteRead } from '../../lib/people/siteAccounts'
import { lensSignInLabel } from '../../lib/people/usersTabLens'
import type { SiteAccountsState } from '../../hooks/useSiteAccounts'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * The Users tab's Sites lens (v2.8657), dev only: each person's seat on CountTooling and on TakeoffTooling, read
 * beside their row. It reads and shows. Making, retiring or changing a seat stays on the person's desk.
 */

export const SITE_CELL_WIDTH = 232

const HEAD: React.CSSProperties = { textAlign: 'left', fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }
const CELL: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', flexShrink: 0, minHeight: 24, width: SITE_CELL_WIDTH, flexWrap: 'wrap' }
const FLAG: React.CSSProperties = { fontSize: '0.6875rem', lineHeight: 1.3, padding: '0 0.35rem', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }

const STATUS_COLOR: Record<'no seat' | 'active' | 'retired', string> = { 'no seat': 'var(--text-muted)', active: 'var(--text-green-800)', retired: 'var(--text-amber-800)' }
const LOUD_FLAGS = new Set(['address differs', 'link gone'])

/** The column header for the lens: one column a site. */
export function UsersSitesLensHeader() {
  return (
    <div aria-hidden style={{ display: 'flex', gap: 6, marginLeft: 'auto', paddingRight: 34 }}>
      {SITES.map((s) => (
        <span key={s.key} style={{ ...HEAD, width: SITE_CELL_WIDTH }}>
          {s.name}
        </span>
      ))}
    </div>
  )
}

/** One row's two cells. A site still being read shows a quiet mark, and a site that failed stays quiet here: the line above the list says why. */
export function UsersTabSiteCells({ person, name, reads }: { person: SitePerson; name: string; reads: Record<SiteKey, SiteRead> }) {
  return (
    <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
      {SITES.map((s) => {
        const read = reads[s.key]
        if (read.state !== 'ready') {
          return (
            <span key={s.key} style={{ ...CELL, color: 'var(--text-muted)' }} title={read.state === 'loading' ? `Reading ${s.name}` : `${s.name} could not be read`} aria-label={`${name} on ${s.name}: ${read.state === 'loading' ? 'reading' : 'not read'}`}>
              {read.state === 'loading' ? '…' : '—'}
            </span>
          )
        }
        const seat = siteSeatFor(s.key === 'count' ? person : { email: person.email }, read.accounts)
        const words = siteSeatWords(seat)
        const signIn = seat.kind === 'seat' && seat.account.lastSignInAt ? lensSignInLabel(seat.account.lastSignInAt, Date.now()) : null
        return (
          <span key={s.key} style={CELL} aria-label={`${name} on ${s.name}: ${[words.status, ...words.flags].join(', ')}`}>
            <span style={{ color: STATUS_COLOR[words.status], fontWeight: words.status === 'no seat' ? 400 : 600 }}>{words.status}</span>
            {signIn ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} title={`Last signed in to ${s.name} ${new Date(seat.kind === 'seat' && seat.account.lastSignInAt ? seat.account.lastSignInAt : Date.now()).toLocaleString()}`}>
                {signIn}
              </span>
            ) : null}
            {words.flags.map((f) => (
              <span key={f} style={LOUD_FLAGS.has(f) ? { ...FLAG, color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' } : FLAG} title={siteFlagTitle(f, s.name, seat)}>
                {f}
              </span>
            ))}
          </span>
        )
      })}
    </span>
  )
}

/** Above the list: one line a site. What was read says how many of its accounts belong to nobody here. What was not read says why. */
export function UsersSitesLensSummary({ sites }: { sites: SiteAccountsState }) {
  const failed = SITES.some((s) => sites.reads[s.key].state === 'failed') || sites.people?.ok === false
  return (
    <div data-testid="users-sites-lens-summary" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 1.25rem', margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
      {sites.people?.ok === false ? (
        <span role="status" style={{ color: 'var(--text-amber-800)' }}>
          {unreadSiteWords('The people here', sites.people.reason)}
        </span>
      ) : null}
      {SITES.map((s) => {
        const read = sites.reads[s.key]
        if (read.state === 'failed') {
          return (
            <span key={s.key} role="status" style={{ color: 'var(--text-amber-800)' }}>
              {unreadSiteWords(s.name, read.reason)}
            </span>
          )
        }
        if (read.state === 'loading' || sites.people === null) return <span key={s.key}>Reading {s.name}…</span>
        if (!sites.people.ok) return null
        const people = s.key === 'count' ? sites.people.rows : sites.people.rows.map((p) => ({ email: p.email }))
        return (
          <span key={s.key}>
            <ValueSentence text={unmatchedSiteWords(s.name, countUnmatchedSiteAccounts(people, read.accounts))} />
          </span>
        )
      })}
      {failed ? (
        <button type="button" onClick={sites.refresh} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline', padding: 0 }}>
          Read again
        </button>
      ) : null}
    </div>
  )
}
