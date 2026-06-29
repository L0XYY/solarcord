"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  PERMISSION_GROUPS,
  Permission,
  toBits,
  has,
  DISCOVERY_CATEGORIES,
  SERVER_BADGE_INFO,
  BANNER_BOOST_REQUIREMENT,
  BOOST_TIERS,
  type PermissionKey,
  type ServerBadgeType,
} from "@solarcord/shared";
import { BadgeChip } from "./BadgeChip";
import { ImageUpload } from "./ImageUpload";
import { Icon } from "./Icon";
import { api, ApiError, API_URL } from "@/lib/api";
import { colorToHex, hexToInt, ROLE_SWATCHES, initials, displayName, formatTime } from "@/lib/ui";
import type { AuditLogEntry, BanEntry, MemberView, Role } from "@/lib/types";

type Tab = "overview" | "guide" | "roles" | "members" | "badges" | "automod" | "webhooks" | "bans" | "audit";

export interface MePerms {
  isOwner: boolean;
  permissions: string;
}

export function ServerSettingsModal({
  serverId,
  serverName,
  me,
  onClose,
  onChanged,
}: {
  serverId: string;
  serverName: string;
  me: MePerms;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tabs = useMemo(() => {
    const can = (p: bigint) => me.isOwner || has(me.permissions, p);
    const list: Tab[] = [];
    if (can(Permission.MANAGE_SERVER)) list.push("overview", "guide");
    if (can(Permission.MANAGE_ROLES)) list.push("roles");
    list.push("members");
    if (can(Permission.MANAGE_SERVER)) list.push("badges", "automod");
    if (can(Permission.MANAGE_WEBHOOKS)) list.push("webhooks");
    if (can(Permission.BAN_MEMBERS)) list.push("bans");
    if (can(Permission.VIEW_AUDIT_LOG)) list.push("audit");
    return list;
  }, [me]);

  const [tab, setTab] = useState<Tab>(tabs[0] ?? "members");
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<MemberView[]>([]);

  async function load() {
    const [{ roles: r }, { members: m }] = await Promise.all([
      api<{ roles: Role[] }>(`/servers/${serverId}/roles`),
      api<{ members: MemberView[] }>(`/servers/${serverId}/members`),
    ]);
    setRoles(r);
    setMembers(m);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  function close() {
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-night-900/80 backdrop-blur-sm" onClick={close}>
      <div className="m-auto flex h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl glass-strong shadow-glass" onClick={(e) => e.stopPropagation()}>
        {/* Left nav */}
        <div className="w-56 shrink-0 border-r border-line/5 bg-night-900/40 p-4">
          <p className="truncate px-2 text-[11px] font-bold uppercase tracking-wider text-muted">{serverName}</p>
          <nav className="mt-3 space-y-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "w-full rounded-lg px-3 py-2 text-left text-sm font-medium capitalize transition",
                  tab === t ? "bg-solar/15 text-solar" : "text-muted hover:bg-night-700/60 hover:text-ink",
                )}
              >
                {t === "audit" ? "Audit Log" : t}
              </button>
            ))}
          </nav>
          <button onClick={close} className="btn-ghost mt-6 w-full text-sm">
            Close
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          {tab === "overview" && <OverviewTab serverId={serverId} onSaved={onChanged} />}
          {tab === "guide" && <GuideTab serverId={serverId} />}
          {tab === "roles" && <RolesTab serverId={serverId} roles={roles} onReload={load} />}
          {tab === "members" && <MembersTab serverId={serverId} roles={roles} members={members} me={me} onReload={load} />}
          {tab === "badges" && <BadgesTab serverId={serverId} onChanged={onChanged} />}
          {tab === "automod" && <AutoModTab serverId={serverId} />}
          {tab === "webhooks" && <WebhooksTab serverId={serverId} />}
          {tab === "bans" && <BansTab serverId={serverId} />}
          {tab === "audit" && <AuditTab serverId={serverId} />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Roles tab ───────────────────────────

function RolesTab({ serverId, roles, onReload }: { serverId: string; roles: Role[]; onReload: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(0);
  const [perms, setPerms] = useState("0");
  const [icon, setIcon] = useState<string | null>(null);
  const [hoisted, setHoisted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && roles.length) setSelectedId(roles[0]!.id);
  }, [roles, selectedId]);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setColor(selected.color);
      setPerms(selected.permissions);
      setIcon(selected.iconUrl);
      setHoisted(selected.isHoisted);
      setError(null);
    }
  }, [selected]);

  const dirty =
    selected &&
    (name !== selected.name || color !== selected.color || perms !== selected.permissions || icon !== selected.iconUrl || hoisted !== selected.isHoisted);

  function togglePerm(key: PermissionKey) {
    const bit = Permission[key];
    const cur = toBits(perms);
    setPerms(((cur & bit) === bit ? cur & ~bit : cur | bit).toString());
  }
  const hasPerm = (key: PermissionKey) => (toBits(perms) & Permission[key]) === Permission[key];

  async function createRole() {
    setError(null);
    try {
      const { role } = await api<{ role: Role }>(`/servers/${serverId}/roles`, {
        method: "POST",
        json: { name: "new role", color: 0 },
      });
      await onReload();
      setSelectedId(role.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create role");
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/roles/${selected.id}`, { method: "PATCH", json: { name, color, permissions: perms, iconUrl: icon, hoisted } });
      await onReload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || selected.isEveryone) return;
    if (!confirm(`Delete the “${selected.name}” role?`)) return;
    try {
      await api(`/roles/${selected.id}`, { method: "DELETE" });
      setSelectedId(null);
      await onReload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="relative flex h-full">
      {/* Role list */}
      <div className="flex w-56 shrink-0 flex-col border-r border-line/5">
        <div className="flex items-center justify-between border-b border-line/5 p-3">
          <span className="text-sm font-bold">Roles</span>
          <button onClick={createRole} title="Create role" className="text-lg leading-none text-muted hover:text-solar">
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={clsx(
                "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                r.id === selectedId ? "bg-night-700/70 text-ink" : "text-muted hover:bg-night-700/40 hover:text-ink",
              )}
            >
              {r.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.iconUrl} alt="" className="h-4 w-4 shrink-0 rounded" />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorToHex(r.color) }} />
              )}
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        {!selected ? (
          <p className="text-sm text-muted">Select a role to edit, or create one.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Role name</label>
                <input
                  className="field mt-1"
                  value={name}
                  disabled={selected.isEveryone}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {!selected.isEveryone && (
                <button onClick={remove} className="mt-6 rounded-lg px-3 py-2 text-sm text-muted hover:bg-night-700 hover:text-solar-ember">
                  Delete
                </button>
              )}
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Role colour</label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={colorToHex(color)}
                  onChange={(e) => setColor(hexToInt(e.target.value))}
                  className="h-8 w-10 cursor-pointer rounded border border-line/10 bg-transparent"
                />
                {ROLE_SWATCHES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setColor(s)}
                    className={clsx("h-7 w-7 rounded-full ring-2 ring-transparent transition", color === s && "ring-ink")}
                    style={{ background: colorToHex(s) }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Role icon</label>
              <div className="mt-2">
                <ImageUpload value={icon} shape="square" maxW={64} maxH={64} format="image/png" label="Upload icon" onChange={setIcon} />
              </div>
            </div>

            {!selected.isEveryone && (
              <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line/10 bg-night-900/40 p-3">
                <span>
                  <span className="text-sm font-medium">Display role members separately</span>
                  <span className="block text-xs text-muted">Show members with this role in their own group in the member list.</span>
                </span>
                <Toggle on={hoisted} onClick={() => setHoisted((v) => !v)} />
              </label>
            )}

            <div className="mt-6">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Permissions</label>
              <div className="mt-2 space-y-5">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1 text-xs font-bold text-ink/80">{g.group}</p>
                    <div className="divide-y divide-line/5">
                      {g.permissions.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center justify-between gap-3 py-2">
                          <span>
                            <span className="text-sm">{p.label}</span>
                            <span className="block text-xs text-muted">{p.description}</span>
                          </span>
                          <Toggle on={hasPerm(p.key)} onClick={() => togglePerm(p.key)} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-solar-ember">{error}</p>}
          </>
        )}
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl glass-strong px-4 py-2 shadow-glass">
          <span className="text-sm text-muted">You have unsaved changes</span>
          <button
            onClick={() => {
              if (selected) {
                setName(selected.name);
                setColor(selected.color);
                setPerms(selected.permissions);
                setIcon(selected.iconUrl);
                setHoisted(selected.isHoisted);
              }
            }}
            className="btn-ghost py-1.5 text-sm"
          >
            Reset
          </button>
          <button onClick={save} disabled={saving} className="btn-solar py-1.5 text-sm">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Members tab ───────────────────────────

function MembersTab({
  serverId,
  roles,
  members,
  me,
  onReload,
}: {
  serverId: string;
  roles: Role[];
  members: MemberView[];
  me: MePerms;
  onReload: () => Promise<void>;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [openMod, setOpenMod] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const assignable = useMemo(() => roles.filter((r) => !r.isEveryone), [roles]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const canKick = me.isOwner || has(me.permissions, Permission.KICK_MEMBERS);
  const canBan = me.isOwner || has(me.permissions, Permission.BAN_MEMBERS);
  const canTimeout = me.isOwner || has(me.permissions, Permission.TIMEOUT_MEMBERS);
  const canManageRoles = me.isOwner || has(me.permissions, Permission.MANAGE_ROLES);

  async function toggle(member: MemberView, roleId: string, hasIt: boolean) {
    const path = `/servers/${serverId}/members/${member.user.id}/roles/${roleId}`;
    await api(path, { method: hasIt ? "DELETE" : "PUT" }).catch(() => {});
    await onReload();
  }

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try {
      await fn();
      await onReload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Action failed");
    }
  }

  async function kick(m: MemberView) {
    if (!confirm(`Kick ${displayName(m.user)} from the server?`)) return;
    await run(() => api(`/servers/${serverId}/members/${m.user.id}`, { method: "DELETE" }));
  }
  async function ban(m: MemberView) {
    const reason = prompt(`Ban ${displayName(m.user)}? Optional reason:`);
    if (reason === null) return;
    await run(() => api(`/servers/${serverId}/bans`, { method: "POST", json: { userId: m.user.id, reason: reason || undefined } }));
  }
  async function timeout(m: MemberView) {
    const raw = prompt(`Timeout ${displayName(m.user)} for how many minutes? (0 to clear)`, "10");
    if (raw === null) return;
    const minutes = Number(raw);
    if (Number.isNaN(minutes)) return;
    await run(() => api(`/servers/${serverId}/members/${m.user.id}/timeout`, { method: "POST", json: { minutes } }));
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Members — {members.length}</h3>
      {err && <p className="mt-2 text-sm text-solar-ember">{err}</p>}
      <div className="mt-4 space-y-1">
        {members.map((m) => {
          const memberRoles = (m.roleIds ?? []).map((id) => roleById.get(id)).filter(Boolean) as Role[];
          return (
            <div key={m.id} className="rounded-xl border border-line/5 bg-night-800/40 p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-xs font-bold text-night-900">
                  {initials(displayName(m.user))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.nickname ?? displayName(m.user)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {memberRoles.length === 0 && <span className="text-xs text-muted">No roles</span>}
                    {memberRoles.map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1 rounded-full bg-night-700/70 px-2 py-0.5 text-xs"
                        style={{ color: colorToHex(r.color) }}
                      >
                        {r.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.iconUrl} alt="" className="h-3 w-3 rounded" />
                        ) : (
                          <span className="h-2 w-2 rounded-full" style={{ background: colorToHex(r.color) }} />
                        )}
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canTimeout && (
                    <button onClick={() => timeout(m)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-amber-400" title="Timeout">
                      <Icon name="clock" size={16} />
                    </button>
                  )}
                  {canKick && (
                    <button onClick={() => kick(m)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-solar-ember" title="Kick">
                      <Icon name="userMinus" size={16} />
                    </button>
                  )}
                  {canBan && (
                    <button onClick={() => ban(m)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-solar-ember" title="Ban">
                      <Icon name="ban" size={16} />
                    </button>
                  )}
                  {canKick && (
                    <button onClick={() => setOpenMod(openMod === m.id ? null : m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-amber-400" title="Warnings & notes">
                      <Icon name="warn" size={16} />
                    </button>
                  )}
                  {canManageRoles && (
                    <button onClick={() => setOpenFor(openFor === m.id ? null : m.id)} className="btn-ghost py-1.5 text-xs">
                      Roles
                    </button>
                  )}
                </div>
              </div>

              {openMod === m.id && <MemberModPanel serverId={serverId} userId={m.user.id} />}

              {openFor === m.id && (
                <div className="mt-3 grid grid-cols-2 gap-1 border-t border-line/5 pt-3">
                  {assignable.length === 0 && <p className="text-xs text-muted">No assignable roles yet.</p>}
                  {assignable.map((r) => {
                    const hasIt = (m.roleIds ?? []).includes(r.id);
                    return (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-night-700/50">
                        <input type="checkbox" checked={hasIt} onChange={() => toggle(m, r.id, hasIt)} className="accent-solar" />
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorToHex(r.color) }} />
                        <span className="truncate text-sm">{r.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Rules & welcome tab ───────────────────────────

function GuideTab({ serverId }: { serverId: string }) {
  const [welcome, setWelcome] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ guide: { rules: string[]; welcomeMessage: string | null } }>(`/servers/${serverId}/guide`)
      .then(({ guide }) => {
        setRules(guide.rules);
        setWelcome(guide.welcomeMessage ?? "");
      })
      .finally(() => setLoaded(true));
  }, [serverId]);

  async function save() {
    await api(`/servers/${serverId}/guide`, { method: "PUT", json: { rules, welcomeMessage: welcome || null } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }
  function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleInput.trim()) return;
    setRules([...rules, ruleInput.trim()]);
    setRuleInput("");
  }

  if (!loaded) return <div className="p-5 text-sm text-muted">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Welcome & rules</h3>
      <p className="mt-1 text-sm text-muted">Shown to members on the welcome screen.</p>

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Welcome message</label>
      <textarea
        className="field mt-1"
        rows={3}
        placeholder="Welcome! Here's what this community is about…"
        value={welcome}
        onChange={(e) => setWelcome(e.target.value)}
      />

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Rules</label>
      <div className="mt-2 space-y-1.5">
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-night-900/40 px-3 py-2 text-sm">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-solar/20 text-[11px] font-bold text-solar">{i + 1}</span>
            <span className="flex-1">{r}</span>
            <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-muted hover:text-solar-ember">
              ✕
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={addRule} className="mt-2 flex gap-2">
        <input className="field" placeholder="Add a rule…" value={ruleInput} onChange={(e) => setRuleInput(e.target.value)} />
        <button className="btn-ghost shrink-0">Add rule</button>
      </form>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} className="btn-solar text-sm">
          Save
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}

// ─────────────────────────── Member moderation history ───────────────────────────

interface ModEntry {
  id: string;
  reason?: string;
  content?: string;
  by: { username: string; displayName: string | null } | null;
  createdAt: string;
}

function MemberModPanel({ serverId, userId }: { serverId: string; userId: string }) {
  const [warnings, setWarnings] = useState<ModEntry[]>([]);
  const [notes, setNotes] = useState<ModEntry[]>([]);
  const [warnInput, setWarnInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await api<{ warnings: ModEntry[]; notes: ModEntry[] }>(`/servers/${serverId}/members/${userId}/moderation`);
    setWarnings(r.warnings);
    setNotes(r.notes);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, userId]);

  async function addWarn(e: React.FormEvent) {
    e.preventDefault();
    if (!warnInput.trim()) return;
    await api(`/servers/${serverId}/members/${userId}/warnings`, { method: "POST", json: { reason: warnInput.trim() } }).catch(() => {});
    setWarnInput("");
    await load();
  }
  async function delWarn(id: string) {
    await api(`/servers/${serverId}/warnings/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteInput.trim()) return;
    await api(`/servers/${serverId}/members/${userId}/notes`, { method: "POST", json: { content: noteInput.trim() } }).catch(() => {});
    setNoteInput("");
    await load();
  }

  if (loading) return <div className="mt-3 border-t border-line/5 pt-3 text-xs text-muted">Loading…</div>;

  return (
    <div className="mt-3 grid gap-4 border-t border-line/5 pt-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">Warnings — {warnings.length}</p>
        <div className="space-y-1">
          {warnings.length === 0 && <p className="text-xs text-muted">No warnings.</p>}
          {warnings.map((w) => (
            <div key={w.id} className="flex items-start gap-2 rounded-lg bg-night-900/40 px-2 py-1.5 text-xs">
              <span className="flex-1">
                {w.reason}
                <span className="block text-[10px] text-muted">by {w.by?.displayName ?? w.by?.username ?? "?"}</span>
              </span>
              <button onClick={() => delWarn(w.id)} className="text-muted hover:text-solar-ember" title="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addWarn} className="mt-2 flex gap-1.5">
          <input className="field py-1.5 text-xs" placeholder="Warn reason…" value={warnInput} onChange={(e) => setWarnInput(e.target.value)} />
          <button className="btn-ghost shrink-0 py-1.5 text-xs">Warn</button>
        </form>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-aurora">Notes — {notes.length}</p>
        <div className="space-y-1">
          {notes.length === 0 && <p className="text-xs text-muted">No notes.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-night-900/40 px-2 py-1.5 text-xs">
              {n.content}
              <span className="block text-[10px] text-muted">by {n.by?.displayName ?? n.by?.username ?? "?"}</span>
            </div>
          ))}
        </div>
        <form onSubmit={addNote} className="mt-2 flex gap-1.5">
          <input className="field py-1.5 text-xs" placeholder="Add a private note…" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
          <button className="btn-ghost shrink-0 py-1.5 text-xs">Save</button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────── Overview tab ───────────────────────────

const VISIBILITY_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "PRIVATE", label: "Private", description: "Invite-only. Not listed anywhere." },
  { value: "PUBLIC", label: "Public", description: "Anyone with the link can join freely." },
  { value: "COMMUNITY", label: "Community", description: "Public with community features and a Community badge." },
  { value: "DISCOVERABLE", label: "Discoverable", description: "Listed in Server Discovery for anyone to find." },
];

interface OverviewForm {
  name: string;
  description: string;
  visibility: string;
  category: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  tag: string;
  tagBadge: string | null;
  systemChannelId: string;
  announceJoins: boolean;
  announceBoosts: boolean;
}

function OverviewTab({ serverId, onSaved }: { serverId: string; onSaved: () => void }) {
  const [form, setForm] = useState<OverviewForm>({
    name: "",
    description: "",
    visibility: "PRIVATE",
    category: "",
    iconUrl: null,
    bannerUrl: null,
    tag: "",
    tagBadge: null,
    systemChannelId: "",
    announceJoins: true,
    announceBoosts: true,
  });
  const [channels, setChannels] = useState<{ id: string; name: string; type: string }[]>([]);
  const [boost, setBoost] = useState({ count: 0, level: 0 });
  const [allowance, setAllowance] = useState<{ isStaff: boolean; solarPlus: boolean; available: number | null; max: number | null; resetAt: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [boostErr, setBoostErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bannerUnlocked = boost.count >= BANNER_BOOST_REQUIREMENT;
  const canBoost = !!allowance && (allowance.available === null || allowance.available > 0);

  const load = () =>
    api<{
      server: {
        name: string;
        description: string | null;
        visibility: string;
        category: string | null;
        iconUrl: string | null;
        bannerUrl: string | null;
        tag: string | null;
        tagBadge: string | null;
        boostCount: number;
        boostLevel: number;
        systemChannelId: string | null;
        announceJoins: boolean;
        announceBoosts: boolean;
        channels: { id: string; name: string; type: string }[];
      };
    }>(`/servers/${serverId}`).then(({ server }) => {
      setForm({
        name: server.name,
        description: server.description ?? "",
        visibility: server.visibility,
        category: server.category ?? "",
        iconUrl: server.iconUrl,
        bannerUrl: server.bannerUrl,
        tag: server.tag ?? "",
        tagBadge: server.tagBadge,
        systemChannelId: server.systemChannelId ?? "",
        announceJoins: server.announceJoins,
        announceBoosts: server.announceBoosts,
      });
      setChannels((server.channels ?? []).filter((c) => c.type === "TEXT" || c.type === "ANNOUNCEMENT"));
      setBoost({ count: server.boostCount, level: server.boostLevel });
    });

  const loadAllowance = () =>
    api<{ boosts: { isStaff: boolean; solarPlus: boolean; available: number | null; max: number | null; resetAt: string } }>("/users/me/boosts")
      .then((r) => setAllowance(r.boosts))
      .catch(() => {});

  useEffect(() => {
    void load().finally(() => setLoaded(true));
    void loadAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api(`/servers/${serverId}`, {
        method: "PATCH",
        json: {
          name: form.name,
          description: form.description || null,
          visibility: form.visibility,
          category: form.category || null,
          iconUrl: form.iconUrl,
          bannerUrl: bannerUnlocked ? form.bannerUrl : null,
          tag: form.tag.trim() ? form.tag.trim().toUpperCase() : null,
          tagBadge: form.tagBadge,
          systemChannelId: form.systemChannelId || null,
          announceJoins: form.announceJoins,
          announceBoosts: form.announceBoosts,
        },
      });
      setMsg({ ok: true, text: "Saved." });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function doBoost() {
    setBoosting(true);
    setBoostErr(null);
    try {
      const { server } = await api<{ server: { boostCount: number; boostLevel: number } }>(`/servers/${serverId}/boost`, { method: "POST" });
      setBoost({ count: server.boostCount, level: server.boostLevel });
      await loadAllowance();
      onSaved();
    } catch (e) {
      setBoostErr(e instanceof ApiError ? e.message : "Couldn't boost right now.");
    } finally {
      setBoosting(false);
    }
  }

  if (!loaded) return <div className="p-5 text-sm text-muted">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Overview</h3>

      {/* Icon + banner */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">Server icon</label>
          <div className="mt-2">
            <ImageUpload value={form.iconUrl} shape="square" maxW={256} maxH={256} label="Upload icon" onChange={(v) => setForm({ ...form, iconUrl: v })} />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Server banner
            {!bannerUnlocked && <Icon name="ban" size={12} className="text-amber-400" />}
          </label>
          {bannerUnlocked ? (
            <div className="mt-2">
              <ImageUpload value={form.bannerUrl} shape="wide" maxW={1024} maxH={400} label="Upload banner" onChange={(v) => setForm({ ...form, bannerUrl: v })} />
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-line/15 p-3 text-xs text-muted">
              Unlocks at <span className="font-semibold text-amber-400">{BANNER_BOOST_REQUIREMENT} boosts</span> (Level 2). Currently {boost.count}.
            </p>
          )}
        </div>
      </div>

      {/* Boost status */}
      <div className="mt-4 rounded-2xl border border-line/10 bg-night-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Server Boost · Level {boost.level}</p>
            <p className="text-xs text-muted">
              {boost.count} boosts
              {allowance &&
                (allowance.isStaff
                  ? " · Staff: unlimited boosts"
                  : allowance.solarPlus
                    ? ` · You have ${allowance.available ?? 0}/${allowance.max ?? 0} Solar+ boosts left this week`
                    : " · Boosting is a Solar+ perk")}
            </p>
          </div>
          <button onClick={doBoost} disabled={boosting || !canBoost} title={!canBoost ? "No boosts available" : undefined} className="btn-solar text-sm disabled:opacity-50">
            {boosting ? "Boosting…" : "Boost server"}
          </button>
        </div>
        {boostErr && <p className="mt-2 text-xs text-solar-ember">{boostErr}</p>}
        <div className="mt-3 space-y-1">
          {BOOST_TIERS.map((t) => (
            <div key={t.level} className={clsx("flex items-center gap-2 text-xs", boost.count >= t.required ? "text-emerald-400" : "text-muted")}>
              <Icon name={boost.count >= t.required ? "compass" : "clock"} size={12} />
              Level {t.level} ({t.required} boosts) — {t.perk}
            </div>
          ))}
        </div>
      </div>

      {/* System messages */}
      <div className="mt-4 rounded-2xl border border-line/10 bg-night-900/40 p-4">
        <p className="text-sm font-semibold">System messages</p>
        <p className="mt-0.5 text-xs text-muted">Pick a channel for join &amp; boost announcements.</p>
        <select
          className="field mt-3"
          value={form.systemChannelId}
          onChange={(e) => setForm({ ...form, systemChannelId: e.target.value })}
        >
          <option value="">Off — don&apos;t post announcements</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              # {c.name}
            </option>
          ))}
        </select>
        {form.systemChannelId && (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Send a message when someone joins</span>
              <Toggle on={form.announceJoins} onClick={() => setForm({ ...form, announceJoins: !form.announceJoins })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Send a message when the server is boosted</span>
              <Toggle on={form.announceBoosts} onClick={() => setForm({ ...form, announceBoosts: !form.announceBoosts })} />
            </div>
          </div>
        )}
      </div>

      {/* Server tag */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">Server tag (max 6)</label>
          <input
            className="field mt-1 uppercase"
            maxLength={6}
            placeholder="e.g. SCCU"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">Tag badge</label>
          <div className="mt-1">
            <ImageUpload value={form.tagBadge} shape="square" maxW={48} maxH={48} format="image/png" label="Upload badge" onChange={(v) => setForm({ ...form, tagBadge: v })} />
          </div>
        </div>
      </div>

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Server name</label>
      <input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Description</label>
      <textarea
        className="field mt-1"
        rows={3}
        placeholder="Tell people what your server is about…"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Visibility</label>
      <div className="mt-2 space-y-2">
        {VISIBILITY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={clsx(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
              form.visibility === o.value ? "border-solar/50 bg-solar/10" : "border-line/10 hover:bg-night-700/40",
            )}
          >
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === o.value}
              onChange={() => setForm({ ...form, visibility: o.value })}
              className="mt-1 accent-solar"
            />
            <span>
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted">{o.description}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Category</label>
      <select
        className="field mt-1"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      >
        <option value="">No category</option>
        {DISCOVERY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-solar text-sm">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && <span className={clsx("text-sm", msg.ok ? "text-emerald-400" : "text-solar-ember")}>{msg.text}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────── Badges tab ───────────────────────────

const APPLICABLE: ServerBadgeType[] = ["VERIFIED", "SOLAR_PARTNER", "SAFE_COMMUNITY"];

interface BadgeApplicationRow {
  id: string;
  type: string;
  status: string;
  reason: string | null;
  reviewNote: string | null;
  createdAt: string;
}

function BadgesTab({ serverId, onChanged }: { serverId: string; onChanged: () => void }) {
  const [apps, setApps] = useState<BadgeApplicationRow[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [applyType, setApplyType] = useState<ServerBadgeType>("VERIFIED");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await api<{ applications: BadgeApplicationRow[]; badges: string[] }>(`/servers/${serverId}/badge-applications`);
    setApps(r.applications);
    setOwned(r.badges);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function apply() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/servers/${serverId}/badge-applications`, { method: "POST", json: { type: applyType, reason } });
      setReason("");
      setMsg({ ok: true, text: "Application submitted for review." });
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Failed to apply" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Badges</h3>

      {owned.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Active badges</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {owned.map((t) => {
              const info = SERVER_BADGE_INFO[t as ServerBadgeType];
              return (
                <span key={t} className="flex items-center gap-1.5 rounded-full bg-night-700/70 px-3 py-1 text-sm">
                  <BadgeChip type={t} /> {info?.label ?? t}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-night-900/40 p-4">
        <p className="text-sm font-semibold">Apply for a badge</p>
        <p className="mt-1 text-xs text-muted">SolarCord staff review every application.</p>
        <select className="field mt-3" value={applyType} onChange={(e) => setApplyType(e.target.value as ServerBadgeType)}>
          {APPLICABLE.map((t) => (
            <option key={t} value={t}>
              {SERVER_BADGE_INFO[t].label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">{SERVER_BADGE_INFO[applyType].description}</p>
        <textarea
          className="field mt-3"
          rows={3}
          placeholder="Tell us why your server qualifies (min 10 characters)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={apply} disabled={busy || reason.trim().length < 10} className="btn-solar text-sm">
            {busy ? "Submitting…" : "Submit application"}
          </button>
          {msg && <span className={clsx("text-sm", msg.ok ? "text-emerald-400" : "text-solar-ember")}>{msg.text}</span>}
        </div>
      </div>

      {apps.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Your applications</p>
          <div className="mt-2 space-y-1">
            {apps.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-night-800/40 px-3 py-2 text-sm">
                <BadgeChip type={a.type} />
                <span className="flex-1">{SERVER_BADGE_INFO[a.type as ServerBadgeType]?.label ?? a.type}</span>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    a.status === "APPROVED" && "bg-emerald-400/20 text-emerald-400",
                    a.status === "REJECTED" && "bg-solar-ember/20 text-solar-ember",
                    a.status === "PENDING" && "bg-amber-400/20 text-amber-400",
                  )}
                >
                  {a.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── AutoMod tab ───────────────────────────

function AutoModTab({ serverId }: { serverId: string }) {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ bannedWords: string[] }>(`/servers/${serverId}/automod`)
      .then((r) => setWords(r.bannedWords))
      .finally(() => setLoaded(true));
  }, [serverId]);

  async function persist(next: string[]) {
    setWords(next);
    await api(`/servers/${serverId}/automod`, { method: "PUT", json: { bannedWords: next } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const w = input.trim().toLowerCase();
    if (!w || words.includes(w)) return;
    setInput("");
    void persist([...words, w]);
  }

  if (!loaded) return <div className="p-5 text-sm text-muted">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">AutoMod</h3>
      <p className="mt-1 text-sm text-muted">
        Messages containing any blocked keyword (whole word, case-insensitive) are rejected automatically.
      </p>

      <form onSubmit={add} className="mt-4 flex max-w-md gap-2">
        <input className="field" placeholder="Add a blocked word…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-solar shrink-0 text-sm">Add</button>
        {saved && <span className="self-center text-xs text-emerald-400">Saved</span>}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {words.length === 0 && <p className="text-sm text-muted">No blocked words yet.</p>}
        {words.map((w) => (
          <span key={w} className="flex items-center gap-1.5 rounded-full bg-night-700/70 px-3 py-1 text-sm">
            {w}
            <button onClick={() => persist(words.filter((x) => x !== w))} className="text-muted hover:text-solar-ember" title="Remove">
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── Webhooks tab ───────────────────────────

interface WebhookRow {
  id: string;
  name: string;
  channelId: string;
  token: string;
}

function WebhooksTab({ serverId }: { serverId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string; type: string }[]>([]);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ webhooks: w }, { server }] = await Promise.all([
      api<{ webhooks: WebhookRow[] }>(`/servers/${serverId}/webhooks`),
      api<{ server: { channels: { id: string; name: string; type: string }[] } }>(`/servers/${serverId}`),
    ]);
    setWebhooks(w);
    const text = server.channels.filter((c) => c.type === "TEXT" || c.type === "ANNOUNCEMENT");
    setChannels(text);
    if (!channelId && text[0]) setChannelId(text[0].id);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  const urlFor = (w: WebhookRow) => `${API_URL}/webhooks/${w.id}/${w.token}`;

  async function create() {
    if (!name.trim() || !channelId) return;
    setBusy(true);
    try {
      await api(`/channels/${channelId}/webhooks`, { method: "POST", json: { name: name.trim() } });
      setName("");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function copy(w: WebhookRow) {
    await navigator.clipboard.writeText(urlFor(w)).catch(() => {});
    setCopied(w.id);
    setTimeout(() => setCopied(null), 1500);
  }
  async function remove(id: string) {
    await api(`/webhooks/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Webhooks</h3>
      <p className="mt-1 text-sm text-muted">
        Post messages into a channel from external services. Send a POST with {"{ content }"} to the URL.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl bg-night-900/40 p-4">
        <div className="min-w-[140px] flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Name</label>
          <input className="field mt-1" placeholder="GitHub bot" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Channel</label>
          <select className="field mt-1" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={create} disabled={busy || !name.trim()} className="btn-solar text-sm">
          Create
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {webhooks.length === 0 && <p className="text-sm text-muted">No webhooks yet.</p>}
        {webhooks.map((w) => {
          const channel = channels.find((c) => c.id === w.channelId);
          return (
            <div key={w.id} className="rounded-xl border border-line/5 bg-night-800/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{w.name}</span>
                <span className="text-xs text-muted">→ #{channel?.name ?? "channel"}</span>
                <button onClick={() => remove(w.id)} className="ml-auto text-xs text-muted hover:text-solar-ember">
                  Delete
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-night-900/60 p-1.5">
                <input readOnly value={urlFor(w)} className="flex-1 truncate bg-transparent px-2 text-xs text-muted outline-none" />
                <button onClick={() => copy(w)} className="btn-ghost py-1 text-xs">
                  {copied === w.id ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Bans tab ───────────────────────────

function BansTab({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { bans: b } = await api<{ bans: BanEntry[] }>(`/servers/${serverId}/bans`);
    setBans(b);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function unban(userId: string) {
    await api(`/servers/${serverId}/bans/${userId}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Bans — {bans.length}</h3>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : bans.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No one is banned from this server.</p>
      ) : (
        <div className="mt-4 space-y-1">
          {bans.map((b) => (
            <div key={b.user.id} className="flex items-center gap-3 rounded-xl border border-line/5 bg-night-800/40 p-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-night-700 text-xs font-bold">
                {initials(displayName(b.user))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName(b.user)}</p>
                <p className="truncate text-xs text-muted">{b.reason || "No reason given"}</p>
              </div>
              <button onClick={() => unban(b.user.id)} className="btn-ghost py-1.5 text-xs">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Audit log tab ───────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "channel.create": "created a channel",
  "message.delete": "deleted a message",
  "role.create": "created a role",
  "role.update": "updated a role",
  "role.delete": "deleted a role",
  "member.kick": "kicked a member",
  "member.ban": "banned a member",
  "member.unban": "unbanned a member",
  "member.timeout": "timed out a member",
  "member.timeout_remove": "removed a timeout",
};

function AuditTab({ serverId }: { serverId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ logs: AuditLogEntry[] }>(`/servers/${serverId}/audit-logs?limit=80`)
      .then((r) => setLogs(r.logs))
      .finally(() => setLoading(false));
  }, [serverId]);

  return (
    <div className="h-full overflow-y-auto p-5">
      <h3 className="font-bold">Audit Log</h3>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No actions recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-1">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-line/5 bg-night-800/40 px-3 py-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-[11px] font-bold text-night-900">
                {initials(displayName(l.actor))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-semibold">{displayName(l.actor)}</span>{" "}
                  <span className="text-muted">{ACTION_LABEL[l.action] ?? l.action}</span>
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">{formatTime(l.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-solar" : "bg-night-600")}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-night-900 transition-all",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}
