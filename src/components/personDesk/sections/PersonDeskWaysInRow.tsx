import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { googleAddressDiffers, googleWay, parseLoginWays, unlinkGoogleQuestion, type LoginWays } from '../../../lib/people/loginWays'
import { lensSignInLabel } from '../../../lib/people/usersTabLens'
import type { ConfirmDialogOptions } from '../../../contexts/ConfirmDialogContext'
import { BTN_QUIET, Chip, DeskRow, deskBtn } from '../personDeskShared'

/**
 * The person desk's Ways in row (v2.8671, punch list #447), a dev's alone: whether the login has a password set,
 * and whether Google is linked to it, with the address the Google account carries and when it was last used.
 * **Unlink Google** takes the link off after a question. The password, the person and their work stay.
 *
 * It reads `dev_login_ways` and writes through `dev_unlink_google`. Until that migration is pushed the read is
 * refused, and the row says so in the database's own words and offers nothing.
 */

type Read = { state: 'loading' } | { state: 'ready'; ways: LoginWays } | { state: 'failed'; reason: string }

export function PersonDeskWaysInRow({
  userId,
  rosterEmail,
  displayName,
  busy,
  run,
  confirm,
}: {
  userId: string
  rosterEmail: string | null
  displayName: string
  busy: string | null
  run: (key: string, write: () => Promise<unknown>, success: string) => Promise<boolean>
  confirm: (opts: ConfirmDialogOptions) => Promise<boolean>
}) {
  const [read, setRead] = useState<Read>({ state: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await supabase.rpc('dev_login_ways' as never, { p_user_id: userId } as never)
      if (!alive) return
      setRead(error ? { state: 'failed', reason: formatErrorMessage(error, 'The ways in could not be read.') } : { state: 'ready', ways: parseLoginWays(data) })
    })()
    return () => {
      alive = false
    }
  }, [userId, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  async function unlink() {
    if (!(await confirm(unlinkGoogleQuestion(displayName)))) return
    const ok = await run(
      'unlink-google',
      async () => {
        const { error } = await supabase.rpc('dev_unlink_google' as never, { p_user_id: userId } as never)
        if (error) throw new Error(formatErrorMessage(error, 'Google could not be unlinked.'))
      },
      `Google is off ${displayName}'s login.`,
    )
    if (ok) refresh()
  }

  if (read.state === 'loading') {
    return (
      <DeskRow label="Ways in">
        <span style={{ color: 'var(--text-muted)' }}>Reading their ways in…</span>
      </DeskRow>
    )
  }
  if (read.state === 'failed') {
    return (
      <DeskRow
        label="Ways in"
        actions={
          <button type="button" style={deskBtn(BTN_QUIET, busy != null)} disabled={busy != null} onClick={refresh}>
            Read again
          </button>
        }
      >
        <span role="status" style={{ color: 'var(--text-amber-800)' }}>
          Their ways in could not be read. {read.reason}
        </span>
      </DeskRow>
    )
  }

  const google = googleWay(read.ways)
  const differs = googleAddressDiffers(google, rosterEmail)
  const used = google?.lastSignInAt ? lensSignInLabel(google.lastSignInAt, Date.now()) : null
  return (
    <div data-testid="desk-ways-in" style={{ display: 'contents' }}>
      <DeskRow label="Ways in">
        <span>Password</span>
        {read.ways.hasPassword ? <Chip tone="green">set</Chip> : <Chip tone="amber" title="They sign in with an emailed link or Google until a password is set.">not set</Chip>}
      </DeskRow>
      <DeskRow
        label=""
        actions={
          google ? (
            <button type="button" style={deskBtn(BTN_QUIET, busy != null)} disabled={busy != null} title="Take the Google link off this login. Their password still works." onClick={() => void unlink()}>
              {busy === 'unlink-google' ? 'Unlinking…' : 'Unlink Google'}
            </button>
          ) : null
        }
      >
        <span>Google</span>
        {google ? <Chip tone="green">linked</Chip> : <span style={{ color: 'var(--text-muted)' }}>not linked</span>}
        {google?.email ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{google.email}</span> : null}
        {used ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>last used {used}</span> : null}
        {differs ? (
          <Chip tone="amber" title={`The Google account is on ${google?.email ?? 'another address'}, and the roster has ${rosterEmail ?? 'none'}.`}>
            address differs
          </Chip>
        ) : null}
      </DeskRow>
    </div>
  )
}
