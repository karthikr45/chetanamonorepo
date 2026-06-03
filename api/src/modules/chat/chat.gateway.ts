import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

const room = (conversationId: string) => `conv:${conversationId}`;

/**
 * Realtime channel for chat: live message delivery + typing indicators.
 * Auth is the same JWT as REST, passed in the socket handshake
 * (`auth.token`). REST remains the source of truth / fallback poll.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ChatService))
    private readonly chat: ChatService,
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
      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.conversationId) return { ok: false };
    const ok = await this.chat.isParticipant(userId, body.conversationId);
    if (!ok) return { ok: false };
    await client.join(room(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    if (body?.conversationId) void client.leave(room(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.conversationId) return;
    // Only members who joined the room are in it; relay to everyone
    // else in the room.
    client.to(room(body.conversationId)).emit('peer-typing', {
      conversationId: body.conversationId,
      userId,
      isTyping: !!body.isTyping,
    });
  }

  private safeEmit(conversationId: string, event: string, payload: unknown) {
    try {
      this.server?.to(room(conversationId)).emit(event, payload);
    } catch (err) {
      this.logger.warn(
        `${event} emit failed: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  /** Called by ChatService after a message is persisted. */
  emitMessage(conversationId: string, message: unknown) {
    this.safeEmit(conversationId, 'message', message);
  }

  emitMessageUpdate(conversationId: string, message: unknown) {
    this.safeEmit(conversationId, 'message-updated', message);
  }

  emitMessageDelete(conversationId: string, message: unknown) {
    this.safeEmit(conversationId, 'message-deleted', message);
  }
}
