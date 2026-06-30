"use client";

// Generic prompt-block editor skin: wraps the live `PromptBlockLibrary` from
// the package and re-exports it so consumers can `npx shadcn add` to keep a
// local copy that imports the live logic from `@mano8/astro-prompt-m8/react`.
// Edit freely per app — labels and styling can be overridden without forking
// the headless contract.
import {
  PromptBlockLibrary,
  type PromptBlockLibraryLabels
} from "@mano8/astro-prompt-m8/react";

export type { PromptBlockLibraryLabels };
export { PromptBlockLibrary };

export interface PromptBlockEditorProps {
  labels?: Partial<PromptBlockLibraryLabels>;
}

export default function PromptBlockEditor({ labels }: PromptBlockEditorProps) {
  return <PromptBlockLibrary labels={labels} />;
}