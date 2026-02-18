import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ItemCondition } from '@remember-me/prisma';

/**
 * Generate itemGroupKey for grouping items without color
 * Format: {BRAND}_{MODEL}_{STORAGE}_{CONDITION}
 * Example: "APPLE_IPHONE_15_PRO_128_NEW"
 */
function generateItemGroupKey(item: {
  brand?: string | null;
  model?: string | null;
  storageGb?: number | null;
  condition?: ItemCondition | null;
}): string {
  const brand = (item.brand || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const model = (item.model || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const storage = item.storageGb ? `${item.storageGb}GB` : 'UNKNOWN';
  const condition = (item.condition || 'UNKNOWN').toUpperCase();

  return `${brand}_${model}_${storage}_${condition}`;
}

/**
 * Generate display name for item group
 * Example: "iPhone 15 Pro 128GB NEW"
 */
function generateDisplayName(item: {
  brand?: string | null;
  model?: string | null;
  storageGb?: number | null;
  condition?: ItemCondition | null;
}): string {
  const brand = item.brand || 'Unknown';
  const model = item.model || 'Unknown';
  const storage = item.storageGb ? `${item.storageGb}GB` : '';
  const condition = item.condition || '';

  const parts = [brand, model, storage, condition].filter(Boolean);
  return parts.join(' ');
}

@Injectable({ scope: Scope.REQUEST })
export class PriceListsService {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private request: Request,
  ) {}

  private async verifyMembership(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Organization not found or you are not a member');
    }

    return { role: membership.role };
  }

  private hasAdminManagerAccess(role: string): boolean {
    return ['ADMIN', 'MANAGER', 'OWNER'].includes(role);
  }

  async listPriceLists(organizationId: string, userId: string) {
    await this.verifyMembership(organizationId, userId);

    const priceLists = await this.prisma.priceList.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      data: priceLists.map((list) => ({
        id: list.id,
        name: list.name,
        itemCount: list._count.items,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
    };
  }

  async getPriceList(organizationId: string, userId: string, priceListId: string) {
    await this.verifyMembership(organizationId, userId);

    const priceList = await this.prisma.priceList.findFirst({
      where: {
        id: priceListId,
        organizationId,
      },
      include: {
        items: {
          include: {
            _count: {
              select: { overrides: true },
            },
          },
          orderBy: { displayName: 'asc' },
        },
      },
    });

    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    return {
      id: priceList.id,
      name: priceList.name,
      createdAt: priceList.createdAt,
      updatedAt: priceList.updatedAt,
      items: priceList.items.map((item) => {
        // Extract condition from itemGroupKey (last part after last underscore)
        const condition = item.itemGroupKey.split('_').pop() || 'UNKNOWN';
        return {
          id: item.id,
          itemGroupKey: item.itemGroupKey,
          displayName: item.displayName,
          baseSku: item.baseSku,
          basePrice: item.basePrice ? parseFloat(item.basePrice.toString()) : null,
          overrideCount: item._count.overrides,
          condition: condition as 'NEW' | 'USED' | 'OEM' | 'UNKNOWN',
        };
      }),
    };
  }

  async createPriceList(
    organizationId: string,
    userId: string,
    dto: {
      name: string;
      mode: 'ALL' | 'FOLDERS' | 'ITEMS';
      folderIds?: string[];
      itemIds?: string[];
    },
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create price lists');
    }

    const nameTrimmed = dto.name.trim();
    if (!nameTrimmed || nameTrimmed.length < 1) {
      throw new BadRequestException('Price list name is required');
    }

    // Check for duplicate name
    const existing = await this.prisma.priceList.findFirst({
      where: {
        organizationId,
        name: nameTrimmed,
      },
    });

    if (existing) {
      throw new BadRequestException(`A price list with name "${nameTrimmed}" already exists`);
    }

    // Resolve items based on mode
    let items: Array<{
      id: string;
      brand?: string | null;
      model?: string | null;
      storageGb?: number | null;
      condition?: ItemCondition | null;
      sku?: string | null;
    }> = [];

    if (dto.mode === 'ALL') {
      items = await this.prisma.item.findMany({
        where: {
          organizationId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          brand: true,
          model: true,
          storageGb: true,
          condition: true,
          sku: true,
        },
      });
    } else if (dto.mode === 'FOLDERS') {
      if (!dto.folderIds || dto.folderIds.length === 0) {
        throw new BadRequestException('At least one folder must be selected');
      }

      // Validate folders belong to organization
      const folders = await this.prisma.folder.findMany({
        where: {
          id: { in: dto.folderIds },
          organizationId,
        },
      });

      if (folders.length !== dto.folderIds.length) {
        throw new BadRequestException('One or more folders not found or do not belong to this organization');
      }

      items = await this.prisma.item.findMany({
        where: {
          organizationId,
          folderId: { in: dto.folderIds },
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          brand: true,
          model: true,
          storageGb: true,
          condition: true,
          sku: true,
        },
      });
    } else if (dto.mode === 'ITEMS') {
      if (!dto.itemIds || dto.itemIds.length === 0) {
        throw new BadRequestException('At least one item must be selected');
      }

      items = await this.prisma.item.findMany({
        where: {
          id: { in: dto.itemIds },
          organizationId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          brand: true,
          model: true,
          storageGb: true,
          condition: true,
          sku: true,
        },
      });

      if (items.length !== dto.itemIds.length) {
        throw new BadRequestException('One or more items not found or do not belong to this organization');
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('No items found for the selected criteria');
    }

    // Group items by itemGroupKey (without color)
    const groupedItems = new Map<
      string,
      {
        itemGroupKey: string;
        displayName: string;
        baseSku: string | null;
        items: typeof items;
      }
    >();

    for (const item of items) {
      const groupKey = generateItemGroupKey(item);
      const displayName = generateDisplayName(item);

      if (!groupedItems.has(groupKey)) {
        groupedItems.set(groupKey, {
          itemGroupKey: groupKey,
          displayName,
          baseSku: item.sku || null,
          items: [],
        });
      }

      groupedItems.get(groupKey)!.items.push(item);
    }

    // Create price list and items in transaction
    return this.prisma.$transaction(async (tx) => {
      const priceList = await tx.priceList.create({
        data: {
          organizationId,
          name: nameTrimmed,
        },
      });

      // Create PriceListItem for each group
      const priceListItems = await Promise.all(
        Array.from(groupedItems.values()).map((group) =>
          tx.priceListItem.create({
            data: {
              organizationId,
              priceListId: priceList.id,
              itemGroupKey: group.itemGroupKey,
              displayName: group.displayName,
              baseSku: group.baseSku,
              basePrice: null, // Initially null, user sets it later
            },
          }),
        ),
      );

      return {
        id: priceList.id,
        name: priceList.name,
        createdAt: priceList.createdAt,
        updatedAt: priceList.updatedAt,
        itemCount: priceListItems.length,
      };
    });
  }

  async updatePriceListItem(
    organizationId: string,
    userId: string,
    priceListId: string,
    priceListItemId: string,
    dto: { basePrice?: number | null },
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update price list items');
    }

    // Verify price list exists and belongs to organization
    const priceList = await this.prisma.priceList.findFirst({
      where: {
        id: priceListId,
        organizationId,
      },
    });

    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    // Verify price list item exists and belongs to price list
    const priceListItem = await this.prisma.priceListItem.findFirst({
      where: {
        id: priceListItemId,
        priceListId,
        organizationId,
      },
    });

    if (!priceListItem) {
      throw new NotFoundException('Price list item not found');
    }

    // Update base price
    const updated = await this.prisma.priceListItem.update({
      where: { id: priceListItemId },
      data: {
        basePrice: dto.basePrice !== null && dto.basePrice !== undefined ? new Decimal(dto.basePrice) : null,
      },
    });

    return {
      id: updated.id,
      itemGroupKey: updated.itemGroupKey,
      displayName: updated.displayName,
      basePrice: updated.basePrice ? parseFloat(updated.basePrice.toString()) : null,
    };
  }

  async bulkUpdatePriceListItems(
    organizationId: string,
    userId: string,
    priceListId: string,
    dto: { items: Array<{ priceListItemId: string; basePrice?: number | null }> },
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update price list items');
    }

    // Verify price list exists and belongs to organization
    const priceList = await this.prisma.priceList.findFirst({
      where: {
        id: priceListId,
        organizationId,
      },
    });

    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    // Verify all price list items exist and belong to price list
    const priceListItemIds = dto.items.map((item) => item.priceListItemId);
    const existingItems = await this.prisma.priceListItem.findMany({
      where: {
        id: { in: priceListItemIds },
        priceListId,
        organizationId,
      },
    });

    if (existingItems.length !== priceListItemIds.length) {
      throw new BadRequestException('One or more price list items not found or do not belong to this price list');
    }

    // Update all items in transaction
    const updated = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.priceListItem.update({
          where: { id: item.priceListItemId },
          data: {
            basePrice: item.basePrice !== null && item.basePrice !== undefined ? new Decimal(item.basePrice) : null,
          },
        }),
      ),
    );

    return {
      updated: updated.map((item) => ({
        id: item.id,
        itemGroupKey: item.itemGroupKey,
        displayName: item.displayName,
        basePrice: item.basePrice ? parseFloat(item.basePrice.toString()) : null,
      })),
    };
  }

  async deletePriceList(organizationId: string, userId: string, priceListId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete price lists');
    }

    // Verify price list exists and belongs to organization
    const priceList = await this.prisma.priceList.findFirst({
      where: {
        id: priceListId,
        organizationId,
      },
    });

    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    // Delete price list (cascade will delete items and overrides)
    await this.prisma.priceList.delete({
      where: { id: priceListId },
    });

    return { success: true };
  }
}
