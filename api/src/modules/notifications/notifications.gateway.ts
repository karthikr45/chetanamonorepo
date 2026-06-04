import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Notification } from './entities/notification.entity';

const userRoom = (userId: string) => `user:${userId}`;
const roleRoom = (tenantId: string | null, role: string) =>
  `tenant:${tenantId ?? 'none'}:role:${role}`;
const tenantRoom = (tenantId: string | null) => `tenant:${tenantId ?? 'none'}`;

/**
 * Realtime delivery for in-app notifications. Auth is the same JWT as REST,
 * passed in the socket handshake (`auth.token`). On connect each client joins
 * three rooms so the server can fan a notification to exactly the right
 * audience — the targeted user, a whole role within a tenant, or everyone in
 * a tenant. REST polling remains the fallback.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('no token');
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      const userId = payload.sub as string;
      const role = payload.role as string;
      const tenantId = (payload.tenantId as string | null) ?? null;
      void client.join(userRoom(userId));
      void client.join(roleRoom(tenantId, role));
      void client.join(tenantRoom(tenantId));
    } catch {
      client.disconnect(true);
    }
  }

  /** Called by NotificationsService after a notification is persisted. */
  emitNotification(n: Notification): void {
    try {
      const target = n.recipientId
        ? userRoom(n.recipientId)
        : n.recipientRole
          ? roleRoom(n.tenantId, n.recipientRole)
          : tenantRoom(n.tenantId);
      this.server?.to(target).emit('notification:new', n);
    } catch (err) {
      this.logger.warn(
        `notification emit failed: ${(err as Error)?.message ?? err}`,
      );
    }
  }
}
