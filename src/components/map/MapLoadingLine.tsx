/**
 * What a map of dots says in its frame while it is not up yet (v2.8179): one line, in the middle,
 * in the words the app's other maps use. `PinsMapFrame` draws it while the canvas's own code is on
 * its way, and `PinsMapGoogleCanvas` draws it while Google's script is, so the two waits read as
 * one and the frame is never an empty box. The painted map's canvas has said the same since v2.8078.
 *
 * In the middle, so it clears the presses a frame wears: the view presses at the top right and a
 * card's own at the bottom corners. It takes no press. Its parent must be positioned.
 *
 * `--text-600`, not the muted token: the frame's box is `--bg-muted`, where muted words read 4.4 to 1
 * in light and 4.1 to 1 in dark, and this line can stand for ten seconds.
 */
export function MapLoadingLine() {
  return (
    <p
      data-map-loading
      role="status"
      style={{ position: 'absolute', inset: 0, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', color: 'var(--text-600)', fontSize: '0.875rem', pointerEvents: 'none' }}
    >
      Loading the map…
    </p>
  )
}
