"use client";

// Complete prompt admin dashboard: overview-only admin landing surface.
// Logic is a live dependency (@mano8/astro-prompt-m8/react + /hooks); this file
// is only the shadcn skin, copied via the @mano8-prompt registry — edit per app.
import * as React from "react";
import {
  PromptProvider,
  RequireSuperuser,
  type PromptContextValue
} from "@mano8/astro-prompt-m8/react";

import {
  PromptDashboardOverview,
  type PromptDashboardOverviewLabels
} from "@/components/fa-prompt/prompt-dashboard-overview";

export interface AdminPromptDashboardLabels {
  forbidden: string;
  overview: Partial<PromptDashboardOverviewLabels>;
}

const DEFAULT_LABELS: AdminPromptDashboardLabels = {
  forbidden: "You need administrator access to view this page.",
  overview: {}
};

export interface AdminPromptDashboardProps {
  config?: React.ComponentProps<typeof PromptProvider>["config"];
  adapter?: PromptContextValue["adapter"];
  labels?: Partial<AdminPromptDashboardLabels>;
}

function AdminPromptShell({ labels }: { labels: AdminPromptDashboardLabels }) {
  return (
    <RequireSuperuser
      fallback={
        <div className="not-content mx-auto w-full max-w-md py-10 text-center text-sm text-muted-foreground">
          {labels.forbidden}
        </div>
      }
    >
      <PromptDashboardOverview labels={labels.overview} />
    </RequireSuperuser>
  );
}

export default function AdminPromptDashboard({
  config,
  adapter,
  labels
}: AdminPromptDashboardProps) {
  const resolved: AdminPromptDashboardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    overview: { ...DEFAULT_LABELS.overview, ...labels?.overview }
  };
  return (
    <PromptProvider config={config} adapter={adapter}>
      <AdminPromptShell labels={resolved} />
    </PromptProvider>
  );
}
