"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth, type SelfUser } from "@/lib/store";
import { statusColor } from "@/lib/ui";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { ImageUpload } from "./ImageUpload";
import { ProfileCardView, type ProfileViewData } from "./ProfileCard";

type Tab = "profile" | "appearance";

const STATUSES: { value: string; label: string }[] = [
  { value: "ONLINE", label: "Online" },
  { value: "IDLE", label: "Idle" },
  { value: "DND", label: "Do not disturb" },
  { value: "INVISIBLE", label: "Invisible" },
];

export function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const { user, accessToken, setAuth } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-night-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="m-auto flex h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl glass-strong shadow-glass" onClick={(e) => e.stopPropagation()}>
        <div className="w-48 shrink-0 border-r border-line/10 bg-night-900/30 p-4">
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted">User settings</p>
          <nav className="mt-3 space-y-1">
            {(["profile", "appearance"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "w-full rounded-lg px-3 py-2 text-left text-sm font-medium capitalize transition",
                  tab === t ? "bg-line/10 text-ink" : "text-muted hover:bg-night-700/60 hover:text-ink",
                )}
              >
                {t === "profile" ? "My profile" : "Appearance"}
              </button>
            ))}
          </nav>
          <button onClick={onClose} className="btn-ghost mt-6 w-full text-sm">
            Done
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {tab === "profile" ? (
            <ProfileTab user={user} accessToken={accessToken} onSaved={(u) => setAuth(accessToken!, u)} />
          ) : (
            <AppearanceTab />
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, accessToken, onSaved }: { user: SelfUser; accessToken: string | null; onSaved: (u: SelfUser) => void }) {
  const [form, setForm] = useState({
    displayName: user.displayName ?? "",
    pronouns: user.pronouns ?? "",
    bio: user.bio ?? "",
    customStatus: user.customStatus ?? "",
    avatarUrl: user.avatarUrl ?? "",
    bannerUrl: user.bannerUrl ?? "",
    status: user.status,
    themePrimary: user.themePrimary ?? "",
    themeAccent: user.themeAccent ?? "",
    tag: user.tag ?? "",
    tagBadge: user.tagBadge ?? "",
  });
  const [taggedServers, setTaggedServers] = useState<{ id: string; name: string; tag: string; tagBadge: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Servers (the user is in) that have a tag to rep.
  useEffect(() => {
    api<{ servers: { id: string; name: string; tag: string | null; tagBadge: string | null }[] }>("/servers")
      .then((r) => setTaggedServers(r.servers.filter((s) => s.tag).map((s) => ({ id: s.id, name: s.name, tag: s.tag!, tagBadge: s.tagBadge }))))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const { user: updated } = await api<{ user: SelfUser }>("/users/me", {
        method: "PATCH",
        json: {
          displayName: form.displayName || null,
          pronouns: form.pronouns || null,
          bio: form.bio || null,
          customStatus: form.customStatus || null,
          avatarUrl: form.avatarUrl || null,
          bannerUrl: form.bannerUrl || null,
          status: form.status,
          themePrimary: form.themePrimary || null,
          themeAccent: form.themeAccent || null,
          tag: form.tag || null,
          tagBadge: form.tagBadge || null,
        },
      });
      onSaved(updated);
      setMsg({ ok: true, text: "Profile saved." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  const preview: ProfileViewData = {
    username: user.username,
    displayName: form.displayName || null,
    avatarUrl: form.avatarUrl || null,
    bannerUrl: form.bannerUrl || null,
    bio: form.bio || null,
    pronouns: form.pronouns || null,
    status: form.status,
    isStaff: user.isStaff,
    themePrimary: form.themePrimary || null,
    themeAccent: form.themeAccent || null,
    tag: form.tag || null,
    tagBadge: form.tagBadge || null,
    badges: [],
  };

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
      {/* Editor */}
      <div>
        <Field label="Display name">
          <input className="field" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder={user.username} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pronouns">
            <input className="field" value={form.pronouns} onChange={(e) => set("pronouns", e.target.value)} placeholder="they/them" />
          </Field>
          <Field label="Custom status">
            <input className="field" value={form.customStatus} onChange={(e) => set("customStatus", e.target.value)} placeholder="What are you up to?" />
          </Field>
        </div>
        <Field label="About me">
          <textarea className="field" rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Tell people about yourself…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Avatar">
            <ImageUpload value={form.avatarUrl || null} shape="circle" maxW={256} maxH={256} label="Upload avatar" onChange={(v) => set("avatarUrl", v ?? "")} />
          </Field>
          <Field label="Banner">
            <ImageUpload value={form.bannerUrl || null} shape="wide" maxW={1024} maxH={400} label="Upload banner" onChange={(v) => set("bannerUrl", v ?? "")} />
          </Field>
        </div>

        <Field label="Profile theme">
          <div className="flex gap-4">
            <ColorField label="Primary" value={form.themePrimary} onChange={(v) => set("themePrimary", v)} />
            <ColorField label="Accent" value={form.themeAccent} onChange={(v) => set("themeAccent", v)} />
            {(form.themePrimary || form.themeAccent) && (
              <button
                onClick={() => setForm((f) => ({ ...f, themePrimary: "", themeAccent: "" }))}
                className="self-end text-xs text-muted hover:text-solar-ember"
              >
                Reset theme
              </button>
            )}
          </div>
        </Field>

        <Field label="Server tag">
          <p className="-mt-0.5 mb-1.5 text-xs text-muted">Choose a server tag to rep next to your name.</p>
          <select
            className="field"
            value={form.tag ? `${form.tag}|${form.tagBadge ?? ""}` : ""}
            onChange={(e) => {
              if (!e.target.value) return setForm((f) => ({ ...f, tag: "", tagBadge: "" }));
              const picked = taggedServers.find((s) => `${s.tag}|${s.tagBadge ?? ""}` === e.target.value);
              if (picked) setForm((f) => ({ ...f, tag: picked.tag, tagBadge: picked.tagBadge ?? "" }));
            }}
          >
            <option value="">No tag</option>
            {taggedServers.map((s) => (
              <option key={s.id} value={`${s.tag}|${s.tagBadge ?? ""}`}>
                {s.tag} — {s.name}
              </option>
            ))}
            {form.tag && !taggedServers.some((s) => s.tag === form.tag) && (
              <option value={`${form.tag}|${form.tagBadge ?? ""}`}>{form.tag} (current)</option>
            )}
          </select>
        </Field>

        <Field label="Status">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => set("status", s.value)}
                className={clsx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  form.status === s.value ? "border-line/25 bg-line/10 text-ink" : "border-line/10 text-muted hover:bg-night-700/50",
                )}
              >
                <span className={clsx("h-2.5 w-2.5 rounded-full", statusColor(s.value))} />
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-solar text-sm">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {msg && <span className={clsx("text-sm", msg.ok ? "text-emerald-400" : "text-solar-ember")}>{msg.text}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Preview</p>
        <ProfileCardView data={preview} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="color"
        value={value || "#5865f2"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 cursor-pointer rounded-lg border border-line/15 bg-transparent"
      />
    </div>
  );
}

function AppearanceTab() {
  const [theme, setT] = useState<Theme>(getTheme());
  function choose(t: Theme) {
    setTheme(t);
    setT(t);
  }
  return (
    <div className="p-6">
      <h3 className="font-bold">Appearance</h3>
      <p className="mt-1 text-sm text-muted">Choose how SolarCord looks. The glass theme adapts to both.</p>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {(["dark", "light"] as Theme[]).map((t) => (
          <button
            key={t}
            onClick={() => choose(t)}
            className={clsx(
              "overflow-hidden rounded-2xl border-2 text-left transition",
              theme === t ? "border-line/40" : "border-line/10 hover:border-line/20",
            )}
          >
            <div className={clsx("h-24", t === "dark" ? "bg-[#0c0c0e]" : "bg-[#f2f2f5]")}>
              <div className="flex h-full items-center justify-center gap-2">
                <span className={clsx("h-8 w-8 rounded-xl", t === "dark" ? "bg-white/90" : "bg-black/85")} />
                <span className={clsx("h-8 w-16 rounded-xl", t === "dark" ? "bg-white/15" : "bg-black/10")} />
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold capitalize">{t}</span>
              {theme === t && <span className="text-xs text-muted">Active</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">{label}</label>
      {children}
    </div>
  );
}
