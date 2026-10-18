"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, LogOut, Pencil, Plus, Send, Trash2, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canChangeMember, decideFirm, invitableRoles, type FirmRole } from "@/lib/authz/policy";
import { isSupabaseConfigured } from "@/lib/env";
import { FIRM_INVITE_DAYS, ROLE_LABELS, roleWithArticle, type FirmDetail, type FirmMember } from "@/lib/firms/schema";
import {
  changeRole,
  createFirm,
  inviteMember,
  removeMember,
  renameFirm,
  revokeInvite,
  useFirm,
  useFirms,
  type ApiResult,
} from "@/lib/firms/use-firms-api";
import { useSessionStore } from "@/lib/session/store";
import { cn } from "@/lib/utils";

const ROLES: FirmRole[] = ["owner", "admin", "member"];
const MAX_NAME = 120;
const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));

function RoleSelect({ id, value, options, onChange, label }: { id?: string; value: FirmRole; options: FirmRole[]; onChange: (role: FirmRole) => void; label: string }) {
  const items = options.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
  return (
    <Select items={items} value={value} onValueChange={(role) => role && onChange(role as FirmRole)}>
      <SelectTrigger id={id} size="sm" className="w-28" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MemberRow({ detail, member, run }: { detail: FirmDetail; member: FirmMember; run: (action: () => Promise<ApiResult<unknown>>) => Promise<boolean> }) {
  const actor = { id: detail.me, role: detail.firm.role };
  const target = { id: member.userId, role: member.role };
  const self = member.userId === detail.me;
  const roleOptions = ROLES.filter((role) => role === member.role || canChangeMember(actor, target, { kind: "role", role }));
  const canRemove = canChangeMember(actor, target, { kind: "remove" });
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="grid gap-3 py-3 sm:flex sm:items-center sm:justify-between">
      <div className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-medium">
          {member.email}
          {self && <span className="ml-2 text-xs font-normal text-metric">You</span>}
        </span>
        <span className="text-xs text-muted-foreground">Joined {dateLabel(member.joinedAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {roleOptions.length > 1 ? (
          <RoleSelect
            value={member.role}
            options={roleOptions}
            label={`Role for ${member.email}`}
            onChange={(role) => void run(() => changeRole(detail.firm.id, member.userId, role))}
          />
        ) : (
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
        )}
        {canRemove &&
          (confirming ? (
            <>
              <Button size="sm" variant="destructive" onClick={() => void run(() => removeMember(detail.firm.id, member.userId)).then(() => setConfirming(false))}>
                {self ? "Leave firm" : "Remove"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="icon-sm" variant="ghost" aria-label={self ? "Leave this firm" : `Remove ${member.email}`} onClick={() => setConfirming(true)}>
              {self ? <LogOut /> : <UserMinus />}
            </Button>
          ))}
      </div>
    </li>
  );
}

function InvitePanel({ detail, run, onChanged }: { detail: FirmDetail; run: (action: () => Promise<ApiResult<unknown>>) => Promise<boolean>; onChanged: () => void }) {
  const emailId = useId();
  const roleId = useId();
  const roles = invitableRoles(detail.firm.role);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FirmRole>("member");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const address = email.trim().toLowerCase();
    const result = await inviteMember(detail.firm.id, address, role);
    if (!result.ok) {
      setError(result.error === "Invalid request" ? "Enter a valid email address." : result.error);
      return;
    }
    setLink({ email: address, url: result.data.url });
    setCopied(false);
    setEmail("");
    onChanged();
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" aria-hidden />
          Invite a colleague
        </CardTitle>
        <CardDescription>
          You&apos;ll get a private link to send them. It only works when they sign in with this email address, and
          expires in {FIRM_INVITE_DAYS} days. Make them an owner after they join.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" autoComplete="off" value={email} maxLength={254} placeholder="colleague@firm.com" onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={roleId}>Role</Label>
            <RoleSelect id={roleId} value={role} options={roles} label="Role to offer" onChange={setRole} />
          </div>
          <Button type="submit" disabled={!email.trim()}>Create link</Button>
        </form>
        {error && <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-critical">{error}</p>}

        {link && (
          <div className="grid gap-2 rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">
              Send this to <span className="text-foreground">{link.email}</span>. It&apos;s shown once; creating another link for them disables this one.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link.url} aria-label="Invitation link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        {detail.invites && detail.invites.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</h3>
            <ul className="divide-y divide-border">
              {detail.invites.map((invite) => {
                const expired = invite.expired;
                return (
                  <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="truncate">{invite.email}</span>
                      <span className={cn("text-xs", expired ? "text-caution" : "text-muted-foreground")}>
                        {ROLE_LABELS[invite.role]} · {expired ? "Expired" : `Expires ${dateLabel(invite.expiresAt)}`}
                      </span>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Revoke invitation for ${invite.email}`} onClick={() => void run(() => revokeInvite(detail.firm.id, invite.id))}>
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FirmName({ detail, onRenamed }: { detail: FirmDetail; onRenamed: (name: string) => Promise<boolean> }) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(detail.firm.name);
  const canRename = decideFirm(detail.firm.role, "firm:rename");

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed && trimmed !== detail.firm.name && !(await onRenamed(trimmed))) return;
          setEditing(false);
        }}
      >
        <Label htmlFor={inputId} className="sr-only">Firm name</Label>
        <Input id={inputId} value={name} maxLength={MAX_NAME} autoFocus onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name"><Check /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel rename" onClick={() => { setName(detail.firm.name); setEditing(false); }}>
          <X />
        </Button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <CardTitle className="truncate text-lg">{detail.firm.name}</CardTitle>
      {canRename && (
        <Button size="icon-sm" variant="ghost" aria-label="Rename firm" onClick={() => { setName(detail.firm.name); setEditing(true); }}>
          <Pencil />
        </Button>
      )}
    </div>
  );
}

function NewFirm({ onCreated }: { onCreated: (id: string) => void }) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New firm</CardTitle>
        <CardDescription>A separate workspace with its own companies and colleagues. You&apos;ll be its owner.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const result = await createFirm(name.trim());
            if (!result.ok) return setError(result.error);
            setName("");
            onCreated(result.data.firm.id);
          }}
        >
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor={nameId}>Firm name</Label>
            <Input id={nameId} value={name} maxLength={MAX_NAME} placeholder="e.g. Meridian Family Office" onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!name.trim()}>
            <Plus data-icon="inline-start" />
            Create firm
          </Button>
        </form>
        {error && <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function TeamSettings() {
  const firmId = useId();
  const user = useSessionStore((s) => s.user);
  const ready = useSessionStore((s) => s.ready);
  const { firms, error: firmsError, refresh: refreshFirms } = useFirms(!!user);
  // ?firm= opens a specific firm, e.g. the one just joined from an invitation.
  const [chosen, setChosen] = useState<string | null>(useSearchParams().get("firm"));
  // Fall back to the first firm when nothing is chosen or the chosen one was just left.
  const selected = firms?.find((f) => f.id === chosen)?.id ?? firms?.[0]?.id ?? null;
  const { detail, error: detailError, refresh: refreshDetail } = useFirm(selected);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured()) return <p className="text-sm text-muted-foreground">Accounts aren&apos;t set up on this deployment.</p>;
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to manage your firm</CardTitle>
          <CardDescription>Firms let colleagues share client companies.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/login?next=/team" />}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  /** Runs a change, shows the server's reason on refusal, and reloads the firm. */
  const run = async (action: () => Promise<ApiResult<unknown>>) => {
    setError(null);
    const result = await action();
    if (!result.ok) setError(result.error);
    refreshDetail();
    refreshFirms();
    return result.ok;
  };

  const loadError = firmsError ?? detailError;
  const firmItems = (firms ?? []).map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className="grid gap-6">
      {firms && firms.length > 1 && (
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor={firmId}>Firm</Label>
          <Select items={firmItems} value={selected} onValueChange={(id) => { if (id) { setChosen(id); setError(null); } }}>
            <SelectTrigger id={firmId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {firmItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(error || loadError) && <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error ?? loadError}</p>}

      {!detail ? (
        !loadError && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <FirmName key={detail.firm.id} detail={detail} onRenamed={(name) => run(() => renameFirm(detail.firm.id, name))} />
              <CardDescription>
                You&apos;re {roleWithArticle(detail.firm.role)}. Everyone here can open and edit
                the firm&apos;s companies; owners and admins manage people. Stakeholders&apos; Decision Room answers stay private from every role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Members <span className="font-mono">({detail.members.length})</span>
              </h2>
              <ul className="divide-y divide-border">
                {detail.members.map((member) => (
                  <MemberRow key={member.userId} detail={detail} member={member} run={run} />
                ))}
              </ul>
            </CardContent>
          </Card>

          {detail.invites !== null && <InvitePanel key={detail.firm.id} detail={detail} run={run} onChanged={refreshDetail} />}
        </>
      )}

      <NewFirm onCreated={(id) => { setChosen(id); refreshFirms(); }} />
    </div>
  );
}
