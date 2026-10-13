"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/env";
import { defaultSnapshot, fromRow, toRow, type CompanyRow } from "@/lib/persistence/serialize";
import { COMPANY_COLUMNS, useSessionStore } from "@/lib/session/store";
import { useSimulatorStore } from "@/lib/simulator/store";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CompanySummary {
  id: string;
  name: string;
  updated_at: string;
}

const MAX_NAME = 120;

const updatedLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function CompanyItem({
  company,
  active,
  onOpen,
  onRename,
  onDelete,
}: {
  company: CompanySummary;
  active: boolean;
  onOpen: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(company.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputId = useId();

  return (
    <li className={cn("grid gap-3 rounded-lg border border-border p-4 sm:flex sm:items-center sm:justify-between", active && "border-metric/60")}>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) await onRename(trimmed);
            setEditing(false);
          }}
        >
          <Label htmlFor={inputId} className="sr-only">Company name</Label>
          <Input id={inputId} value={name} maxLength={MAX_NAME} autoFocus onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name"><Check /></Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel rename" onClick={() => { setName(company.name); setEditing(false); }}>
            <X />
          </Button>
        </form>
      ) : (
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium">
            {company.name}
            {active && <span className="ml-2 text-xs font-normal text-metric">Open</span>}
          </span>
          <span className="text-xs text-muted-foreground">Updated {updatedLabel(company.updated_at)}</span>
        </div>
      )}
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onOpen}>{active ? "Continue" : "Open"}</Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Rename ${company.name}`} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          {confirmingDelete ? (
            <>
              <Button size="sm" variant="destructive" onClick={onDelete}>Delete permanently</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>Keep</Button>
            </>
          ) : (
            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${company.name}`} onClick={() => setConfirmingDelete(true)}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function CompanyList() {
  const router = useRouter();
  const nameId = useId();
  const user = useSessionStore((s) => s.user);
  const ready = useSessionStore((s) => s.ready);
  const activeId = useSimulatorStore((s) => s.companyId);
  const [companies, setCompanies] = useState<CompanySummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bumped after each change to re-fetch the list.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!user || !supabase) return;
    let cancelled = false;
    supabase
      .from("companies")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        else setCompanies(data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, version]);

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-muted-foreground">Accounts aren&apos;t set up on this deployment.</p>;
  }
  if (!ready) return <p className="text-sm text-muted-foreground">Loadingâ€¦</p>;
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to save client companies</CardTitle>
          <CardDescription>The modules work without an account using the demo company.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/login" />}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  const supabase = () => getBrowserClient()!;

  const open = async (id: string) => {
    const { data, error: openError } = await supabase()
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("id", id)
      .single<CompanyRow>();
    if (openError || !data) {
      setError(openError?.message ?? "Company not found.");
      return;
    }
    useSimulatorStore.getState().loadCompany({ id: data.id, name: data.name, snapshot: fromRow(data) });
    router.push("/simulator");
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const { data, error: createError } = await supabase()
      .from("companies")
      .insert({ name, ...toRow(defaultSnapshot()) })
      .select("id")
      .single<{ id: string }>();
    if (createError || !data) {
      setError(createError?.message ?? "Couldn't create the company.");
      return;
    }
    setNewName("");
    await open(data.id);
  };

  const rename = async (id: string, name: string) => {
    const { error: renameError } = await supabase().from("companies").update({ name }).eq("id", id);
    if (renameError) setError(renameError.message);
    else {
      if (id === activeId) useSimulatorStore.getState().setCompanyName(name);
      refresh();
    }
  };

  const remove = async (id: string) => {
    const { error: deleteError } = await supabase().from("companies").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (id === activeId) useSimulatorStore.getState().exitToDemo();
      refresh();
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New client company</CardTitle>
          <CardDescription>Starts from the demo figures; overwrite them in the simulator.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor={nameId}>Company name</Label>
              <Input id={nameId} value={newName} maxLength={MAX_NAME} placeholder="e.g. Hartwell Family Holdings" onChange={(e) => setNewName(e.target.value)} />
            </div>
            <Button type="submit" disabled={!newName.trim()}>
              <Plus data-icon="inline-start" />
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>}

      <section className="grid gap-3" aria-labelledby="companies-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="companies-heading" className="font-heading text-lg font-semibold">Your companies</h2>
          {activeId && (
            <Button variant="ghost" size="sm" onClick={() => useSimulatorStore.getState().exitToDemo()}>
              Switch to demo company
            </Button>
          )}
        </div>
        {companies === null ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No companies yet. Create your first one above.</p>
        ) : (
          <ul className="grid gap-3">
            {companies.map((c) => (
              <CompanyItem
                key={c.id}
                company={c}
                active={c.id === activeId}
                onOpen={() => void open(c.id)}
                onRename={(name) => rename(c.id, name)}
                onDelete={() => remove(c.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
