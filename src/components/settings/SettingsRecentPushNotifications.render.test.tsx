// @vitest-environment jsdom
/**
 * The record under Settings → Activity logs (v2.7068, held here since v2.7904). A mail-saved notice is a record only:
 * the Needs you line that drew it is gone (`dashboardNeedsYou.mailSaved.test.ts`), so this card is the one place the
 * mailbox's owner reads it. The card asks for the `app` rows beside the pushes, and an `app` row wears *In the app*
 * and shows no template name. Made-up people only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import SettingsRecentPushNotifications from './SettingsRecentPushNotifications'
import { renderSettled } from '../../test/renderSmokeMocks'
import { MAIL_SAVED_WORDS } from '../../lib/myMail/savedForYou'

const read = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as Array<{ method: string; args: unknown[] }> }))

vi.mock('../../lib/supabase', () => {
  /** A chainable, thenable read that notes every call and answers with the rows the test set. */
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      read.calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve({ data: read.rows, error: null }).then(resolve, reject)
  return {
    supabase: {
      from: (table: string) => {
        read.calls.push({ method: 'from', args: [table] })
        return builder
      },
    },
  }
})

const TITLE = 'Nadia Reyes saved a conversation from your mail to JP1077 4 Elm Ct.'
const BODY = 'They did it for you, through the dev seat. The mail is on the job in Messages, where the office reads it. Nothing changed in your Gmail.'
const row = (over: Record<string, unknown>) => ({ id: 'n-1', sent_at: '2026-11-18T21:05:00.000Z', title: TITLE, body_preview: BODY, template_type: 'mail_saved_for_you', channel: 'app', project_id: null, step_id: null, checklist_instance_id: null, ...over })

describe('SettingsRecentPushNotifications: the record of a mail-saved notice', () => {
  beforeEach(() => {
    read.rows = []
    read.calls = []
  })

  it('reads the person’s own app rows beside the pushes', async () => {
    read.rows = [row({})]
    await renderSettled(<SettingsRecentPushNotifications userId="u-marisol" />, { loaded: () => screen.findByText(TITLE) })
    expect(read.calls.find((c) => c.method === 'from')?.args).toEqual(['notification_history'])
    expect(read.calls.find((c) => c.method === 'eq')?.args).toEqual(['recipient_user_id', 'u-marisol'])
    expect(read.calls.find((c) => c.method === 'in')?.args).toEqual(['channel', ['push', 'both', 'app']])
  })

  it('lists an app row in its own words under the badge In the app, with no template name', async () => {
    read.rows = [row({}), row({ id: 'n-2', title: 'A step is ready for you.', body_preview: null, template_type: 'stage_ready', channel: 'push' })]
    await renderSettled(<SettingsRecentPushNotifications userId="u-marisol" />, { loaded: () => screen.findByText(TITLE) })
    expect(screen.getByText('Most recent notifications')).toBeTruthy()
    expect(MAIL_SAVED_WORDS.badge).toBe('In the app')
    const saved = screen.getByText(TITLE).closest('li')!
    expect(saved.textContent).toContain('In the app')
    expect(saved.textContent).toContain(BODY)
    expect(saved.textContent).not.toContain('mail_saved_for_you')
    // A push beside it keeps its own badge and its template name.
    const push = screen.getByText('A step is ready for you.').closest('li')!
    expect(push.textContent).toContain('Push')
    expect(push.textContent).not.toContain('In the app')
    expect(push.textContent).toContain('stage_ready')
    // The card carries the id a link to the record names.
    expect(document.getElementById('settings-recent-push')).toBeTruthy()
  })
})
