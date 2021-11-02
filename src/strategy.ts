import {
  isNil,
  isString,
  isUndefined,
} from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';

const RQM_DEFAULT_URL = 'amqp://localhost';
const CONNECT_EVENT = 'connect';
const DISCONNECT_EVENT = 'disconnect';
const NO_MESSAGE_HANDLER = `There is no matching message handler defined in the remote service.`;
const RQM_DEFAULT_QUEUE = 'default';
const RQM_DEFAULT_PREFETCH_COUNT = 0;
const RQM_DEFAULT_IS_GLOBAL_PREFETCH_COUNT = false;
const RQM_DEFAULT_NOACK = true;
const RQM_DEFAULT_QUEUE_OPTIONS = {};
const DISCONNECTED_RMQ_MESSAGE = `Disconnected from RMQ. Trying to reconnect.`;

import { RmqContext } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { RmqUrl } from '@nestjs/microservices/external/rmq-url.interface';
import { CustomTransportStrategy, RmqOptions } from '@nestjs/microservices';
import { IncomingRequest, OutgoingResponse } from '@nestjs/microservices';
import { RmqRecordSerializer } from '@nestjs/microservices/serializers/rmq-record.serializer';
import { Server } from '@nestjs/microservices';

let rqmPackage: any = {};

export class ServerRMQ extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.RMQ;

  protected server: any = null;
  protected channel: any = null;
  protected readonly urls: string[] | RmqUrl[];
  protected readonly queue: string;
  protected readonly prefetchCount: number;
  protected readonly queueOptions: any;
  protected readonly isGlobalPrefetchCount: boolean;

  constructor(readonly options: RmqOptions['options']) {
    super();
    this.urls = this.getOptionsProp(this.options, 'urls') || [RQM_DEFAULT_URL];
    this.queue =
      this.getOptionsProp(this.options, 'queue') || RQM_DEFAULT_QUEUE;
    this.prefetchCount =
      this.getOptionsProp(this.options, 'prefetchCount') ||
      RQM_DEFAULT_PREFETCH_COUNT;
    this.isGlobalPrefetchCount =
      this.getOptionsProp(this.options, 'isGlobalPrefetchCount') ||
      RQM_DEFAULT_IS_GLOBAL_PREFETCH_COUNT;
    this.queueOptions =
      this.getOptionsProp(this.options, 'queueOptions') ||
      RQM_DEFAULT_QUEUE_OPTIONS;

    this.loadPackage('amqplib', ServerRMQ.name, () => require('amqplib'));
    rqmPackage = this.loadPackage(
      'amqp-connection-manager',
      ServerRMQ.name,
      () => require('amqp-connection-manager'),
    );

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ): Promise<void> {
    try {
      await this.start(callback);
    } catch (err) {
      callback(err);
    }
  }

  public close(): void {
    this.channel && this.channel.close();
    this.server && this.server.close();
  }

  public async start(callback?: () => void) {
    this.server = this.createClient();
    this.server.on(CONNECT_EVENT, () => {
      if (this.channel) {
        return;
      }
      this.channel = this.server.createChannel({
        json: false,
        setup: (channel: any) => this.setupChannel(channel, callback),
      });
    });
    this.server.on(DISCONNECT_EVENT, (err: any) => {
      this.logger.error(DISCONNECTED_RMQ_MESSAGE);
      this.logger.error(err);
    });
  }

  public createClient<T = any>(): T {
    const socketOptions = this.getOptionsProp(this.options, 'socketOptions');
    return rqmPackage.connect(this.urls, {
      connectionOptions: socketOptions,
      heartbeatIntervalInSeconds: socketOptions?.heartbeatIntervalInSeconds,
      reconnectTimeInSeconds: socketOptions?.reconnectTimeInSeconds,
    });
  }

  public async setupChannel(channel: any, callback: Function) {
    const noAck = this.getOptionsProp(this.options, 'noAck', RQM_DEFAULT_NOACK);

    await channel.assertQueue(this.queue, this.queueOptions);
    await channel.prefetch(this.prefetchCount, this.isGlobalPrefetchCount);
    channel.consume(
      this.queue,
      (msg: Record<string, any>) => this.handleMessage(msg, channel),
      {
        noAck,
      },
    );
    callback();
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
    let errorMessage: {};
    try {
      //console.log('content== ', content.toString('utf-8'));

      rawMessage = JSON.parse(content.toString());
      if (
        rawMessage.pattern != 'st_email_queue' ||
        rawMessage.pattern != 'st_sms_queue'
      ) {
        const { pattern, ...other } = rawMessage;

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

  public sendMessage<T = any>(
    message: T,
    replyTo: any,
    correlationId: string,
  ): void {
    const outgoingResponse = this.serializer.serialize(
      message as unknown as OutgoingResponse,
    );
    const options = outgoingResponse.options;
    delete outgoingResponse.options;

    const buffer = Buffer.from(JSON.stringify(outgoingResponse));
    this.channel.sendToQueue(replyTo, buffer, { correlationId, ...options });
  }

  protected initializeSerializer(options: RmqOptions['options']) {
    this.serializer = options?.serializer ?? new RmqRecordSerializer();
  }
}
