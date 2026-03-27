/** Dynamic import so `jspdf` (and transitive html2canvas) are not in the initial Bids chunk. */
export async function loadJsPDF(): Promise<(typeof import('jspdf'))['jsPDF']> {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}
