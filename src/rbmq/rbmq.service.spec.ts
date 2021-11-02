import { Test, TestingModule } from '@nestjs/testing';
import { RbmqService } from './rbmq.service';

describe('RbmqService', () => {
  let service: RbmqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RbmqService],
    }).compile();

    service = module.get<RbmqService>(RbmqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
