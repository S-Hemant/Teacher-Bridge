import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class VoiceNotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(VoiceNotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth as { token?: string })?.token ??
        (client.handshake.query?.token as string | undefined);
      const token =
        typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : '';
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      await client.join(`user:${payload.sub}`);
    } catch (e) {
      this.logger.warn(`WS auth failed: ${e instanceof Error ? e.message : e}`);
      client.disconnect(true);
    }
  }

  notifyVoiceQueryComplete(
    userId: string,
    voiceQueryId: string,
    status: 'done' | 'failed',
  ) {
    this.server.to(`user:${userId}`).emit('voiceQuery.completed', {
      voiceQueryId,
      status,
    });
  }
}
