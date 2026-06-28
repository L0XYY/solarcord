"use client";
import { create } from "zustand";
import { getSocket } from "./socket";
import type { VoicePeer } from "@solarcord/shared";

export interface VoiceMember extends VoicePeer {
  muted: boolean;
}

interface VoiceState {
  roomId: string | null;
  label: string | null;
  kind: "channel" | "dm" | null;
  members: Record<string, VoiceMember>; // remote peers keyed by socketId
  muted: boolean;
  deafened: boolean;
  connecting: boolean;
  error: string | null;
}

export const useVoice = create<VoiceState>(() => ({
  roomId: null,
  label: null,
  kind: null,
  members: {},
  muted: false,
  deafened: false,
  connecting: false,
  error: null,
}));

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const pcs = new Map<string, RTCPeerConnection>();
const audios = new Map<string, HTMLAudioElement>();
let localStream: MediaStream | null = null;
let currentRoom: string | null = null;

type SignalPayload = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

// ── store helpers ──
function addMember(p: VoicePeer) {
  useVoice.setState((s) => ({ members: { ...s.members, [p.socketId]: { ...p, muted: false } } }));
}
function dropMember(socketId: string) {
  useVoice.setState((s) => {
    const next = { ...s.members };
    delete next[socketId];
    return { members: next };
  });
}
function setMemberMutedByUser(userId: string, muted: boolean) {
  useVoice.setState((s) => {
    const next = { ...s.members };
    for (const id of Object.keys(next)) if (next[id]!.userId === userId) next[id] = { ...next[id]!, muted };
    return { members: next };
  });
}

// ── audio ──
function attachAudio(socketId: string, stream: MediaStream) {
  let el = audios.get(socketId);
  if (!el) {
    el = document.createElement("audio");
    el.autoplay = true;
    el.setAttribute("playsinline", "");
    document.body.appendChild(el);
    audios.set(socketId, el);
  }
  el.srcObject = stream;
  el.muted = useVoice.getState().deafened;
  void el.play().catch(() => {});
}

// ── peer connections ──
function createPc(socketId: string, initiator: boolean): RTCPeerConnection {
  const existing = pcs.get(socketId);
  if (existing) return existing;
  const pc = new RTCPeerConnection({ iceServers: ICE });
  pcs.set(socketId, pc);
  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream!));
  pc.onicecandidate = (e) => {
    if (e.candidate) getSocket()?.emit("voice:signal", { to: socketId, signal: { ice: e.candidate.toJSON() } });
  };
  pc.ontrack = (e) => attachAudio(socketId, e.streams[0]!);
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(socketId);
  };
  if (initiator) {
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .then(() => getSocket()?.emit("voice:signal", { to: socketId, signal: { sdp: pc.localDescription! } }))
      .catch(() => {});
  }
  return pc;
}

async function handleSignal(from: string, raw: unknown) {
  const signal = raw as SignalPayload;
  let pc = pcs.get(from);
  if (signal.sdp) {
    if (!pc) pc = createPc(from, false);
    await pc.setRemoteDescription(signal.sdp);
    if (signal.sdp.type === "offer") {
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      getSocket()?.emit("voice:signal", { to: from, signal: { sdp: pc.localDescription! } });
    }
  } else if (signal.ice && pc) {
    await pc.addIceCandidate(signal.ice).catch(() => {});
  }
}

function removePeer(socketId: string) {
  pcs.get(socketId)?.close();
  pcs.delete(socketId);
  const el = audios.get(socketId);
  if (el) {
    el.srcObject = null;
    el.remove();
    audios.delete(socketId);
  }
  dropMember(socketId);
}

// ── socket listeners ──
const onPeers = (d: { roomId: string; peers: VoicePeer[] }) => {
  if (d.roomId !== currentRoom) return;
  for (const p of d.peers) {
    addMember(p);
    createPc(p.socketId, true); // newcomer initiates to everyone already here
  }
};
const onJoined = (d: { roomId: string; peer: VoicePeer }) => {
  if (d.roomId !== currentRoom) return;
  addMember(d.peer); // they will send us an offer
};
const onLeft = (d: { roomId: string; socketId: string }) => {
  if (d.roomId !== currentRoom) return;
  removePeer(d.socketId);
};
const onSignal = (d: { from: string; signal: unknown }) => void handleSignal(d.from, d.signal);
const onState = (d: { roomId: string; userId: string; muted: boolean }) => {
  if (d.roomId !== currentRoom) return;
  setMemberMutedByUser(d.userId, d.muted);
};

function attachListeners() {
  const s = getSocket();
  if (!s) return;
  s.on("voice:peers", onPeers);
  s.on("voice:peer-joined", onJoined);
  s.on("voice:peer-left", onLeft);
  s.on("voice:signal", onSignal);
  s.on("voice:state", onState);
}
function detachListeners() {
  const s = getSocket();
  if (!s) return;
  s.off("voice:peers", onPeers);
  s.off("voice:peer-joined", onJoined);
  s.off("voice:peer-left", onLeft);
  s.off("voice:signal", onSignal);
  s.off("voice:state", onState);
}

// ── public API ──
export async function joinVoice(roomId: string, label: string, kind: "channel" | "dm") {
  const socket = getSocket();
  if (!socket) return;
  if (currentRoom === roomId) return;
  if (currentRoom) await leaveVoice();

  useVoice.setState({ connecting: true, error: null, roomId, label, kind, members: {} });
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    useVoice.setState({ connecting: false, roomId: null, label: null, kind: null, error: "Microphone access denied" });
    return;
  }
  currentRoom = roomId;
  const muted = useVoice.getState().muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  attachListeners();
  socket.emit("voice:join", { roomId });
  useVoice.setState({ connecting: false });
}

export async function leaveVoice() {
  const socket = getSocket();
  if (currentRoom && socket) socket.emit("voice:leave", { roomId: currentRoom });
  detachListeners();
  pcs.forEach((pc) => pc.close());
  pcs.clear();
  audios.forEach((el) => {
    el.srcObject = null;
    el.remove();
  });
  audios.clear();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  currentRoom = null;
  useVoice.setState({ roomId: null, label: null, kind: null, members: {}, connecting: false });
}

export function ringDM(conversationId: string) {
  getSocket()?.emit("voice:call", { conversationId });
}

export function toggleMute() {
  const muted = !useVoice.getState().muted;
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  useVoice.setState({ muted });
  if (currentRoom) getSocket()?.emit("voice:state", { roomId: currentRoom, muted });
}

export function toggleDeafen() {
  const deafened = !useVoice.getState().deafened;
  audios.forEach((el) => (el.muted = deafened));
  const muted = deafened ? true : useVoice.getState().muted;
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  useVoice.setState({ deafened, muted });
  if (currentRoom) getSocket()?.emit("voice:state", { roomId: currentRoom, muted });
}
