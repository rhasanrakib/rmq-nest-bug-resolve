import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { CustomDecorator } from './decorator/req.decorator';

import { RbmqService } from './rbmq.service';

@Controller('rbmq')
export class RbmqController {
  constructor(private rbmqService: RbmqService) {}

  @EventPattern()
  public async demoEventHandler(
    @Payload() payload: any,
    @Ctx() context: RmqContext,
  ) {
    console.log('paisi');
    const channel = await context.getChannelRef();
    const mgs = await context.getMessage();
    console.log(payload);
    await channel.ack(mgs);
    //await channel.reject(mgs, false);
  }
}
