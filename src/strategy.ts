import {
  CustomTransportStrategy,
  IncomingRequest,
  RmqContext,
  RmqOptions,
  ServerRMQ,
} from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  isNil,
  isString,
  isUndefined,
} from '@nestjs/common/utils/shared.utils';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
export class RmqStrategy extends ServerRMQ implements CustomTransportStrategy {
  constructor(readonly options: RmqOptions['options']) {
    super(options);
  }
  public async handleMessage(
    message: Record<string, any>,
    channel: any,
  ): Promise<void> {
    if (isNil(message)) {
      return;
    }
    const { content, properties } = message;

    let rawMessage: any;
    let errorMessage: Record<string, unknown>;
    try {
      //console.log('content== ', content.toString('utf-8'));

      rawMessage = JSON.parse(content.toString());
      const { mgs_pattern, ...other } = rawMessage;

      if (mgs_pattern != 'st_email_queue' || mgs_pattern != 'st_sms_queue') {
        rawMessage = {
          ...{ error: 'pattern error' },
          ...{ body: other },
        };
      }
      console.log(rawMessage);
    } catch (error) {
      errorMessage = {
        ...{ error: error.message },
        ...{ body: content.toString('utf-8') },
      };
      rawMessage = JSON.parse(JSON.stringify(errorMessage));
      console.log(rawMessage);
    }

    const packet = await this.deserializer.deserialize(rawMessage);
    const pattern = isString(packet.pattern)
      ? packet.pattern
      : JSON.stringify(packet.pattern);

    const rmqContext = new RmqContext([message, channel, pattern]);
    if (isUndefined((packet as IncomingRequest).id)) {
      return this.handleEvent(pattern, packet, rmqContext);
    }
    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      const status = 'error';
      const noHandlerPacket = {
        id: (packet as IncomingRequest).id,
        err: NO_MESSAGE_HANDLER,
        status,
      };
      return this.sendMessage(
        noHandlerPacket,
        properties.replyTo,
        properties.correlationId,
      );
    }
    const response$ = this.transformToObservable(
      await handler(packet.data, rmqContext),
    ) as Observable<any>;

    const publish = <T>(data: T) =>
      this.sendMessage(data, properties.replyTo, properties.correlationId);

    response$ && this.send(response$, publish);
  }
}
