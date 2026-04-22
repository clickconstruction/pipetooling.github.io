import type { Dispatch, SetStateAction } from 'react'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'

type Props = {
  serviceTypes: Array<{ id: string; name: string }>
  enabledBidServiceTypeIds: string[]
  disabled?: boolean
  onEnabledChange: Dispatch<SetStateAction<string[]>>
  onAfterToggle?: () => void
}

/** Tag-style multi-toggle buttons for bid service types in unified job/bid search (Clock In, Estimator reference, etc.). */
export default function BidServiceTypeSearchToggles({
  serviceTypes,
  enabledBidServiceTypeIds,
  disabled = false,
  onEnabledChange,
  onAfterToggle,
}: Props) {
  if (serviceTypes.length <= 1) return null

  const enabledSet = new Set(enabledBidServiceTypeIds)

  return (
    <div
      role="group"
      aria-label="Bid service types to include in search"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.22rem',
        flexShrink: 0,
      }}
    >
      {serviceTypes.map((st) => {
        const on = enabledSet.has(st.id)
        const tagInfo = getBidServiceTypeTag(st.name)
        const label = (tagInfo?.tag ?? st.name.slice(0, 4)).toUpperCase()
        const borderColor = tagInfo?.color ?? '#d1d5db'
        return (
          <button
            key={st.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${on ? 'Hide' : 'Show'} ${st.name} bids in search`}
            onClick={() => {
              onEnabledChange((prev) => {
                if (prev.includes(st.id)) {
                  if (prev.length <= 1) return prev
                  return prev.filter((id) => id !== st.id)
                }
                return [...prev, st.id]
              })
              onAfterToggle?.()
            }}
            style={{
              padding: '0.1rem 0.3rem',
              fontSize: '0.6875rem',
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderRadius: 3,
              border: `1px solid ${borderColor}`,
              background: on ? borderColor : 'white',
              color: on ? '#fff' : '#374151',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
