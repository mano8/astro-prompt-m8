"use client";

// Complete prompt admin dashboard: first/landing tab is the overview dashboard,
// secondary tab covers the maintenance-like surface (per-resource create/edit
// panels behind confirmation). For prompt-engine-m8 the danger ops are create/
// edit/delete on blocks and templates, each behind `AlertDialog` confirmation.
// Logic is a live dependency (@mano8/astro-prompt-m8/react + /hooks); this file
// is only the shadcn skin, copied via the @mano8-prompt registry — edit per app.
import * as React from "react";
import { LayoutDashboard, PencilLine } from "lucide-react";
import {
  PromptProvider,
  RequireSuperuser,
  type PromptContextValue
} from "@mano8/astro-prompt-m8/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PromptDashboardOverview,
  type PromptDashboardOverviewLabels
} from "@/components/fa-prompt/prompt-dashboard-overview";
import {
  PromptMaintenancePanel,
  type PromptMaintenanceLabels
} from "@/components/fa-prompt/prompt-maintenance-panel";

export interface AdminPromptDashboardLabels {
  dashboardTab: string;
  maintenanceTab: string;
  forbidden: string;
  overview: Partial<PromptDashboardOverviewLabels>;
  maintenance: Partial<PromptMaintenanceLabels>;
}

const DEFAULT_LABELS: AdminPromptDashboardLabels = {
  dashboardTab: "Dashboard",
  maintenanceTab: "Maintenance",
  forbidden: "You need administrator access to view this page.",
  overview: {},
  maintenance: {}
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
      <Tabs defaultValue="dashboard" className="not-content mx-auto w-full max-w-6xl space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="size-4" />
            {labels.dashboardTab}
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <PencilLine className="size-4" />
            {labels.maintenanceTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <PromptDashboardOverview labels={labels.overview} />
        </TabsContent>
        <TabsContent value="maintenance">
          <PromptMaintenancePanel labels={labels.maintenance} />
        </TabsContent>
      </Tabs>
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
    overview: { ...DEFAULT_LABELS.overview, ...labels?.overview },
    maintenance: { ...DEFAULT_LABELS.maintenance, ...labels?.maintenance }
  };
  return (
    <PromptProvider config={config} adapter={adapter}>
      <AdminPromptShell labels={resolved} />
    </PromptProvider>
  );
}