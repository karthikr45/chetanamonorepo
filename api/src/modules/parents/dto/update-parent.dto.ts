import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateParentDto } from './create-parent.dto';

export class UpdateParentDto extends PartialType(
  OmitType(CreateParentDto, ['students'] as const),
) {}
