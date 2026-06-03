import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Relationship } from '../entities/parent-student.entity';

export class ParentStudentLinkDto {
  @ApiProperty({ example: 'ADM-2024-001' })
  @IsString()
  @IsNotEmpty()
  admissionNumber: string;

  @ApiPropertyOptional({ enum: Relationship, default: Relationship.GUARDIAN })
  @IsEnum(Relationship)
  @IsOptional()
  relationship?: Relationship = Relationship.GUARDIAN;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}

export class CreateParentDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phoneNumber?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({ type: [ParentStudentLinkDto], description: 'Children to link' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParentStudentLinkDto)
  students: ParentStudentLinkDto[];
}
