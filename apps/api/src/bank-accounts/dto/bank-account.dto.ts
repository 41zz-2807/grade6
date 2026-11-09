import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBankAccountDto {
  @IsString()
  @MaxLength(120)
  bankName!: string;

  /** Spasi dan tanda hubung dibuang supaya nomor selalu bisa ditransfer. */
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
  )
  @IsString()
  @MaxLength(40)
  accountNumber!: string;

  @IsString()
  @MaxLength(160)
  accountHolder!: string;

  @IsOptional()
  @IsBoolean()
  isPublic = false;

  @IsOptional()
  @IsBoolean()
  isActive = true;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountHolder?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
