"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { initials, displayName, formatTime } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { Channel, Message } from "@/lib/types";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🔥", "😮", "😢", "👀"];

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
}: ChatPanelProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

          return (
            <div key={m.id} className="group relative flex gap-3 rounded-lg px-2 py-0.5 hover:bg-night-800/40">
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
                {(!grouped || m.replyTo) && <Avatar name={displayName(m.author)} src={m.author.avatarUrl} size={40} />}
              </div>

              <div className={clsx("min-w-0 flex-1", m.replyTo && "pt-5")}>
                {(!grouped || m.replyTo) && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{displayName(m.author)}</span>
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
                    {m.content}
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

      <div className="h-5 px-5 text-xs text-muted">
        {typingNames.length > 0 && (
          <span className="animate-fade-up">
            {typingNames.slice(0, 3).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </span>
        )}
      </div>

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
        className="px-4 pb-4"
      >
        <div className={clsx("glass flex items-end gap-2 px-4 py-3", replyTo ? "rounded-b-2xl" : "rounded-2xl")}>
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholderLabel ?? `Message #${channel.name}`}
            className="max-h-40 flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-muted"
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
