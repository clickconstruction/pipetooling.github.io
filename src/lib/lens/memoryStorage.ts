/**
 * A Storage that lives in memory (punch list #194). A sealed frame's `localStorage` and
 * `sessionStorage`: the app reads and writes it exactly as the real one, by method, by property
 * and by `Object.keys`, and nothing reaches the dev's own storage. Pure.
 */
const METHODS = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'])

export function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed))
  const api = {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(String(k)) ? map.get(String(k))! : null),
    setItem: (k: string, v: string) => {
      map.set(String(k), String(v))
    },
    removeItem: (k: string) => {
      map.delete(String(k))
    },
    clear: () => map.clear(),
  }
  return new Proxy(api, {
    get(target, prop) {
      if (typeof prop === 'string' && METHODS.has(prop)) return Reflect.get(target, prop)
      if (typeof prop === 'string' && map.has(prop)) return map.get(prop)
      return Reflect.get(target, prop)
    },
    set(_target, prop, value) {
      if (typeof prop === 'string' && !METHODS.has(prop)) map.set(prop, String(value))
      return true
    },
    has(target, prop) {
      return (typeof prop === 'string' && map.has(prop)) || Reflect.has(target, prop)
    },
    deleteProperty(_target, prop) {
      if (typeof prop === 'string') map.delete(prop)
      return true
    },
    ownKeys() {
      return [...map.keys()]
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && map.has(prop)) return { value: map.get(prop), writable: true, enumerable: true, configurable: true }
      return undefined
    },
  }) as unknown as Storage
}
