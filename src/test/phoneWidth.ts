/**
 * A render smoke's width: makes `window.matchMedia` answer the phone query `(max-width: 640px)` as `narrow` says, the
 * query `useNarrowViewport640` asks. Call it before the render, and put `stubPhoneWidth(false)` in `afterEach` so the
 * next test reads a desk again.
 */
export function stubPhoneWidth(narrow: boolean): void {
  const answer = (query: string) => ({
    matches: narrow && query.includes('max-width: 640px'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: answer })
}
