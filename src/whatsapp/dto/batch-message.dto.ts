import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class BatchRecipientDto {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class BatchMessageDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BatchRecipientDto)
  recipients: Array<string | BatchRecipientDto>;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  delay?: number;
}
