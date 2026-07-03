import type { ReactNode } from "react";
import { PromptProvider } from "../PromptProvider.js";
import { PromptQueryProvider } from "../PromptQueryProvider.js";
import { AdminPromptPanel } from "../AdminPromptPanel.js";
import { PromptBlockLibrary } from "../PromptBlockLibrary.js";
import { PromptTemplateEditor } from "../PromptTemplateEditor.js";
import { PromptComposer } from "../PromptComposer.js";
import type { PromptRuntimeConfig } from "../../config.js";

type ViewConfig = Partial<PromptRuntimeConfig>;

function Shell({ config, children }: { config?: ViewConfig; children: ReactNode }) {
  return (
    <PromptQueryProvider>
      <PromptProvider config={config}>{children}</PromptProvider>
    </PromptQueryProvider>
  );
}

export function BlocksView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <PromptBlockLibrary />
    </Shell>
  );
}

export function TemplatesView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <PromptTemplateEditor />
    </Shell>
  );
}

export function ComposerView({ config, templateId }: { config?: ViewConfig; templateId?: number }) {
  return (
    <Shell config={config}>
      <PromptComposer templateId={templateId} />
    </Shell>
  );
}

export function AdminPromptView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <AdminPromptPanel />
    </Shell>
  );
}