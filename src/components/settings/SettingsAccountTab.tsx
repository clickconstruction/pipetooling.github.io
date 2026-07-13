/** Settings → Your account tab body (the SettingsGroup children): profile (name/email/phone),
 * password change, push-notification test/enable, and location permission.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props.
 * The SettingsGroup wrapper + its titleTrailing (DB-backup) stay in the parent. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { isIOSDevice, isStandalonePwa } from '../../lib/iosPwa'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import PasswordInput from '../PasswordInput'

/** Structural shape of usePushNotifications() result (only the fields this tab reads). */
type PushNotificationsState = {
  supported: boolean
  vapidConfigured: boolean
  isSubscribed: boolean
  loading: boolean
  error: string | null
  enable: () => Promise<void> | void
  disable: () => Promise<void> | void
}

type SettingsAccountTabProps = {
  closePasswordChange: () => void
  confirmPassword: string
  currentPassword: string
  handleEnableLocation: () => void
  handlePasswordChange: (e: FormEvent) => void
  handleTestNotification: () => void
  locationLoading: boolean
  locationPermission: 'unknown' | 'prompt' | 'granted' | 'denied'
  myProfileEmail: string
  myProfileError: string | null
  myProfileName: string
  myProfilePhone: string
  myProfileSaving: boolean
  myRole: UserRole | null
  newPassword: string
  passwordChangeError: string | null
  passwordChangeOpen: boolean
  passwordChangeSubmitting: boolean
  passwordChangeSuccess: boolean
  pushNotifications: PushNotificationsState
  saveMyProfile: (e: FormEvent) => void
  setConfirmPassword: Dispatch<SetStateAction<string>>
  setCurrentPassword: Dispatch<SetStateAction<string>>
  setMyProfileEmail: Dispatch<SetStateAction<string>>
  setMyProfileName: Dispatch<SetStateAction<string>>
  setMyProfilePhone: Dispatch<SetStateAction<string>>
  setNewPassword: Dispatch<SetStateAction<string>>
  setPasswordChangeError: Dispatch<SetStateAction<string | null>>
  testNotificationError: string | null
  testNotificationSending: boolean
  testNotificationSuccess: string | null
}

