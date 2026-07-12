import { serializePromptExport, type PromptExport } from "../schemas.js";

/** Trigger a browser download of a PromptExport as a pretty-printed JSON file. */
export function downloadPromptExport(data: PromptExport, filename: string): void {
  const blob = new Blob([serializePromptExport(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Read a user-selected file and parse it as JSON (validation happens on import). */
export async function readPromptExportFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}
