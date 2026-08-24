import * as React from "react";

import {
  AdminPromptView,
  BlocksView,
  ComposerView,
  TemplatesView
} from "../../../src/runtime/react/default-ui/index.js";
import { PromptErrorBoundary } from "../../../src/runtime/react/PromptErrorBoundary.js";

const CONFIG = {
  apiBase: "/prompt-api",
  apiPrefix: "",
  adminRole: "is_superuser"
} as const;

type PanelId = "blocks" | "templates" | "composer" | "admin" | "boundary";

const PANELS: { id: PanelId; label: string; description: string }[] = [
  {
    id: "blocks",
    label: "Block library",
    description:
      "The island `blocks.astro` mounts. Search, filter, sort and page all reach the stub service, which answers them the way prompt-engine-m8 does."
  },
  {
    id: "templates",
    label: "Template editor",
    description: "The island `templates.astro` mounts, over the same server-driven list contract."
  },
  {
    id: "composer",
    label: "Composer",
    description: "The island `composer.astro` mounts, for a single template."
  },
  {
    id: "admin",
    label: "Admin panel",
    description:
      "The island `admin/prompts.astro` mounts. The stub reports a non-superuser, so this is the fail-closed surface a normal user sees."
  },
  {
    id: "boundary",
    label: "Error boundary",
    description:
      "A render throw inside an island would otherwise blank the whole island. `A-C3`'s boundary degrades it to the plugin's error surface."
  }
];

/** Throws on demand so the boundary panel has something real to catch. */
function BoundaryProbe({ failing }: { failing: boolean }) {
  if (failing) throw new Error("The preview probe threw during render.");
  return <p className="preview-copy">The probe is rendering normally. Break it to see the catch.</p>;
}

function BoundaryPanel() {
  const [failing, setFailing] = React.useState(false);
  const [caught, setCaught] = React.useState<string | null>(null);

  return (
    <div className="preview-stack">
      <div className="preview-actions">
        <button type="button" onClick={() => setFailing((current) => !current)}>
          {failing ? "Repair the probe" : "Break the probe"}
        </button>
        {caught ? <span className="preview-note">onError saw: {caught}</span> : null}
      </div>
      <PromptErrorBoundary resetKeys={[failing]} onError={(error) => setCaught(error.message)}>
        <BoundaryProbe failing={failing} />
      </PromptErrorBoundary>
    </div>
  );
}

export function PreviewApp() {
  const [panel, setPanel] = React.useState<PanelId>("blocks");
  const active = PANELS.find((entry) => entry.id === panel) ?? PANELS[0];

  return (
    <main className="preview-shell">
      <header className="preview-hero">
        <p className="preview-kicker">dev-only fixture</p>
        <h1>astro-prompt-m8 /_preview</h1>
        <p className="preview-copy">
          Every panel below mounts a real island root against an in-memory stand-in for
          prompt-engine-m8. No backend, no auth, and no mocked hooks: the views, hooks, api
          wrappers and Zod schemas are the shipped ones, and only <code>fetch</code> is replaced.
        </p>
        <nav className="preview-tabs">
          {PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === panel ? "is-active" : undefined}
              onClick={() => setPanel(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="preview-card">
        <div className="preview-card__header">
          <h2>{active.label}</h2>
          <p>{active.description}</p>
        </div>
        {/*
          Keyed on the panel id so switching tabs remounts the island rather
          than re-using a mounted one. That is what a route change does, and it
          is the state a gallery should be showing.
        */}
        <div className="preview-stage" key={panel}>
          {panel === "blocks" ? <BlocksView config={CONFIG} /> : null}
          {panel === "templates" ? <TemplatesView config={CONFIG} /> : null}
          {panel === "composer" ? <ComposerView config={CONFIG} templateId={1} /> : null}
          {panel === "admin" ? <AdminPromptView config={CONFIG} /> : null}
          {panel === "boundary" ? <BoundaryPanel /> : null}
        </div>
      </section>
    </main>
  );
}
