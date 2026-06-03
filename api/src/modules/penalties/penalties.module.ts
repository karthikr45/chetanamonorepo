import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';
import { Penalty } from './entities/penalty.entity';
import { PenaltyRule } from './entities/penalty-rule.entity';
import { PenaltyRulesController } from './penalty-rules.controller';
import { PenaltyRulesService } from './penalty-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([Penalty, PenaltyRule])],
  controllers: [PenaltiesController, PenaltyRulesController],
  providers: [PenaltiesService, PenaltyRulesService],
  exports: [PenaltiesService, PenaltyRulesService],
})
export class PenaltiesModule {}
