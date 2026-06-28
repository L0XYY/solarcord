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
  cameraOn: boolean;
  screenOn: boolean;
  videoTick: number;
  channelOccupants: Record<string, VoicePeer[]>; // who's in each voice channel (server-wide)
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
  cameraOn: false,
  screenOn: false,
  videoTick: 0,
  channelOccupants: {},
  connecting: false,
  error: null,
}));

export function setChannelOccupants(channelId: string, users: VoicePeer[]) {
  useVoice.setState((s) => ({ channelOccupants: { ...s.channelOccupants, [channelId]: users } }));
}

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  polite: boolean;
}
const pcs = new Map<string, PeerEntry>();
const audios = new Map<string, HTMLAudioElement>();
let localStream: MediaStream | null = null; // mic
let localVideoStream: MediaStream | null = null; // camera or screen
const remoteVideos = new Map<string, MediaStream>(); // socketId -> remote video stream
let currentRoom: string | null = null;

type SignalPayload = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

export function getLocalVideo(): MediaStream | null {
  return localVideoStream;
}
export function getRemoteVideo(socketId: string): MediaStream | null {
  return remoteVideos.get(socketId) ?? null;
}
function bumpVideo() {
  useVoice.setState((s) => ({ videoTick: s.videoTick + 1 }));
}

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

// ── peer connections (perfect negotiation, supports adding video later) ──
function createPc(socketId: string): PeerEntry {
  const existing = pcs.get(socketId);
  if (existing) return existing;
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const mySocket = getSocket();
  const entry: PeerEntry = { pc, makingOffer: false, polite: (mySocket?.id ?? "") < socketId };
  pcs.set(socketId, entry);

  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream!));
  if (localVideoStream) localVideoStream.getTracks().forEach((t) => pc.addTrack(t, localVideoStream!));

  pc.onicecandidate = (e) => {
    if (e.candidate) getSocket()?.emit("voice:signal", { to: socketId, signal: { candidate: e.candidate.toJSON() } });
  };
  pc.onnegotiationneeded = async () => {
    try {
      entry.makingOffer = true;
      await pc.setLocalDescription();
      getSocket()?.emit("voice:signal", { to: socketId, signal: { description: pc.localDescription! } });
    } catch {
      /* ignore */
    } finally {
      entry.makingOffer = false;
    }
  };
  pc.ontrack = (e) => {
    const stream = e.streams[0]!;
    if (e.track.kind === "audio") {
      attachAudio(socketId, stream);
    } else {
      remoteVideos.set(socketId, stream);
      bumpVideo();
      e.track.onended = () => {
        remoteVideos.delete(socketId);
        bumpVideo();
      };
      e.track.onmute = () => {
        remoteVideos.delete(socketId);
        bumpVideo();
      };
      e.track.onunmute = () => {
        remoteVideos.set(socketId, stream);
        bumpVideo();
      };
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(socketId);
  };
  return entry;
}

async function handleSignal(from: string, raw: unknown) {
  const signal = raw as SignalPayload;
  const entry = pcs.get(from) ?? createPc(from);
  const pc = entry.pc;
  try {
    if (signal.description) {
      const offerCollision = signal.description.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
      if (!entry.polite && offerCollision) return; // ignore — we win the glare
      await pc.setRemoteDescription(signal.description);
      if (signal.description.type === "offer") {
        await pc.setLocalDescription();
        getSocket()?.emit("voice:signal", { to: from, signal: { description: pc.localDescription! } });
      }
    } else if (signal.candidate) {
      await pc.addIceCandidate(signal.candidate).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

function removePeer(socketId: string) {
  pcs.get(socketId)?.pc.close();
  pcs.delete(socketId);
  removeVad(socketId);
  remoteVideos.delete(socketId);
  bumpVideo();
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
    createPc(p.socketId); // both sides create; perfect negotiation handles offers
  }
};
const onJoined = (d: { roomId: string; peer: VoicePeer }) => {
  if (d.roomId !== currentRoom) return;
  addMember(d.peer);
  createPc(d.peer.socketId);
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
  pcs.forEach((e) => e.pc.close());
  pcs.clear();
  audios.forEach((el) => {
    el.srcObject = null;
    el.remove();
  });
  audios.clear();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  localVideoStream?.getTracks().forEach((t) => t.stop());
  localVideoStream = null;
  remoteVideos.clear();
  currentRoom = null;
  stopVad();
  useVoice.setState({
    roomId: null,
    label: null,
    kind: null,
    members: {},
    connecting: false,
    selfSpeaking: false,
    cameraOn: false,
    screenOn: false,
  });
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

// ── video (camera + screen share) ──
function attachVideoToPeers() {
  if (!localVideoStream) return;
  const stream = localVideoStream;
  pcs.forEach(({ pc }) => {
    stream.getTracks().forEach((t) => {
      if (!pc.getSenders().some((s) => s.track === t)) pc.addTrack(t, stream);
    });
  });
}

export async function stopVideo() {
  if (localVideoStream) {
    const tracks = localVideoStream.getTracks();
    pcs.forEach(({ pc }) => {
      pc.getSenders().forEach((s) => {
        if (s.track && tracks.includes(s.track)) pc.removeTrack(s);
      });
    });
    tracks.forEach((t) => t.stop());
    localVideoStream = null;
  }
  useVoice.setState({ cameraOn: false, screenOn: false });
  bumpVideo();
}

export async function startCamera() {
  if (!currentRoom) return;
  await stopVideo();
  try {
    localVideoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  } catch {
    return;
  }
  attachVideoToPeers();
  useVoice.setState({ cameraOn: true, screenOn: false });
  bumpVideo();
}

export async function startScreenShare() {
  if (!currentRoom) return;
  await stopVideo();
  try {
    localVideoStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return;
  }
  localVideoStream.getVideoTracks()[0]?.addEventListener("ended", () => void stopVideo());
  attachVideoToPeers();
  useVoice.setState({ cameraOn: false, screenOn: true });
  bumpVideo();
}

export function toggleCamera() {
  if (useVoice.getState().cameraOn) void stopVideo();
  else void startCamera();
}
export function toggleScreenShare() {
  if (useVoice.getState().screenOn) void stopVideo();
  else void startScreenShare();
}
