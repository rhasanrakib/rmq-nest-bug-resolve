import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RbmqtModule } from './rbmq/rbmq.module';

@Module({
  imports: [RbmqtModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
