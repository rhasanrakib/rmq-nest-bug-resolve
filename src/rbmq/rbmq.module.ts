import { RbmqController } from './rbmq.controller';
import { RbmqService } from './rbmq.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [RbmqController],
  providers: [RbmqService],
})
export class RbmqtModule {}
