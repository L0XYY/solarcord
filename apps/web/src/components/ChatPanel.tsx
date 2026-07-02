"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { initials, displayName, formatTime } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { ServerTag } from "./ServerTag";
import type { Channel, Message } from "@/lib/types";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🔥", "😮", "😢", "👀"];

export interface Mentionable {
  id: string;
  username: string;
  displayName: string | null;
  color?: string;
}

// @everyone, @here, or @username (usernames are [a-z0-9_.]).
const MENTION_RE = /@everyone\b|@here\b|@([a-z0-9_.]+)/gi;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Does this message ping the given user (directly, or via @everyone/@here)?
function messagePingsUser(content: string, username?: string): boolean {
  if (/@everyone\b|@here\b/i.test(content)) return true;
  if (username && new RegExp(`@${escapeRe(username)}\\b`, "i").test(content)) return true;
  return false;
}

interface ChatPanelProps {
  channel: Channel | null;
  messages: Message[];
  typingNames: string[];
  currentUserId: string;
  canManageMessages: boolean;
  enableReactions?: boolean;
  placeholderLabel?: string;
  onSend: (content: string, replyToId?: string) => Promise<void>;
  onTyping: () => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string, mine: boolean) => void;
  onReport?: (messageId: string) => void;
  onMobileBack?: () => void;
  onSelectUser?: (userId: string) => void;
  onStartCall?: () => void;
  roleMeta?: Map<string, RoleMeta>;
  mentionables?: Mentionable[];
}

export interface RoleMeta {
  color?: string;
  icons: { iconUrl: string; name: string }[];
}

