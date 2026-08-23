// Mounts every installed skin the way a consumer would, so the gate checks the
// props each one publishes and not only that its module compiles in isolation.
//
// The skin files themselves are copied in by `scripts/verify-registry-consumer.mjs`
// from the generated `registry/r/*.json`, at the same `target` paths a shadcn
// install would use.
import * as React from "react";

import AdminPromptDashboard from "./components/fa-prompt/admin-prompt-dashboard";
import PromptBlockEditor from "./components/fa-prompt/prompt-block-editor";
import PromptTemplateEditorSkin from "./components/fa-prompt/prompt-template-editor";
import { PromptDashboardOverview } from "./components/fa-prompt/prompt-dashboard-overview";

export function RegistryConsumerFixture(): React.JSX.Element {
  return (
    <main>
      <PromptBlockEditor />
      <PromptTemplateEditorSkin />
      <PromptDashboardOverview />
      <AdminPromptDashboard />
    </main>
  );
}
