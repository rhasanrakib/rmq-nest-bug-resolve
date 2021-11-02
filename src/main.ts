import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions } from '@nestjs/microservices';

import { RmqStrategy } from './strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //console.log(process.env.RABBITMQ_URI);
  const options = {
    urls: ['amqp://root:root@0.0.0.0:5672'],
    queue: 'demo_queue',
    noAck: false,
    prefetchCount: 5,
    queueOptions: {
      durable: true,
    },
  };
  const QueueServer = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,

    {
      strategy: new RmqStrategy(options),
    },
  );
  //console.log(QueueServer);
  await QueueServer.listen();

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT, () => {
    console.log(`Rabbit MQ API is Running on PORT ${PORT}`);
  });
}
bootstrap();
