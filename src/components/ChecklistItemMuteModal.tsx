import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FOREVER_DATE = '9999-12-31T23:59:59.999Z'

type MuteOption = '1_week' | '1_month' | 'forever' | 'unmute'

type Props = {
  open: boolean
  checklistItemId: string | null
  taskTitle: string
  authUserId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function ChecklistItemMuteModal({
  open,
  checklistItemId,
  taskTitle,
  authUserId,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MuteOption | null>(null)

  useEffect(() => {
    if (!open || !authUserId || !checklistItemId) return
    setLoading(true)
    setError(null)
    supabase
      .from('user_checklist_item_mute_preferences')
      .select('muted_until')
      .eq('user_id', authUserId)
      .eq('checklist_item_id', checklistItemId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        setLoading(false)
        if (err) {
          setError(err.message)
          return
        }
        if (data) {
          const until = data.muted_until
          const untilDate = new Date(until)
          const now = new Date()
          if (untilDate > new Date('9999-01-01')) {
            setSelected('forever')
          } else if (untilDate > now) {
            const diffDays = Math.round((untilDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            if (diffDays <= 10) setSelected('1_week')
            else if (diffDays <= 35) setSelected('1_month')
            else setSelected('forever')
          } else {
            setSelected('unmute')
          }
        } else {
          setSelected('unmute')
        }
      })
  }, [open, authUserId, checklistItemId])

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !checklistItemId || selected === null) return
    setSaving(true)
    setError(null)
    try {
      if (selected === 'unmute') {
        const { error: err } = await supabase
          .from('user_checklist_item_mute_preferences')
          .delete()
          .eq('user_id', authUserId)
          .eq('checklist_item_id', checklistItemId)
        if (err) throw err
      } else {
        const now = new Date()
        let mutedUntil: string
        if (selected === '1_week') {
          const d = new Date(now)
          d.setDate(d.getDate() + 7)
          mutedUntil = d.toISOString()
        } else if (selected === '1_month') {
          const d = new Date(now)
          d.setMonth(d.getMonth() + 1)
          mutedUntil = d.toISOString()
        } else {
          mutedUntil = FOREVER_DATE
        }
        const { error: err } = await supabase
          .from('user_checklist_item_mute_preferences')
          .upsert(
            { user_id: authUserId, checklist_item_id: checklistItemId, muted_until: mutedUntil },
            { onConflict: 'user_id,checklist_item_id' }
          )
        if (err) throw err
      }
      onSaved()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 480,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Mute notifications for this task</h2>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {taskTitle && (
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Task: {taskTitle}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mute"
                  checked={selected === 'unmute'}
                  onChange={() => setSelected('unmute')}
                  style={{ margin: 0 }}
                />
                <span>Turn notifications back on</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mute"
                  checked={selected === '1_week'}
                  onChange={() => setSelected('1_week')}
                  style={{ margin: 0 }}
                />
                <span>Turn off notifications for 1 week</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mute"
                  checked={selected === '1_month'}
                  onChange={() => setSelected('1_month')}
                  style={{ margin: 0 }}
                />
                <span>Turn off notifications for 1 month</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mute"
                  checked={selected === 'forever'}
                  onChange={() => setSelected('forever')}
                  style={{ margin: 0 }}
                />
                <span>Turn off notifications forever</span>
              </label>
            </div>
          )}

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading || selected === null}
              style={{
                padding: '0.5rem 1rem',
                background: saving || loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: saving || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
