import { supabase } from '../../../lib/supabase'
import { useSiteRosters } from '../../../hooks/useSiteAccounts'
import { createCountToolingSeat } from '../../../lib/people/accountWrites'
import { makeTakeoffToolingSeat, sendSiteVerb } from '../../../lib/people/siteAccountsIo'
import {
  SITES,
  SITE_ROLE_OPTIONS,
  isFleetAddress,
  siteFlagTitle,
  siteRoleChange,
  siteRoleDoneWords,
  siteRoleIsOn,
  siteSeatActiveBody,
  siteSeatFor,
  siteSeatPress,
  siteSeatWords,
  unreadSiteWords,
  type SiteAccount,
  type SiteKey,
  type SiteRoleOption,
} from '../../../lib/people/siteAccounts'
import { lensSignInLabel } from '../../../lib/people/usersTabLens'
import type { ConfirmDialogOptions } from '../../../contexts/ConfirmDialogContext'
import { BTN, BTN_QUIET, Chip, DeskRow, deskBtn } from '../personDeskShared'

/**
 * The person desk's Sites rows (v2.8667), a dev's alone: the person's seat on CountTooling and on TakeoffTooling,
 * with the one seat press each offers (make it, retire it, bring it back) and a *Role there* line that sets the
 * role the seat holds on that site. PipeTooling's own role is the Role row above and decides nothing here: a
 * dev sets each site's role by hand.
 *
 * Every press goes over the site's dev-only bridge (`ct-bridge`, `tt-bridge`). A site that cannot be read says
 * why on its own row and never blanks the other.
 */

const HINT: React.CSSProperties = { flexBasis: '100%', fontSize: '0.71875rem', color: 'var(--text-muted)' }
const ROLE_ON: React.CSSProperties = { ...BTN, border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }
const LOUD_FLAGS = new Set(['address differs', 'link gone'])
const ROLE_KEYS = new Set(['overseer', 'lead', 'admin', 'dev'])

export type SitesRowsUser = { id: string; email: string | null; name: string | null; counttooling_user_id: string | null }

