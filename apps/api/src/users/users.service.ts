import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        updatedAt: true,
      },
    });
  }

  async getUsersInOrganization(organizationId: string, userId: string) {
    // Verify user is member of organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    const members = await this.prisma.membership.findMany({
      where: { organizationId },
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

  /**
   * Get users in current organization (from JWT token)
   * All roles can access this endpoint (needed for assignment dropdowns)
   */
  async getCurrentOrganizationUsers(organizationId: string, requestingUserId: string) {
    // Verify requesting user is member of organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: requestingUserId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Get all members (including soft-deleted users are filtered by Prisma default)
    const members = await this.prisma.membership.findMany({
      where: { organizationId },
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
      isActive: true, // TODO: Add isActive field to User model if needed
      createdAt: m.user.createdAt,
    }));
  }
}
