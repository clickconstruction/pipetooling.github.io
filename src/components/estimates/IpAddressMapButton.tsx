import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchIpGeoForMaps, googleMapsUrlForLatLng, isRoutablePublicIp } from '../../lib/ipGeolocationMaps'
import { useToastContext } from '../../contexts/ToastContext'

type Props = {
  ip: string | null | undefined
  disabled?: boolean
}

export default function IpAddressMapButton({ ip, disabled }: Props) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(false)

  const trimmed = typeof ip === 'string' ? ip.trim() : ''
  const showMap = trimmed.length > 0 && isRoutablePublicIp(trimmed)

  const openMap = useCallback(async () => {
    if (!trimmed || !showMap || disabled || loading) return
    setLoading(true)
    try {
      const { lat, lng } = await fetchIpGeoForMaps(supabase, trimmed)
      const mapsUrl = googleMapsUrlForLatLng(lat, lng)
      window.open(mapsUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not open map', 'error')
    } finally {
      setLoading(false)
    }
  }, [trimmed, showMap, disabled, loading, showToast])

  if (!trimmed) {
    return <>—</>
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
      <span>{trimmed}</span>
      {showMap ? (
        <button
          type="button"
          onClick={() => void openMap()}
          disabled={disabled === true || loading}
          title="Approximate location from IP (geo-IP); opens Google Maps"
          style={{
            fontSize: '0.85em',
            padding: '0.1rem 0.4rem',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            color: '#2563eb',
          }}
        >
          {loading ? '…' : 'Map'}
        </button>
      ) : null}
    </span>
  )
}
