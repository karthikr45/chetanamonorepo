"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import {
  getChatSocketOrigin,
  getUnreadCountApi,
  listContactsApi,
  listConversationsApi,
  listMessagesApi,
  markReadApi,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  reactToMessageApi,
  startConversationApi,
  uploadAttachmentApi,
  type ChatContact,
  type ChatConversation,
  type ChatMessage,
  type MessageAttachment,
} from "@/features/chat/api/chat.api";

const POLL_MS = 5000;
const BRAND = "#6c739c";
const QUICK_EMOJI = ["👍", "❤️", "😆", "😮", "🙏"];

const AVATAR_GRADIENTS = [
  ["#6c739c", "#565c82"],
  ["#7c3aed", "#4c1d95"],
  ["#0891b2", "#155e75"],
  ["#db2777", "#9d174d"],
  ["#ea580c", "#9a3412"],
  ["#16a34a", "#14532d"],
];

function avatarOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
function initials(first?: string, last?: string) {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}
function fileSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function isImage(mime: string | null) {
  return !!mime && /^image\//i.test(mime);
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Avatar({
  id,
  first,
  last,
  size = 38,
}: {
  id: string;
  first?: string;
  last?: string;
  size?: number;
}) {
  const [a, b] = avatarOf(id);
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
      }}
    >
      {initials(first, last)}
    </div>
  );
}

