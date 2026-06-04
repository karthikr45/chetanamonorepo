"use client";

import { io, type Socket } from "socket.io-client";

/** API origin (no /api suffix) the socket.io server is mounted on. */
export function getSocketOrigin(): string {
  const base = (
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api"
  ).replace(/\/$/, "");
  return base.replace(/\/api$/, "");
}

// One shared connection for the whole app (the bell + the notifications page
// can both subscribe). Ref-counted so it closes on the last unmount / logout.
let socket: Socket | null = null;
let refCount = 0;

export function acquireNotificationsSocket(token: string): Socket {
  if (!socket) {
    socket = io(`${getSocketOrigin()}/notifications`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
  }
  refCount += 1;
  return socket;
}

export function releaseNotificationsSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}
