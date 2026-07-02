"use client";

// Prompt admin landing view: a dashboard built from the package's headless
// `usePromptAdmin` hook. Logic stays a live dependency
// (@mano8/astro-prompt-m8/hooks); this file is only the shadcn skin, copied
// into the consumer via the @mano8-prompt registry — edit freely per app.
import * as React from "react";
import { Boxes, FileText, FolderTree, Users } from "lucide-react";
import { usePromptAdmin } from "@mano8/astro-prompt-m8/hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface PromptDashboardOverviewLabels {
  title: string;
  subtitle: string;
  blocks: string;
  templates: string;
  categories: string;
  users: string;
  activityTitle: string;
  activityModel: string;
  activityEmpty: string;
  noCategories: string;
  error: string;
}

const DEFAULT_LABELS: PromptDashboardOverviewLabels = {
  title: "Overview",
  subtitle: "Prompt-engine usage at a glance.",
  blocks: "Blocks",
  templates: "Templates",
  categories: "Categories",
  users: "Active users",
  activityTitle: "Recent activity",
  activityModel: "Model",
  activityEmpty: "No recent activity.",
  noCategories: "No categories yet.",
  error: "Could not load admin data."
};

export interface PromptDashboardOverviewProps {
  labels?: Partial<PromptDashboardOverviewLabels>;
}

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export function PromptDashboardOverview({ labels }: PromptDashboardOverviewProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { overview, error, load } = usePromptAdmin();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="not-content space-y-4" aria-busy="true">
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <Card role="alert" className="border-destructive/50">
        <CardContent className="py-6 text-sm text-destructive">{t.error}</CardContent>
      </Card>
    );
  }

  const counters = overview?.activity.activity.activity ?? [];

  return (
    <div className="not-content space-y-6">
      <div className="space-y-1 pb-3">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.blocks}
          value={(overview?.blocks.count ?? 0).toLocaleString()}
          icon={Boxes}
        />
        <StatCard
          label={t.templates}
          value={(overview?.templates.count ?? 0).toLocaleString()}
          icon={FileText}
        />
        <StatCard
          label={t.categories}
          value={(overview?.categories?.count ?? 0).toLocaleString()}
          icon={FolderTree}
        />
        <StatCard
          label={t.users}
          value={(overview?.activity.nb_users ?? 0).toLocaleString()}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview?.categories === null && overview?.templates.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.noCategories}</p>
          ) : counters.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.activityEmpty}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {counters.map((c) => (
                <li key={c.model} className="flex justify-between border-b pb-1">
                  <span>{t.activityModel}: {c.model}</span>
                  <span className="tabular-nums">+{c.added} · ↻{c.updated}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