export default function SettingsAccountTab({
  closePasswordChange,
  confirmPassword,
  currentPassword,
  handleEnableLocation,
  handlePasswordChange,
  handleTestNotification,
  locationLoading,
  locationPermission,
  myProfileEmail,
  myProfileError,
  myProfileName,
  myProfilePhone,
  myProfileSaving,
  myRole,
  newPassword,
  passwordChangeError,
  passwordChangeOpen,
  passwordChangeSubmitting,
  passwordChangeSuccess,
  pushNotifications,
  saveMyProfile,
  setConfirmPassword,
  setCurrentPassword,
  setMyProfileEmail,
  setMyProfileName,
  setMyProfilePhone,
  setNewPassword,
  setPasswordChangeError,
  testNotificationError,
  testNotificationSending,
  testNotificationSuccess,
}: SettingsAccountTabProps) {
  return (
    <>


      <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--bg-subtle)' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem', fontWeight: 600 }}>My Profile</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Update your name, email, and phone. Your phone is used in prospect copy templates.
        </p>
        <form onSubmit={saveMyProfile}>
          {myProfileError && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{myProfileError}</p>}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Name</label>
            <input
              type="text"
              value={myProfileName}
              onChange={(e) => setMyProfileName(e.target.value)}
              readOnly={isSubcontractorLikeRole(myRole)}
              disabled={isSubcontractorLikeRole(myRole)}
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                boxSizing: 'border-box',
                ...(isSubcontractorLikeRole(myRole) && { background: 'var(--bg-muted)', cursor: 'not-allowed' }),
              }}
            />
            {isSubcontractorLikeRole(myRole) && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Name is managed by admins. Contact a master or dev to change it.
              </p>
            )}
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Email</label>
            <input
              type="email"
              value={myProfileEmail}
              onChange={(e) => setMyProfileEmail(e.target.value)}
              required
              style={{ width: '100%', maxWidth: 320, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Phone</label>
            <input
              type="tel"
              value={myProfilePhone}
              onChange={(e) => setMyProfilePhone(e.target.value)}
              placeholder="e.g. (555) 123-4567"
              style={{ width: '100%', maxWidth: 320, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={myProfileSaving}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: myProfileSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            {myProfileSaving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {isIOSDevice() && (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Quick-Add Task icon</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Add a one-tap <strong>Add Task</strong> icon to your iPhone or iPad Home Screen that
            jumps straight to creating a checklist item.{' '}
            {isStandalonePwa() ? (
              <>
                Adding it must be done in Safari, so{' '}
                <button
                  type="button"
                  onClick={() => openInExternalBrowser(`${window.location.origin}/task-install.html`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'var(--text-link)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  open setup in Safari
                </button>{' '}
                and follow the steps to Add to Home Screen.
              </>
            ) : (
              <>
                Open{' '}
                <a href="/task-install.html" style={{ color: 'var(--text-link)', fontWeight: 500 }}>
                  Install Quick-Add Task icon
                </a>{' '}
                and follow the steps in Safari.
              </>
            )}
          </p>
        </div>
      )}

      <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Push Notifications</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Get browser notifications when a workflow stage is completed and it&apos;s your turn to pick up the task.
        </p>
        {!pushNotifications.supported && (
          <p style={{ color: 'var(--text-amber-800)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            Push notifications require HTTPS (or localhost) and a supporting browser. Try the deployed app or use Chrome/Firefox on localhost.
          </p>
        )}
        {pushNotifications.supported && pushNotifications.error && (
          <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{pushNotifications.error}</p>
        )}
        {pushNotifications.supported && !pushNotifications.vapidConfigured && (
          <p style={{ color: 'var(--text-amber-800)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY in your environment.
          </p>
        )}
        {pushNotifications.supported && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {pushNotifications.isSubscribed ? (
                <>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)' }}>Enabled</span>
        <button
          type="button"
                    onClick={() => pushNotifications.disable()}
                    disabled={pushNotifications.loading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    {pushNotifications.loading ? 'Disabling…' : 'Disable'}
        </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => pushNotifications.enable()}
                  disabled={pushNotifications.loading || !pushNotifications.vapidConfigured}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {pushNotifications.loading ? 'Enabling…' : 'Enable push notifications'}
                </button>
            )}
          </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
                onClick={handleTestNotification}
                disabled={!pushNotifications.isSubscribed || testNotificationSending || !pushNotifications.vapidConfigured}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', background: 'var(--surface)' }}
              >
                {testNotificationSending ? 'Sending…' : 'Test notification'}
          </button>
              {!pushNotifications.isSubscribed && pushNotifications.vapidConfigured && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Enable push notifications first to test</span>
              )}
            </div>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Allow location for location-based reminders
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {locationPermission === 'granted' ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)' }}>Location based reminders enabled</span>
              ) : locationPermission === 'denied' ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Location based reminders disabled — enable in browser settings to allow location based reminders
                </span>
              ) : (
                          <button
                            type="button"
                  onClick={handleEnableLocation}
                  disabled={locationLoading}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', background: 'var(--surface)' }}
                          >
                  {locationLoading ? 'Requesting…' : 'Enable Location based Reminders'}
                          </button>
              )}
                        </div>
            {testNotificationSuccess && (
              <p style={{ color: 'var(--text-green-600)', margin: 0, fontSize: '0.875rem' }}>{testNotificationSuccess}</p>
            )}
            {testNotificationError && (
              <p style={{ color: 'var(--text-red-700)', margin: 0, fontSize: '0.875rem' }}>{testNotificationError}</p>
              )}
            </div>
          )}
        </div>

      {/* Inline Change Password form - toggled from header button */}
      {passwordChangeOpen && (
        <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem', padding: '1rem 0' }}>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="current-password"
                label="Current password *"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="current-password"
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="new-password"
                label="New password *"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="confirm-password"
                label="Confirm new password *"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            {passwordChangeError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{passwordChangeError}</p>}
            {passwordChangeSuccess && <p style={{ color: 'var(--text-green-600)', marginBottom: '1rem' }}>Password changed successfully!</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                {passwordChangeSubmitting ? 'Changing…' : 'Change password'}
              </button>
              <button type="button" onClick={closePasswordChange} disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

    </>
  )
}
