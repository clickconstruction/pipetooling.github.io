/**
 * Permits, the skim card's map as a Google map (the owner, 2026-11-10: *I would like this picture
 * to be google maps instead of open street map*). The app's browser key draws live Google maps,
 * not Google's still images, so this is a small live map held still: no controls, no gestures, no
 * clicks, the permit in its middle. The tile around it is the link to Google Maps, so the map
 * itself takes no pointer. One map serves the whole sitting: the next card only moves its centre.
 * Any failure (no script, a rejected key, an exception) hands back to the tile map through
 * `onUnavailable`. Lazy-load this file: it pulls in the Maps library.
 */
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps'

const LOAD_TIMEOUT_MS = 8000

class StillBoundary extends Component<{ onUnavailable: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onUnavailable()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function PermitSkimGoogleStill({ apiKey, lat, lng, zoom, onUnavailable }: { apiKey: string; lat: number; lng: number; zoom: number; onUnavailable: () => void }) {
  const [loaded, setLoaded] = useState(false)

  // The script must arrive in a few seconds, or the tile map draws instead.
  useEffect(() => {
    if (loaded) return
    const t = window.setTimeout(onUnavailable, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [loaded, onUnavailable])

  // A rejected key does not fail the script load: Google paints a grey map and calls this global.
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void }
    const prev = w.gm_authFailure
    w.gm_authFailure = () => {
      prev?.()
      onUnavailable()
    }
    return () => {
      w.gm_authFailure = prev
    }
  }, [onUnavailable])

  return (
    <StillBoundary onUnavailable={onUnavailable}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <APIProvider apiKey={apiKey} onLoad={() => setLoaded(true)} onError={onUnavailable}>
          <GoogleMap style={{ width: '100%', height: '100%' }} center={{ lat, lng }} zoom={zoom} colorScheme="LIGHT" gestureHandling="none" keyboardShortcuts={false} clickableIcons={false} disableDefaultUI />
        </APIProvider>
      </div>
    </StillBoundary>
  )
}
