import { IsString, IsInt, IsBoolean, IsEnum, IsOptional, IsDecimal, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleType, ScopeType } from '@remember-me/prisma';

export class CreatePricingRuleDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority!: number; // Mayor = más prioridad

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsEnum(RuleType)
  ruleType!: RuleType; // MARKUP_PERCENT, MARKUP_FIXED, OVERRIDE_PRICE

  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType = ScopeType.GLOBAL;

  @IsObject()
  @IsOptional()
  matchers?: Record<string, any>; // { model: "iPhone 15 Pro", condition: "USED" }

  @Type(() => Number)
  @IsDecimal()
  value!: number; // Porcentaje, monto fijo, o precio final según ruleType

  @IsString()
  @IsOptional()
  currency?: string = 'USD';
}
