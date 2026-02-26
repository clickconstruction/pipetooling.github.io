/**
 * Opens a URL in the external browser. When running as an iOS PWA in standalone mode,
 * uses the x-safari-https:// scheme to force opening in Safari instead of the in-app browser.
 */
export function openInExternalBrowser(url: string): void {
  const isIOSPWA =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    (navigator as { standalone?: boolean }).standalone === true;

  if (isIOSPWA && (url.startsWith('https://') || url.startsWith('http://'))) {
    const scheme = url.startsWith('https://') ? 'x-safari-https://' : 'x-safari-http://';
    const path = url.replace(/^https?:\/\//, '');
    window.location.href = scheme + path;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
