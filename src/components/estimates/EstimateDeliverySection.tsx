import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { groupEstimateNotifyOptions, type EstimateNotifyUserOption } from '../../lib/estimates/estimateNotifyOptions'
import { formatProjectNumberLabel } from '../../lib/projectNumberLabel'
import AutosizeTextarea from '../AutosizeTextarea'
import { SearchableMultiSelect } from '../SearchableMultiSelect'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { estInputBase } from './estimatesPageStyles'

export interface EstimateDeliverySectionProps {
  /** The step rail just jumped here: the section pulses. */
  flash: boolean
  /** The rail's numbered dot for this step. */
  stepDot: ReactNode
  user: { id: string; email?: string | null } | null | undefined
  profileName: string | null | undefined
  acceptNotifyUserIds: string[]
  setAcceptNotifyUserIds: Dispatch<SetStateAction<string[]>>
  /** Everyone who can be told. The page reads the list once and keeps it across its reloads. */
  notifyUserOptions: EstimateNotifyUserOption[]
  /** '' is not linked. */
  linkedProjectId: string
  setLinkedProjectId: (id: string) => void
  /** null until the page's one lazy read lands. */
  projectsForPicker: Array<{ id: string; name: string | null; project_number: string | null }> | null
  internalNotes: string
  setInternalNotes: (notes: string) => void
}

/**
 * Delivery on a draft estimate, the section the customer never sees: who is emailed when the customer
 * accepts, the project the estimate hangs off, and the office's own notes. Moved from `EstimateDetail`
 * (v2.7618, punch list #46 row 3, cut 4 of the Estimates map); the JSX is the page's own, and the two
 * memos behind Also notify came with it. Every value is the page's, handed in with its setter.
 */
export default function EstimateDeliverySection({
  flash,
  stepDot,
  user,
  profileName,
  acceptNotifyUserIds,
  setAcceptNotifyUserIds,
  notifyUserOptions,
  linkedProjectId,
  setLinkedProjectId,
  projectsForPicker,
  internalNotes,
  setInternalNotes,
}: EstimateDeliverySectionProps) {
  const acceptNotifyOtherSelectOptions = useMemo((): SearchableSelectOption[] => {
    return groupEstimateNotifyOptions(notifyUserOptions, user?.id).map((entry): SearchableSelectOption => {
      if (entry.kind === 'separator') return entry
      const name = entry.option.name?.trim() || '—'
      const email = entry.option.email?.trim() || ''
      return {
        value: entry.option.id,
        label: `${name} ${email}`.trim(),
        labelContent: (
          <>
            <span style={{ fontWeight: 500 }}>{name}</span>
            <span style={{ color: 'var(--text-muted)' }}> · {email || 'no email'}</span>
          </>
        ),
      }
    })
  }, [notifyUserOptions, user?.id])

  const acceptNotifyOtherIds = useMemo(
    () => acceptNotifyUserIds.filter((id) => id !== user?.id),
    [acceptNotifyUserIds, user?.id],
  )

  return (
    <section
      id="est-step-delivery"
      className={'est-backstage-card est-region-tint' + (flash ? ' estimate-customer-search-highlight' : '')}
    >
      <h2 className="est-backstage-head">
        {stepDot}Delivery
        <span className="est-backstage-sub">The customer never sees this section.</span>
      </h2>
    <fieldset
      style={{
        marginTop: '1rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem',
        maxWidth: 560,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Email when customer accepts</legend>
      <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Choose who gets an email when the customer submits acceptance. Check <strong>Notify me</strong> for
        yourself, then search below to add anyone else.
      </p>
      {user?.id ? (
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="checkbox"
            checked={acceptNotifyUserIds.includes(user.id)}
            onChange={(e) => {
              const on = e.target.checked
              setAcceptNotifyUserIds((prev) => {
                const others = prev.filter((id) => id !== user.id)
                if (on) return [...new Set([user.id, ...others])]
                return others
              })
            }}
            style={{ marginTop: '0.15rem', flexShrink: 0 }}
          />
          <span>
            <span style={{ fontWeight: 600 }}>Notify me</span>
            <span style={{ fontWeight: 500 }}> · {profileName?.trim() || 'You'}</span>
            <span style={{ color: 'var(--text-muted)' }}> · {user.email?.trim() || '—'}</span>
          </span>
        </label>
      ) : null}
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
        Also notify
      </div>
      <SearchableMultiSelect
        id="estimate-accept-notify-others"
        options={acceptNotifyOtherSelectOptions}
        value={acceptNotifyOtherIds}
        onChange={(next) => {
          setAcceptNotifyUserIds((prev) => {
            const selfOn = user?.id ? prev.includes(user.id) : false
            const base = selfOn && user?.id ? [user.id] : []
            return [...new Set([...base, ...next])]
          })
        }}
        listAriaLabel="Additional acceptance notify recipients"
        pinSelectedToTop
      />
    </fieldset>
    <div style={{ marginTop: '1rem' }}>
      <label htmlFor="estimate-linked-project" style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>
        Project
      </label>
      <SearchableSelect
        id="estimate-linked-project"
        value={linkedProjectId}
        onChange={setLinkedProjectId}
        options={(projectsForPicker ?? []).map((p) => ({
          value: p.id,
          label: `${p.name ?? 'Unnamed project'}${formatProjectNumberLabel(p.project_number) ? ` — ${formatProjectNumberLabel(p.project_number)}` : ''}`,
        }))}
        emptyOption={{ value: '', label: 'Not linked' }}
        placeholder="Not linked"
        listAriaLabel="Linked project"
      />
    </div>
    <label style={{ display: 'block', marginTop: '1rem' }}>
      <span style={{ fontWeight: 500 }}>Internal notes</span>
      <AutosizeTextarea
        value={internalNotes}
        onChange={(e) => setInternalNotes(e.target.value)}
        minRows={1}
        extraLines={internalNotes.trim() ? 1 : 0}
        style={{ ...estInputBase, marginTop: '0.25rem', padding: '0.5rem', fontFamily: 'inherit' }}
      />
    </label>
    </section>
  )
}
