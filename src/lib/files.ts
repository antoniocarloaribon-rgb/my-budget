/**
 * Save a file. On iPhone the share sheet is used (choose "Save to Files");
 * elsewhere a normal download is triggered.
 */
export async function saveFile(filename: string, content: string, mime: string): Promise<void> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // user cancelled
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
