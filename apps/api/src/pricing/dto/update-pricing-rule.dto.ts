import { IsString, IsInt, IsBoolean, IsEnum, IsOptional, IsDecimal, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleType, ScopeType } from '@remember-me/prisma';

export class UpdatePricingRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(RuleType)
  @IsOptional()
  ruleType?: RuleType;

  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @IsObject()
  @IsOptional()
  matchers?: Record<string, any>;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
