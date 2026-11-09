import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertSettingDto {
  @IsString()
  @MaxLength(80)
  key!: string;

  @IsString()
  @MaxLength(2000)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
