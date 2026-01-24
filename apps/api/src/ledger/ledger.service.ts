import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerAccountDto } from './dto/create-ledger-account.dto';
import { ListLedgerAccountsDto } from './dto/list-ledger-accounts.dto';

@Injectable({ scope: Scope.REQUEST })
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async createAccount(organizationId: string, dto: CreateLedgerAccountDto) {
    // Check if code already exists for this organization
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: {
        organizationId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(`Account with code ${dto.code} already exists`);
    }

    const account = await this.prisma.ledgerAccount.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive ?? true,
      },
    });

    return account;
  }

  async listAccounts(organizationId: string, dto: ListLedgerAccountsDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    if (dto.type) {
      where.type = dto.type;
    }

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.ledgerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.ledgerAccount.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getAccount(organizationId: string, id: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!account) {
      throw new NotFoundException('Ledger account not found');
    }

    return account;
  }
}