export function PersonDeskSitesRows({
  user,
  displayName,
  busy,
  run,
  confirm,
}: {
  user: SitesRowsUser
  displayName: string
  busy: string | null
  /** The section's own press runner: it marks the press busy, toasts the outcome and reloads the person. */
  run: (key: string, write: () => Promise<unknown>, success: string) => Promise<boolean>
  confirm: (opts: ConfirmDialogOptions) => Promise<boolean>
}) {
  const { reads, refresh } = useSiteRosters(true)
  const fleet = isFleetAddress(user.email)

  async function press(key: string, write: () => Promise<unknown>, success: string) {
    if (await run(key, write, success)) refresh()
  }

  async function seatPress(site: { key: SiteKey; name: string }, account: SiteAccount | null) {
    if (!account) {
      if (!user.email) return
      const email = user.email
      await press(
        `site-${site.key}`,
        () => (site.key === 'count' ? createCountToolingSeat(supabase, { userId: user.id, email, name: user.name }) : makeTakeoffToolingSeat(supabase, { email, name: user.name })),
        `${site.name} seat ready for ${displayName}.`,
      )
      return
    }
    if (account.active) {
      const ok = await confirm({
        message: `Retire ${displayName}'s seat on ${site.name}? They can no longer sign in there. Their work on ${site.name} stays, and the seat can be brought back.`,
        confirmLabel: 'Retire the seat',
      })
      if (!ok) return
    }
    await press(
      `site-${site.key}`,
      () => sendSiteVerb(supabase, site.key, siteSeatActiveBody(site.key, account.id, !account.active)),
      account.active ? `${displayName}'s seat on ${site.name} is retired.` : `${displayName}'s seat on ${site.name} is back.`,
    )
  }

  async function rolePress(site: { key: SiteKey; name: string }, account: SiteAccount, option: SiteRoleOption) {
    const change = siteRoleChange(site.key, account, option.key)
    if (!change) return
    if (change.turnsOn && option.confirm) {
      const ok = await confirm({ message: `Make ${displayName} ${/^[aeiou]/i.test(option.label) ? 'an' : 'a'} ${option.label.toLowerCase()} on ${site.name}? ${option.says}`, confirmLabel: `Make ${option.label.toLowerCase()}` })
      if (!ok) return
    }
    await press(`site-role-${site.key}-${option.key}`, () => sendSiteVerb(supabase, site.key, change.body), siteRoleDoneWords(site.name, option, change.turnsOn, displayName))
  }

  return (
    <>
      {SITES.map((site) => {
        const read = reads[site.key]
        if (read.state === 'loading') {
          return (
            <DeskRow key={site.key} label={site.name}>
              <span style={{ color: 'var(--text-muted)' }}>Reading {site.name}…</span>
            </DeskRow>
          )
        }
        if (read.state === 'failed') {
          return (
            <DeskRow
              key={site.key}
              label={site.name}
              actions={
                <button type="button" style={deskBtn(BTN_QUIET, busy != null)} disabled={busy != null} onClick={refresh}>
                  Read again
                </button>
              }
            >
              <span role="status" style={{ color: 'var(--text-amber-800)' }}>
                {unreadSiteWords(site.name, read.reason)}
              </span>
            </DeskRow>
          )
        }
        const seat = siteSeatFor(site.key === 'count' ? { email: user.email, linkedId: user.counttooling_user_id } : { email: user.email }, read.accounts)
        const words = siteSeatWords(seat)
        const account = seat.kind === 'seat' ? seat.account : null
        const pressKind = siteSeatPress(seat)
        const pressLabel = pressKind === 'make' ? 'Make their seat' : pressKind === 'retire' ? 'Retire here' : 'Bring back'
        const seatBusy = busy === `site-${site.key}`
        const canPress = !fleet && busy == null && (account !== null || Boolean(user.email))
        const signIn = account?.lastSignInAt ? lensSignInLabel(account.lastSignInAt, Date.now()) : null
        const roles = SITE_ROLE_OPTIONS[site.key]
        return (
          <div key={site.key} style={{ display: 'contents' }} data-testid={`desk-site-${site.key}`}>
            <DeskRow
              label={site.name}
              actions={
                fleet ? null : (
                  <button
                    type="button"
                    style={deskBtn(pressKind === 'retire' ? BTN_QUIET : BTN, !canPress)}
                    disabled={!canPress}
                    title={pressKind === 'make' ? `Make (or find) their ${site.name} account.` : pressKind === 'retire' ? `They can no longer sign in to ${site.name}. Their work there stays.` : `Let them sign in to ${site.name} again.`}
                    onClick={() => void seatPress(site, account)}
                  >
                    {seatBusy ? 'Working…' : pressLabel}
                  </button>
                )
              }
            >
              {words.status === 'no seat' ? <span style={{ color: 'var(--text-muted)' }}>no seat</span> : <Chip tone={words.status === 'active' ? 'green' : 'amber'}>{words.status}</Chip>}
              {signIn ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>signed in {signIn}</span> : null}
              {words.flags
                .filter((f) => !ROLE_KEYS.has(f))
                .map((f) => (
                  <Chip key={f} tone={LOUD_FLAGS.has(f) ? 'amber' : 'gray'} title={siteFlagTitle(f, site.name, seat)}>
                    {f}
                  </Chip>
                ))}
              {fleet ? <span style={HINT}>A robot's or a sample's seat is made where the fleet is made, not here.</span> : null}
            </DeskRow>
            {account && !fleet ? (
              <DeskRow label="Role there">
                {roles.options.map((option) => {
                  const on = siteRoleIsOn(site.key, account, option.key)
                  const key = `site-role-${site.key}-${option.key}`
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${option.label} on ${site.name}`}
                      style={deskBtn(on ? ROLE_ON : BTN_QUIET, busy != null)}
                      disabled={busy != null}
                      title={option.says}
                      onClick={() => void rolePress(site, account, option)}
                    >
                      {busy === key ? 'Saving…' : option.label}
                    </button>
                  )
                })}
                <span style={HINT}>{roles.options.filter((o) => o.key !== 'user').map((o) => o.says).join(' ')}</span>
              </DeskRow>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
