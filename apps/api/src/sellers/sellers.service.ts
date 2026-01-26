import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all sellers (members with SELLER role) in the organization
   * Owner-only endpoint
   */
  async getSellers(organizationId: string) {
    const members = await this.prisma.membership.findMany({
      where: {
        organizationId,
        role: 'SELLER',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }
}
