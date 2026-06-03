import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ description: 'Admin user id to start the conversation with' })
  @IsString()
  @IsNotEmpty()
  peerAdminId: string;
}

export class MessageAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  mime: string;

  @ApiProperty()
  @IsInt()
  size: number;
}

export class SendMessageDto {
  @ApiPropertyOptional({
    example: 'Can you confirm the cheque cleared?',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({ description: 'Message id being replied to / quoted' })
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({ type: MessageAttachmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageAttachmentDto)
  attachment?: MessageAttachmentDto;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

export class EditMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}

export class ReactDto {
  @ApiProperty({ example: '👍' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji: string;
}

export class MarkReadDto {
  @ApiProperty({ description: 'Last message id this user has seen' })
  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Fetch messages older than this id' })
  @IsOptional()
  @IsString()
  beforeId?: string;
}
