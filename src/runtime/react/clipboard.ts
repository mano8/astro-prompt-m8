export type ClipboardCopyState = "idle" | "copied" | "error";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
