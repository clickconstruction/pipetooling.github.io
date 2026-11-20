import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Any exception inside a Google canvas: the screen falls back to Leaflet rather than blanking.
 * Shared by every canvas that draws on Google, beside the doors in `useGoogleCanvasDoors`.
 */
export class GoogleCanvasBoundary extends Component<{ onUnavailable: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onUnavailable(`render: ${error.message}`)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
