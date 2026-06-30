"use client";

// Generic prompt-template editor skin: wraps the live `PromptTemplateEditor`
// from the package and re-exports it so consumers can `npx shadcn add` to keep
// a local copy that imports the live logic from `@mano8/astro-prompt-m8/react`.
import {
  PromptTemplateEditor,
  type PromptTemplateEditorLabels
} from "@mano8/astro-prompt-m8/react";

export type { PromptTemplateEditorLabels };
export { PromptTemplateEditor };

export interface PromptTemplateEditorSkinProps {
  labels?: Partial<PromptTemplateEditorLabels>;
}

export default function PromptTemplateEditorSkin({
  labels
}: PromptTemplateEditorSkinProps) {
  return <PromptTemplateEditor labels={labels} />;
}