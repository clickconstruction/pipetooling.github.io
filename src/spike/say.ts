/** SPIKE ONLY: a press on the made-up page says what the real page opens, in a line at the foot. */
export const say = (what: string) => () => {
  const el = document.createElement('div')
  el.textContent = `Spike page: ${what}. On the live page this opens the real window.`
  el.setAttribute('style', 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#111827;color:white;padding:8px 14px;border-radius:8px;font:13px system-ui;z-index:99')
  document.body.appendChild(el)
  window.setTimeout(() => el.remove(), 2200)
}
