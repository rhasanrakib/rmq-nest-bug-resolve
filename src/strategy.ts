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
    } catch (error) {
      errorMessage = {
        ...{ error: error.message },
        ...{ body: content.toString('utf-8') },
      };
      rawMessage = JSON.parse(JSON.stringify(errorMessage));
    }
    message.content = JSON.stringify(rawMessage);
    message.properties = properties;
    return super.handleMessage(message, channel);
  }
}
