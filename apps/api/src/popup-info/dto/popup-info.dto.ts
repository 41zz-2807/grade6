import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePopupInfoDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isActive = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order = 0;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class UpdatePopupInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}