export function ChatPanel({
  channel,
  messages,
  typingNames,
  currentUserId,
  canManageMessages,
  enableReactions = true,
  placeholderLabel,
  onSend,
  onTyping,
  onEdit,
  onDelete,
  onToggleReaction,
  onReport,
  onMobileBack,
  onSelectUser,
  onStartCall,
  roleMeta,
  mentionables,
}: ChatPanelProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // username (lowercase) → mentionable, for rendering @mentions as pills.
  const mentionMap = useMemo(() => new Map((mentionables ?? []).map((u) => [u.username.toLowerCase(), u])), [mentionables]);
  const myUsername = useMemo(() => mentionables?.find((u) => u.id === currentUserId)?.username, [mentionables, currentUserId]);

  // Autocomplete suggestions for the @token currently being typed.
  const suggestions = useMemo(() => {
    if (!mention || !mentionables) return [] as { kind: "everyone" | "here" | "user"; user?: Mentionable }[];
    const q = mention.query.toLowerCase();
    const out: { kind: "everyone" | "here" | "user"; user?: Mentionable }[] = [];
    if ("everyone".startsWith(q)) out.push({ kind: "everyone" });
    if ("here".startsWith(q)) out.push({ kind: "here" });
    for (const u of mentionables) {
      if (out.length > 9) break;
      if (u.username.toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q)) out.push({ kind: "user", user: u });
    }
    return out.slice(0, 8);
  }, [mention, mentionables]);

  // Render message text with @everyone/@here and @username highlighted.
  function renderContent(text: string) {
    const nodes: React.ReactNode[] = [];
    const re = new RegExp(MENTION_RE);
    let last = 0;
    let key = 0;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) !== null) {
      if (mm.index > last) nodes.push(text.slice(last, mm.index));
      const token = mm[0];
      if (/^@everyone$/i.test(token) || /^@here$/i.test(token)) {
        nodes.push(
          <span key={key++} className="rounded bg-solar/20 px-1 font-medium text-solar">
            {token}
          </span>,
        );
      } else {
        const u = mm[1] ? mentionMap.get(mm[1].toLowerCase()) : undefined;
        if (u) {
          nodes.push(
            <button
              key={key++}
              onClick={() => onSelectUser?.(u.id)}
              className="rounded px-1 font-medium hover:underline"
              style={{ color: u.color ?? "rgb(var(--aurora))", background: `${u.color ?? "#b8b8b8"}22` }}
            >
              @{u.displayName ?? u.username}
            </button>,
          );
        } else {
          nodes.push(token);
        }
      }
      last = mm.index + token.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }

  function applyMention(insert: string) {
    if (!mention) return;
    const after = value.slice(mention.start + 1 + mention.query.length);
    const head = `${value.slice(0, mention.start)}@${insert} `;
    setValue(head + after);
    setMention(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const pos = head.length;
        el.setSelectionRange(pos, pos);
      }
    });
  }

  function pickSuggestion(s: { kind: "everyone" | "here" | "user"; user?: Mentionable }) {
    applyMention(s.kind === "user" ? s.user!.username : s.kind);
  }

  function onComposerChange(el: HTMLTextAreaElement) {
    setValue(el.value);
    onTyping();
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret);
    const match = /(^|\s)@([a-z0-9_.]*)$/i.exec(before);
    if (match && mentionables) {
      setMention({ start: caret - match[2].length - 1, query: match[2] });
      setMentionIdx(0);
    } else {
      setMention(null);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, channel?.id]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  async function submit() {
    const content = value.trim();
    if (!content || sending) return;
    setSending(true);
    setValue("");
    const rid = replyTo?.id;
    setReplyTo(null);
    try {
      await onSend(content, rid);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const content = editing.content.trim();
    const id = editing.id;
    setEditing(null);
    if (content) await onEdit(id, content);
  }

  if (!channel) {
    return (
      <section className="grid flex-1 place-items-center text-muted">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-solar/30 to-aurora/30" />
          <p>Select a channel to start chatting.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-night-900/30">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line/5 px-4">
        {onMobileBack && (
          <button onClick={onMobileBack} className="-ml-1 mr-1 grid place-items-center text-muted hover:text-ink md:hidden" aria-label="Back" title="Back">
            <Icon name="chevronLeft" size={20} />
          </button>
        )}
        {enableReactions ? <Icon name="hash" size={18} className="text-muted" /> : <span className="text-base text-muted">@</span>}
        <h1 className="font-bold">{channel.name}</h1>
        {channel.topic && (
          <>
            <span className="mx-2 h-4 w-px bg-line/10" />
            <p className="truncate text-sm text-muted">{channel.topic}</p>
          </>
        )}
        {onStartCall && (
          <button
            onClick={onStartCall}
            title="Start voice call"
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-emerald-400"
          >
            <Icon name="volume" size={18} />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-0.5 overflow-y-auto px-4 py-4">
        <div className="mb-6 px-2">
          <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-solar to-solar-glow text-2xl font-black text-night-900 shadow-glow">
            {enableReactions ? "#" : initials(channel.name)}
          </div>
          <h2 className="text-2xl font-extrabold">
            {enableReactions ? `Welcome to #${channel.name}` : channel.name}
          </h2>
          <p className="text-muted">
            {enableReactions
              ? "This is the start of the channel."
              : "This is the beginning of your conversation."}
          </p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped =
            !m.replyTo &&
            prev &&
            prev.author.id === m.author.id &&
            !prev.replyTo &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          const mine = m.author.id === currentUserId;
          const isEditing = editing?.id === m.id;
          const meta = roleMeta?.get(m.author.id);
          const pingsMe = !mine && messagePingsUser(m.content, myUsername);

          return (
            <div
              key={m.id}
              className={clsx(
                "group relative flex animate-msg gap-3 rounded-lg py-0.5 hover:bg-night-800/40",
                pingsMe ? "border-l-2 border-solar bg-solar/[0.07] pl-[14px] pr-2" : "px-2",
              )}
            >
              {/* Reply preview line */}
              {m.replyTo && (
                <div className="absolute -top-0.5 left-14 flex items-center gap-1 text-xs text-muted">
                  <span className="opacity-50">↳</span>
                  <span className="font-medium text-aurora">
                    {m.replyTo.author.displayName ?? m.replyTo.author.username}
                  </span>
                  <span className="max-w-md truncate opacity-80">{m.replyTo.content}</span>
                </div>
              )}

              <div className={clsx("w-10 shrink-0", m.replyTo && "pt-5")}>
                {(!grouped || m.replyTo) && (
                  <button onClick={() => onSelectUser?.(m.author.id)} className="transition hover:opacity-80" title={displayName(m.author)}>
                    <Avatar name={displayName(m.author)} src={m.author.avatarUrl} size={40} />
                  </button>
                )}
              </div>

              <div className={clsx("min-w-0 flex-1", m.replyTo && "pt-5")}>
                {(!grouped || m.replyTo) && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold" style={meta?.color ? { color: meta.color } : undefined}>
                      {displayName(m.author)}
                    </span>
                    {meta?.icons.map((ic) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={ic.name}
                        src={ic.iconUrl}
                        alt={ic.name}
                        title={ic.name}
                        className="h-4 w-4 translate-y-px rounded-sm object-contain"
                      />
                    ))}
                    {m.author.tag && <ServerTag tag={m.author.tag} badge={m.author.tagBadge} className="ml-0.5 translate-y-px" />}
                    {m.isWebhook && (
                      <span className="rounded bg-aurora/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-aurora">
                        App
                      </span>
                    )}
                    <span className="text-xs text-muted">{formatTime(m.createdAt)}</span>
                  </div>
                )}

                {isEditing ? (
                  <div className="my-1">
                    <textarea
                      autoFocus
                      value={editing.content}
                      onChange={(e) => setEditing({ id: m.id, content: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void saveEdit();
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="field py-2 text-sm"
                      rows={2}
                    />
                    <p className="mt-1 text-xs text-muted">
                      escape to{" "}
                      <button className="text-solar hover:underline" onClick={() => setEditing(null)}>
                        cancel
                      </button>{" "}
                      · enter to{" "}
                      <button className="text-solar hover:underline" onClick={() => void saveEdit()}>
                        save
                      </button>
                    </p>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/90">
                    {renderContent(m.content)}
                    {m.editedAt && <span className="ml-1 text-[10px] text-muted">(edited)</span>}
                  </p>
                )}

                {/* Reactions */}
                {enableReactions && m.reactions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.reactions.map((r) => {
                      const mineR = r.userIds.includes(currentUserId);
                      return (
                        <button
                          key={r.emoji}
                          onClick={() => onToggleReaction(m.id, r.emoji, mineR)}
                          className={clsx(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                            mineR
                              ? "border-solar/50 bg-solar/15 text-solar"
                              : "border-line/10 bg-night-700/50 text-muted hover:border-line/20",
                          )}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hover actions */}
              {!isEditing && (
                <div className="absolute -top-3 right-3 hidden items-center gap-0.5 rounded-lg glass-strong p-0.5 shadow-glass group-hover:flex">
                  {enableReactions && (
                  <div className="relative">
                    <ActionBtn title="React" onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                      <Icon name="smile" size={16} />
                    </ActionBtn>
                    {pickerFor === m.id && (
                      <div className="absolute right-0 top-9 z-10 flex gap-1 rounded-xl glass-strong p-2 shadow-glass">
                        {QUICK_EMOJI.map((e) => (
                          <button
                            key={e}
                            className="rounded-lg px-1.5 py-1 text-lg hover:bg-night-700"
                            onClick={() => {
                              const existing = m.reactions.find((r) => r.emoji === e);
                              onToggleReaction(m.id, e, existing?.userIds.includes(currentUserId) ?? false);
                              setPickerFor(null);
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                  <ActionBtn title="Reply" onClick={() => setReplyTo(m)}>
                    <Icon name="reply" size={16} />
                  </ActionBtn>
                  {mine && (
                    <ActionBtn title="Edit" onClick={() => setEditing({ id: m.id, content: m.content })}>
                      <Icon name="pencil" size={15} />
                    </ActionBtn>
                  )}
                  {!mine && onReport && (
                    <ActionBtn title="Report" onClick={() => onReport(m.id)}>
                      <Icon name="flag" size={15} />
                    </ActionBtn>
                  )}
                  {(mine || canManageMessages) && (
                    <ActionBtn title="Delete" danger onClick={() => void onDelete(m.id)}>
                      <Icon name="trash" size={15} />
                    </ActionBtn>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {typingNames.length > 0 && (
        <div className="animate-fade-up px-5 pb-1 text-xs text-muted">
          {typingNames.slice(0, 3).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
        </div>
      )}

      {/* Replying-to banner */}
      {replyTo && (
        <div className="mx-4 flex items-center justify-between rounded-t-xl border border-b-0 border-line/10 bg-night-800/70 px-4 py-1.5 text-xs text-muted">
          <span>
            Replying to <span className="font-semibold text-aurora">{displayName(replyTo.author)}</span>
          </span>
          <button onClick={() => setReplyTo(null)} className="grid place-items-center hover:text-solar-ember" title="Cancel reply">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="relative px-4 pb-4 pt-1"
      >
        {/* @mention autocomplete */}
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 overflow-hidden rounded-xl border border-line/10 bg-night-800/95 py-1 shadow-glass backdrop-blur-xl">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Members</p>
            {suggestions.map((s, i) => (
              <button
                key={s.kind === "user" ? s.user!.id : s.kind}
                type="button"
                onMouseEnter={() => setMentionIdx(i)}
                onClick={() => pickSuggestion(s)}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                  i === mentionIdx ? "bg-line/10 text-ink" : "text-muted hover:bg-night-700/60",
                )}
              >
                {s.kind === "user" ? (
                  <>
                    <Avatar name={s.user!.displayName ?? s.user!.username} src={null} size={20} />
                    <span className="font-medium" style={s.user!.color ? { color: s.user!.color } : undefined}>
                      {s.user!.displayName ?? s.user!.username}
                    </span>
                    <span className="text-xs text-muted">@{s.user!.username}</span>
                  </>
                ) : (
                  <>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-solar/20 text-[10px] font-bold text-solar">@</span>
                    <span className="font-medium text-solar">@{s.kind}</span>
                    <span className="text-xs text-muted">{s.kind === "everyone" ? "Notify everyone here" : "Notify online members"}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        <div className={clsx("glass flex items-center gap-2 px-4 py-2", replyTo ? "rounded-b-2xl" : "rounded-2xl")}>
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(e) => onComposerChange(e.currentTarget)}
            onKeyDown={(e) => {
              if (mention && suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIdx((i) => (i + 1) % suggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pickSuggestion(suggestions[mentionIdx]!);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholderLabel ?? `Message #${channel.name}`}
            className="block max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-sm leading-5 text-ink outline-none placeholder:text-muted"
          />
          <button disabled={!value.trim() || sending} className="btn-solar grid h-9 w-9 place-items-center rounded-xl p-0" title="Send">
            <Icon name="send" size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

function ActionBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        "grid h-8 w-8 place-items-center rounded-md text-sm transition hover:bg-night-700",
        danger ? "text-muted hover:text-solar-ember" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
