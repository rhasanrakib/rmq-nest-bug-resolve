import { Test, TestingModule } from '@nestjs/testing';
import { RbmqController } from './rbmq.controller';

describe('RbmqController', () => {
  let controller: RbmqController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbmqController],
    }).compile();

    controller = module.get<RbmqController>(RbmqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