export function ChatPageContent() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTools = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverId(id);
  };
  const hideToolsSoon = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverId(null), 160);
  };
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeConvRef = useRef<string | null>(null);
  const typingSentRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeConvRef.current = activeConvId;

  const addFiles = (fl: FileList | null) => {
    if (!fl?.length) return;
    setPendingFiles((p) => [...p, ...Array.from(fl)].slice(0, 10));
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cs, convs] = await Promise.all([
        listContactsApi(),
        listConversationsApi(),
      ]);
      setContacts(cs);
      setConversations(convs);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load chat"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await listMessagesApi(convId, { limit: 100 });
      setMessages(msgs);
      const last = msgs[msgs.length - 1];
      if (last) await markReadApi(convId, last.id).catch(() => undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load messages"));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const tick = async () => {
      try {
        await getUnreadCountApi();
        setConversations(await listConversationsApi());
        if (activeConvId) {
          const msgs = await listMessagesApi(activeConvId, { limit: 100 });
          setMessages(msgs);
          const last = msgs[msgs.length - 1];
          if (last)
            await markReadApi(activeConvId, last.id).catch(() => undefined);
        }
      } catch {
        /* swallow polling errors */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeConvId]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // ── Realtime: connect once, live messages + typing ──
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const socket = io(`${getChatSocketOrigin()}/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("message", (msg: ChatMessage) => {
      if (msg.conversationId === activeConvRef.current) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        );
        markReadApi(msg.conversationId, msg.id).catch(() => undefined);
      }
      listConversationsApi().then(setConversations).catch(() => undefined);
    });

    const replace = (msg: ChatMessage) => {
      if (msg.conversationId === activeConvRef.current) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
        );
      }
      listConversationsApi().then(setConversations).catch(() => undefined);
    };
    socket.on("message-updated", replace);
    socket.on("message-deleted", replace);

    socket.on(
      "peer-typing",
      (p: { conversationId: string; userId: string; isTyping: boolean }) => {
        if (
          p.conversationId !== activeConvRef.current ||
          p.userId === user?.id
        )
          return;
        setPeerTyping(p.isTyping);
        if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
        if (p.isTyping)
          peerTypingTimer.current = setTimeout(
            () => setPeerTyping(false),
            4000,
          );
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join / leave the active conversation room.
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !activeConvId) return;
    const join = () => s.emit("join", { conversationId: activeConvId });
    join();
    s.on("connect", join);
    return () => {
      s.emit("leave", { conversationId: activeConvId });
      s.off("connect", join);
    };
  }, [activeConvId]);

  function emitTyping() {
    const s = socketRef.current;
    if (!s || !activeConvId) return;
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      s.emit("typing", { conversationId: activeConvId, isTyping: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingSentRef.current = false;
      s.emit("typing", { conversationId: activeConvId, isTyping: false });
    }, 1800);
  }

  async function openConversationWith(peer: ChatContact) {
    setActivePeer(peer);
    setReplyTo(null);
    setPendingFiles([]);
    setPeerTyping(false);
    setMenuId(null);
    try {
      const conv = await startConversationApi(peer.adminId);
      setActiveConvId(conv.id);
      await loadMessages(conv.id);
      setConversations(await listConversationsApi());
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start conversation"));
    }
  }

  function openExistingConv(c: ChatConversation) {
    setActivePeer(c.peer);
    setActiveConvId(c.conversationId);
    setReplyTo(null);
    setPendingFiles([]);
    setPeerTyping(false);
    setMenuId(null);
    loadMessages(c.conversationId);
  }

  async function send() {
    if (!activeConvId) return;
    const text = draft.trim();

    // Edit mode — patch the existing message instead of sending new.
    if (editing) {
      if (!text) return;
      setSending(true);
      try {
        const updated = await editMessageApi(
          activeConvId,
          editing.id,
          text,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
        );
        setEditing(null);
        setDraft("");
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not edit message"));
      } finally {
        setSending(false);
      }
      return;
    }

    if (!text && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const attachments: MessageAttachment[] = [];
      for (const f of pendingFiles) {
        attachments.push(await uploadAttachmentApi(activeConvId, f));
      }
      const msg = await sendMessageApi(activeConvId, {
        body: text || undefined,
        replyToId: replyTo?.id ?? null,
        attachments: attachments.length ? attachments : null,
      });
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      setDraft("");
      setReplyTo(null);
      setPendingFiles([]);
      setConversations(await listConversationsApi());
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send message"));
    } finally {
      setSending(false);
    }
  }

  function startReply(m: ChatMessage) {
    setMenuId(null);
    setEditing(null);
    setReplyTo(m);
  }

  function startEdit(m: ChatMessage) {
    setMenuId(null);
    setReplyTo(null);
    setEditing(m);
    setDraft(m.body);
  }

  async function copyMessage(m: ChatMessage) {
    setMenuId(null);
    try {
      await navigator.clipboard.writeText(m.body ?? "");
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  async function react(m: ChatMessage, emoji: string) {
    setMenuId(null);
    if (!activeConvId) return;
    const me = user?.id ?? "";
    // Optimistic single-reaction-per-user toggle.
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const next: Record<string, string[]> = {};
        const had = (x.reactions?.[emoji] ?? []).includes(me);
        for (const [k, arr] of Object.entries(x.reactions ?? {})) {
          const f = arr.filter((u) => u !== me);
          if (f.length) next[k] = f;
        }
        if (!had) next[emoji] = [...(next[emoji] ?? []), me];
        return { ...x, reactions: next };
      }),
    );
    try {
      const updated = await reactToMessageApi(activeConvId, m.id, emoji);
      setMessages((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not react"));
    }
  }

  async function removeMessage(m: ChatMessage) {
    setMenuId(null);
    if (!activeConvId) return;
    if (!confirm("Delete this message for everyone?")) return;
    try {
      const del = await deleteMessageApi(activeConvId, m.id);
      setMessages((prev) =>
        prev.map((x) => (x.id === del.id ? { ...x, ...del } : x)),
      );
      if (editing?.id === m.id) {
        setEditing(null);
        setDraft("");
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete message"));
    }
  }

  function cancelCompose() {
    setEditing(null);
    setReplyTo(null);
    setDraft("");
  }

  function scrollToMessage(id: string) {
    document
      .getElementById(`msg-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.firstName, c.lastName, c.email, c.tenantName ?? "", c.role]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [contacts, search]);

  const conversationContactIds = new Set(
    conversations.map((c) => c.peer.adminId),
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 max-w-[1500px] mx-auto">
      {/* ── Left rail ── */}
      <aside
        className="w-[330px] flex flex-col rounded-2xl bg-white overflow-hidden"
        style={{
          border: "1px solid rgba(15,23,42,0.07)",
          boxShadow: "0 10px 30px -16px rgba(15,23,42,0.18)",
        }}
      >
        <div
          className="px-5 py-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${BRAND}, #3a3c5e)`,
          }}
        >
          <h2 className="text-base font-bold">Messages</h2>
          <p className="text-[11px] text-blue-100/80 mt-0.5">
            {isSuperAdmin
              ? "Reach anyone across schools"
              : "Your team & super-admins"}
          </p>
        </div>

        <div className="px-3 py-2.5 border-b border-slate-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            />
          </div>
        </div>

        {error && (
          <div className="m-3 p-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 && (
            <>
              <RailLabel>Recent</RailLabel>
              {conversations.map((c) => {
                const isActive = activeConvId === c.conversationId;
                return (
                  <button
                    key={c.conversationId}
                    onClick={() => openExistingConv(c)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      isActive ? "bg-[#f7ece9]/70" : "hover:bg-slate-50"
                    }`}
                    style={
                      isActive
                        ? { boxShadow: `inset 3px 0 0 ${BRAND}` }
                        : undefined
                    }
                  >
                    <Avatar
                      id={c.peer.adminId}
                      first={c.peer.firstName}
                      last={c.peer.lastName}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {c.peer.firstName} {c.peer.lastName}
                        </p>
                        {c.lastMessageAt && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {new Date(c.lastMessageAt).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11.5px] text-slate-500 truncate">
                          {isSuperAdmin && c.peer.tenantName
                            ? `${c.peer.tenantName} · `
                            : ""}
                          {c.lastMessagePreview ?? "Start chatting"}
                        </p>
                        {c.unreadCount > 0 && (
                          <span
                            className="text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full flex-shrink-0"
                            style={{ background: BRAND }}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          <RailLabel>
            {conversations.length > 0 ? "Start new chat" : "Contacts"}
            {!loading && (
              <span className="ml-2 text-slate-400/70 normal-case font-normal">
                ({contacts.length})
              </span>
            )}
          </RailLabel>
          {loading ? (
            <p className="px-4 py-3 text-xs text-slate-500">Loading…</p>
          ) : filteredContacts.filter(
              (c) => !conversationContactIds.has(c.adminId),
            ).length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              {search ? `No matches for "${search}".` : "No new contacts."}
            </p>
          ) : (
            filteredContacts
              .filter((c) => !conversationContactIds.has(c.adminId))
              .map((c) => (
                <button
                  key={c.adminId}
                  onClick={() => openConversationWith(c)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <Avatar
                    id={c.adminId}
                    first={c.firstName}
                    last={c.lastName}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      <span className="uppercase tracking-[0.04em] font-bold text-slate-400">
                        {c.role.replace("_", " ")}
                      </span>
                      {(isSuperAdmin || c.role === "super_admin") &&
                      c.tenantName
                        ? ` · ${c.tenantName}`
                        : ""}
                    </p>
                  </div>
                </button>
              ))
          )}
        </div>
      </aside>

      {/* ── Thread ── */}
      <section
        className="flex-1 flex flex-col rounded-2xl bg-white overflow-hidden relative"
        style={{
          border: "1px solid rgba(15,23,42,0.07)",
          boxShadow: "0 10px 30px -16px rgba(15,23,42,0.18)",
        }}
        onDragOver={(e) => {
          if (activeConvId) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (activeConvId) addFiles(e.dataTransfer.files);
        }}
      >
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
            <div className="text-center">
              <div
                className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl"
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, #3a3c5e)`,
                }}
              >
                💬
              </div>
              <p className="font-semibold text-slate-700">Your messages</p>
              <p className="text-slate-400 mt-1">
                Pick someone on the left to start a conversation.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              {activePeer && (
                <Avatar
                  id={activePeer.adminId}
                  first={activePeer.firstName}
                  last={activePeer.lastName}
                  size={42}
                />
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {activePeer?.firstName} {activePeer?.lastName}
                </h2>
                {peerTyping ? (
                  <p
                    className="text-[11px] font-semibold truncate animate-pulse"
                    style={{ color: BRAND }}
                  >
                    typing…
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 truncate">
                    <span className="uppercase tracking-[0.04em] font-bold text-slate-400">
                      {activePeer?.role?.replace("_", " ")}
                    </span>
                    {activePeer?.tenantName
                      ? ` · ${activePeer.tenantName}`
                      : ""}{" "}
                    · {activePeer?.email}
                  </p>
                )}
              </div>
            </header>

            {dragOver && (
              <div
                className="absolute inset-0 z-20 flex items-center justify-center text-sm font-semibold"
                style={{
                  background: "rgba(108,115,156,0.08)",
                  border: `2px dashed ${BRAND}`,
                  color: BRAND,
                }}
              >
                Drop a file to attach
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4"
              style={{
                background:
                  "linear-gradient(180deg,#f8fafc,#f1f5f9)",
              }}
            >
              {messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 mt-12">
                  No messages yet. Say hi 👋
                </p>
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === user?.id;
                  const prev = messages[i - 1];
                  const sameSender =
                    prev && prev.senderId === m.senderId;
                  const showDay =
                    !prev ||
                    new Date(prev.createdAt).toDateString() !==
                      new Date(m.createdAt).toDateString();
                  const replyName = m.replyTo
                    ? m.replyTo.senderId === user?.id
                      ? "You"
                      : activePeer?.firstName ?? "Them"
                    : "";
                  return (
                    <div key={m.id} id={`msg-${m.id}`}>
                      {showDay && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`group flex items-end gap-2 ${
                          mine ? "justify-end" : "justify-start"
                        } ${sameSender && !showDay ? "mt-1" : "mt-3"}`}
                      >
                        {!mine &&
                          activePeer &&
                          (!sameSender || showDay ? (
                            <Avatar
                              id={activePeer.adminId}
                              first={activePeer.firstName}
                              last={activePeer.lastName}
                              size={28}
                            />
                          ) : (
                            <div className="w-7 flex-shrink-0" />
                          ))}

                        <div
                          onMouseEnter={() => showTools(m.id)}
                          onMouseLeave={hideToolsSoon}
                          className="relative max-w-[68%] rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-sm"
                          style={
                            m.deleted
                              ? {
                                  background: mine ? "#565c8222" : "#f1f5f9",
                                  color: "#64748b",
                                  border: "1px dashed #cbd5e1",
                                }
                              : mine
                                ? {
                                    background: `linear-gradient(135deg, ${BRAND}, #565c82)`,
                                    color: "#fff",
                                    borderBottomRightRadius: 4,
                                  }
                                : {
                                    background: "#fff",
                                    color: "#0f172a",
                                    border: "1px solid #e2e8f0",
                                    borderBottomLeftRadius: 4,
                                  }
                          }
                        >
                          {/* Teams-style reaction + actions bar — floats
                              ABOVE the bubble. Wrapper has bottom padding
                              so there is NO dead gap between bubble and
                              bar (the cursor path stays hoverable). */}
                          {!m.deleted &&
                            (hoverId === m.id || menuId === m.id) && (
                            <div
                              onMouseEnter={() => showTools(m.id)}
                              onMouseLeave={hideToolsSoon}
                              className={`absolute bottom-full pb-2 ${
                                mine ? "right-0" : "left-0"
                              } z-30 flex`}
                            >
                            <div
                              className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 shadow-lg ring-1 ring-slate-200"
                            >
                              {QUICK_EMOJI.map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  title={`React ${em}`}
                                  onClick={() => react(m, em)}
                                  className="h-7 w-7 flex items-center justify-center rounded-full text-[15px] hover:bg-slate-100 hover:scale-110 transition-transform"
                                >
                                  {em}
                                </button>
                              ))}
                              <span className="mx-0.5 h-4 w-px bg-slate-200" />
                              <button
                                type="button"
                                aria-label="More options"
                                onClick={() =>
                                  setMenuId(menuId === m.id ? null : m.id)
                                }
                                className="h-7 w-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#6c739c]"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>

                              {menuId === m.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setMenuId(null)}
                                  />
                                  <div
                                    className={`absolute top-full mt-1 ${
                                      mine ? "right-0" : "left-0"
                                    } z-30 w-44 rounded-xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200 overflow-hidden`}
                                  >
                                    <MenuRow
                                      icon="reply"
                                      label="Reply"
                                      onClick={() => startReply(m)}
                                    />
                                    {m.body && (
                                      <MenuRow
                                        icon="copy"
                                        label="Copy"
                                        onClick={() => copyMessage(m)}
                                      />
                                    )}
                                    {mine && (
                                      <>
                                        <MenuRow
                                          icon="edit"
                                          label="Edit"
                                          onClick={() => startEdit(m)}
                                        />
                                        <div className="my-1 h-px bg-slate-100" />
                                        <MenuRow
                                          icon="trash"
                                          label="Delete"
                                          danger
                                          onClick={() => removeMessage(m)}
                                        />
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            </div>
                          )}

                          {m.deleted ? (
                            <div className="flex items-center gap-1.5 italic">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M5.6 5.6l12.8 12.8" strokeLinecap="round" />
                              </svg>
                              This message was deleted
                            </div>
                          ) : (
                            <>
                              {m.replyTo && (
                                <button
                                  onClick={() => scrollToMessage(m.replyTo!.id)}
                                  className="block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg"
                                  style={{
                                    background: mine
                                      ? "rgba(255,255,255,0.14)"
                                      : "#f1f5f9",
                                    borderLeft: `3px solid ${
                                      mine ? "#f0dad5" : BRAND
                                    }`,
                                  }}
                                >
                                  <span
                                    className={`block text-[11px] font-bold ${
                                      mine ? "text-blue-100" : ""
                                    }`}
                                    style={
                                      mine ? undefined : { color: BRAND }
                                    }
                                  >
                                    {replyName}
                                  </span>
                                  <span
                                    className={`block text-[12px] truncate ${
                                      mine
                                        ? "text-blue-100/90"
                                        : "text-slate-500"
                                    } ${m.replyTo.deleted ? "italic" : ""}`}
                                  >
                                    {m.replyTo.deleted
                                      ? "Message deleted"
                                      : m.replyTo.body
                                        ? m.replyTo.body.slice(0, 100)
                                        : `📎 ${
                                            m.replyTo.attachmentName ??
                                            "Attachment"
                                          }`}
                                  </span>
                                </button>
                              )}

                              {(m.attachments ?? []).length > 0 && (
                                <div className="mb-1 flex flex-col gap-1.5">
                                  {m.attachments.map((at, ai) =>
                                    isImage(at.mime) ? (
                                      <a
                                        key={ai}
                                        href={at.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={at.url}
                                          alt={at.name}
                                          className="rounded-xl max-h-64 object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        key={ai}
                                        href={at.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
                                        style={{
                                          background: mine
                                            ? "rgba(255,255,255,0.15)"
                                            : "#f8fafc",
                                          border: mine
                                            ? "none"
                                            : "1px solid #e2e8f0",
                                        }}
                                      >
                                        <span className="text-lg">📄</span>
                                        <span className="min-w-0">
                                          <span className="block text-[13px] font-semibold truncate">
                                            {at.name}
                                          </span>
                                          <span
                                            className={`block text-[11px] ${
                                              mine
                                                ? "text-blue-100"
                                                : "text-slate-500"
                                            }`}
                                          >
                                            {fileSize(at.size)} · Download
                                          </span>
                                        </span>
                                      </a>
                                    ),
                                  )}
                                </div>
                              )}

                              {m.body && (
                                <div className="whitespace-pre-wrap break-words">
                                  {m.body}
                                </div>
                              )}
                            </>
                          )}

                          <div
                            className={`flex items-center gap-1 text-[10px] mt-1 ${
                              m.deleted
                                ? "text-slate-400"
                                : mine
                                  ? "text-blue-100"
                                  : "text-slate-400"
                            }`}
                          >
                            {!m.deleted && m.editedAt && (
                              <span className="italic">edited ·</span>
                            )}
                            {new Date(m.createdAt).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>

                          {!m.deleted &&
                            Object.keys(m.reactions ?? {}).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(m.reactions).map(
                                  ([em, users]) => {
                                    if (!users.length) return null;
                                    const reacted = users.includes(
                                      user?.id ?? "",
                                    );
                                    return (
                                      <button
                                        key={em}
                                        type="button"
                                        onClick={() => react(m, em)}
                                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-none transition-colors"
                                        style={{
                                          background: reacted
                                            ? mine
                                              ? "rgba(255,255,255,0.28)"
                                              : "#e7e9f3"
                                            : mine
                                              ? "rgba(255,255,255,0.14)"
                                              : "#f1f5f9",
                                          border: reacted
                                            ? `1px solid ${mine ? "rgba(255,255,255,0.5)" : BRAND}`
                                            : "1px solid transparent",
                                          color: mine ? "#fff" : "#475569",
                                        }}
                                      >
                                        <span>{em}</span>
                                        <span className="font-semibold">
                                          {users.length}
                                        </span>
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply / edit / attachment preview strip */}
            {(replyTo || editing || pendingFiles.length > 0) && (
              <div className="px-4 pt-2.5 space-y-2">
                {editing && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
                    style={{
                      background: "#fbeee9",
                      borderLeft: "3px solid #d9a69f",
                    }}
                  >
                    <span className="flex-1 min-w-0 truncate text-slate-600">
                      <span className="font-bold text-[#c98c84]">
                        Editing message
                      </span>{" "}
                      · {editing.body.slice(0, 100)}
                    </span>
                    <button
                      onClick={cancelCompose}
                      className="text-slate-400 hover:text-slate-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {replyTo && !editing && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
                    style={{
                      background: "#f1f5f9",
                      borderLeft: `3px solid ${BRAND}`,
                    }}
                  >
                    <span className="flex-1 min-w-0 truncate text-slate-600">
                      <span className="font-bold" style={{ color: BRAND }}>
                        Replying to{" "}
                        {replyTo.senderId === user?.id
                          ? "yourself"
                          : activePeer?.firstName ?? "message"}
                      </span>{" "}
                      ·{" "}
                      {replyTo.body
                        ? replyTo.body.slice(0, 100)
                        : `📎 ${
                            replyTo.attachments?.[0]?.name ?? "attachment"
                          }`}
                    </span>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="text-slate-400 hover:text-slate-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] bg-[#f7ece9] border border-[#e7c9c2]"
                      >
                        <span className="text-base">📎</span>
                        <span className="max-w-[160px] truncate text-slate-700 font-medium">
                          {f.name}
                        </span>
                        <span className="text-slate-500">
                          {fileSize(f.size)}
                        </span>
                        <button
                          onClick={() =>
                            setPendingFiles((p) =>
                              p.filter((_, idx) => idx !== i),
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="px-4 py-3 flex items-end gap-2"
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!!editing}
                onClick={() => fileRef.current?.click()}
                title={editing ? "Finish editing first" : "Attach a file"}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#6c739c] disabled:opacity-40"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  emitTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  editing
                    ? "Edit your message…"
                    : "Type a message…  (Shift+Enter for a new line)"
                }
                className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20 max-h-32"
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  (editing
                    ? !draft.trim()
                    : !draft.trim() && pendingFiles.length === 0)
                }
                className="h-10 px-5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                style={{
                  background: editing
                    ? "linear-gradient(135deg,#d9a69f,#c98c84)"
                    : `linear-gradient(135deg, ${BRAND}, #565c82)`,
                }}
              >
                {sending ? "…" : editing ? "Save" : "Send"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">
      {children}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: "reply" | "copy" | "edit" | "trash";
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-2 text-[13px] font-medium transition-colors ${
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="text-slate-400">
        {icon === "reply" && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        )}
        {icon === "copy" && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {icon === "edit" && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
        {icon === "trash" && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
