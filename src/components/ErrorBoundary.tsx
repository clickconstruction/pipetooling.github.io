import React from 'react'
import { chunkRecoveryReloadStarted, errorIsForChunkBoundary } from '../lib/chunkLoadRecovery'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
  /**
   * For a boundary around a lazy page (`RoutePageBoundary`): a page whose code did not come is not this
   * boundary's to answer. It is thrown on to the chunk boundary above, which reloads once and offers
   * **Reload**. An ordinary crash is still caught here.
   */
  chunkLoadsGoUp?: boolean
}

export class ErrorBoundary extends React.Component<
  Props,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.chunkLoadsGoUp && errorIsForChunkBoundary(this.state.error, chunkRecoveryReloadStarted())) {
        throw this.state.error
      }
      return (
        this.props.fallback ?? (
          <div style={{ padding: '1rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            Something went wrong. Please refresh the page or try again later.
          </div>
        )
      )
    }
    return this.props.children
  }
}
