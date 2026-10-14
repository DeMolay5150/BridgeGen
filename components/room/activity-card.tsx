"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STAKEHOLDER_LABELS, type StakeholderId } from "@/lib/simulator/alignment";
import { getBrowserClient } from "@/lib/supabase/client";

interface AuditRow {
  id: number;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const LIMIT = 20;

function describe(row: AuditRow): string {
  const who = STAKEHOLDER_LABELS[row.metadata.stakeholder as StakeholderId] ?? "a stakeholder";
  switch (row.action) {
    case "room.invite_created":
      return `Private link issued to the ${who.toLowerCase()}`;
    case "room.invite_rotated":
      return `The ${who.toLowerCase()}'s link was replaced`;
    case "room.response_submitted":
      return `The ${who.toLowerCase()} submitted their answers`;
    case "room.response_reopened":
      return `The ${who.toLowerCase()} reopened their answers`;
    case "report.exported":
      return "Executive summary PDF exported";
    case "deck.exported":
      return `Red Team deck exported (${String(row.metadata.format ?? "file")})`;
    default:
      return row.action;
  }
}

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/**
 * The company's audit trail: who issued links, when answers came in, what
 * left the building. RLS shows it to the firm's owners and admins only;
 * the card stays hidden until the audit migration is applied.
 */
export function ActivityCard({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<AuditRow[] | "unavailable" | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("audit_events")
      .select("id, action, metadata, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (!cancelled) setRows(error ? "unavailable" : (data as AuditRow[]));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (rows === null || rows === "unavailable") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          Activity
        </CardTitle>
        <CardDescription>Audit trail, visible to the firm&apos;s owners and admins. Never includes answers.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet, or your role doesn&apos;t include the audit trail.</p>
        ) : (
          <ol className="grid gap-2">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-0.5 text-sm">
                <span>{describe(row)}</span>
                <time dateTime={row.created_at} className="font-mono text-xs text-muted-foreground">
                  {when(row.created_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
