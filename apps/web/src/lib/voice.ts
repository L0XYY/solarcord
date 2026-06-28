"use client";
import { create } from "zustand";
import { getSocket } from "./socket";
import type { VoicePeer } from "@solarcord/shared";

export interface VoiceMember extends VoicePeer {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

interface VoiceState {
  roomId: string | null;
  label: string | null;
  kind: "channel" | "dm" | null;
  members: Record<string, VoiceMember>; // remote peers keyed by socketId
  muted: boolean;
  deafened: boolean;
  selfSpeaking: boolean;
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
  selfSpeaking: false,
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
  useVoice.setState((s) => ({ members: { ...s.members, [p.socketId]: { ...p, muted: false, deafened: false, speaking: false } } }));
}
function dropMember(socketId: string) {
  useVoice.setState((s) => {
    const next = { ...s.members };
    delete next[socketId];
    return { members: next };
  });
}
function setMemberStateByUser(userId: string, muted: boolean, deafened: boolean) {
  useVoice.setState((s) => {
    const next = { ...s.members };
    for (const id of Object.keys(next)) if (next[id]!.userId === userId) next[id] = { ...next[id]!, muted, deafened };
    return { members: next };
  });
}

// ── voice activity detection (speaking rings) ──
let audioCtx: AudioContext | null = null;
interface Vad {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  src: MediaStreamAudioSourceNode;
}
const analysers = new Map<string, Vad>(); // "self" or socketId
const speakingHold = new Map<string, number>();
let vadTimer: ReturnType<typeof setInterval> | null = null;
const SPEAK_THRESHOLD = 0.045;

function addVad(key: string, stream: MediaStream) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analysers.set(key, { analyser, src, data: new Uint8Array(new ArrayBuffer(analyser.fftSize)) });
  } catch {
    /* ignore */
  }
}
function removeVad(key: string) {
  const v = analysers.get(key);
  if (v) {
    try {
      v.src.disconnect();
    } catch {
      /* ignore */
    }
    analysers.delete(key);
  }
  speakingHold.delete(key);
}
function levelOf(v: Vad): number {
  v.analyser.getByteTimeDomainData(v.data);
  let sum = 0;
  for (let i = 0; i < v.data.length; i++) {
    const x = (v.data[i]! - 128) / 128;
    sum += x * x;
  }
  return Math.sqrt(sum / v.data.length);
}
function startVad() {
  if (vadTimer) return;
  vadTimer = setInterval(() => {
    const now = Date.now();
    const state = useVoice.getState();
    // self
    const selfV = analysers.get("self");
    let selfSpeaking = state.selfSpeaking;
    if (selfV && !state.muted) {
      if (levelOf(selfV) > SPEAK_THRESHOLD) speakingHold.set("self", now + 280);
      selfSpeaking = (speakingHold.get("self") ?? 0) > now;
    } else selfSpeaking = false;
    if (selfSpeaking !== state.selfSpeaking) useVoice.setState({ selfSpeaking });

    // members
    let changed = false;
    const next = { ...state.members };
    for (const id of Object.keys(next)) {
      const v = analysers.get(id);
      let sp = false;
      if (v) {
        if (levelOf(v) > SPEAK_THRESHOLD) speakingHold.set(id, now + 280);
        sp = (speakingHold.get(id) ?? 0) > now;
      }
      if (next[id]!.speaking !== sp) {
        next[id] = { ...next[id]!, speaking: sp };
        changed = true;
      }
    }
    if (changed) useVoice.setState({ members: next });
  }, 120);
}
function stopVad() {
  if (vadTimer) clearInterval(vadTimer);
  vadTimer = null;
  analysers.forEach((_, k) => removeVad(k));
  analysers.clear();
  speakingHold.clear();
  void audioCtx?.close();
  audioCtx = null;
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
  addVad(socketId, stream);
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
  removeVad(socketId);
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
const onState = (d: { roomId: string; userId: string; muted: boolean; deafened: boolean }) => {
  if (d.roomId !== currentRoom) return;
  setMemberStateByUser(d.userId, d.muted, d.deafened);
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
    if (typeof window !== "undefined") {
      window.alert("Couldn't access your microphone. Allow mic access in your browser, then try joining again.");
    }
    return;
  }
  currentRoom = roomId;
  const muted = useVoice.getState().muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  addVad("self", localStream);
  startVad();
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
  stopVad();
  useVoice.setState({ roomId: null, label: null, kind: null, members: {}, connecting: false, selfSpeaking: false });
}

export function ringDM(conversationId: string) {
  getSocket()?.emit("voice:call", { conversationId });
}

export function toggleMute() {
  const muted = !useVoice.getState().muted;
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  useVoice.setState({ muted });
  if (currentRoom) getSocket()?.emit("voice:state", { roomId: currentRoom, muted, deafened: useVoice.getState().deafened });
}

export function toggleDeafen() {
  const deafened = !useVoice.getState().deafened;
  audios.forEach((el) => (el.muted = deafened));
  const muted = deafened ? true : useVoice.getState().muted;
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  useVoice.setState({ deafened, muted });
  if (currentRoom) getSocket()?.emit("voice:state", { roomId: currentRoom, muted, deafened });
}
