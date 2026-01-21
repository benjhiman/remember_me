import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { Role, InviteStatus } from '@remember-me/prisma';
import * as crypto from 'crypto';
import { ORG_SETTINGS_DEFAULTS } from '../settings/org-settings.defaults';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    // Generate slug if not provided
    let slug = dto.slug;
    if (!slug) {
      slug = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Check if slug is taken
    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Organization slug is already taken');
    }

    // Create organization and membership in transaction
    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: slug!,
          settings: {
            crm: ORG_SETTINGS_DEFAULTS.crm,
          } as any,
        },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.OWNER,
        },
      });

      return org;
    });

    return organization;
  }

  async findOne(id: string, userId: string) {
    // Verify user is member of organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: id,
        userId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    return membership.organization;
  }

  async findMyOrganizations(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  async update(id: string, userId: string, dto: UpdateOrganizationDto) {
    // Verify user is ADMIN or MANAGER
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: id,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admins and managers can update organization');
    }

    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async getMembers(organizationId: string, userId: string) {
    // Verify user is member
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
      id: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  }

  async addMember(organizationId: string, userId: string, dto: AddMemberDto) {
    // Verify user is ADMIN or MANAGER
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admins and managers can add members');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: user.id,
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Create membership
    return this.prisma.membership.create({
      data: {
        organizationId,
        userId: user.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberRoleDto
  ) {
    // Verify user is ADMIN
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can update member roles');
    }

    // Prevent changing your own role
    if (memberId === membership.id) {
      throw new BadRequestException('You cannot change your own role');
    }

    // Verify member exists and belongs to organization
    const memberToUpdate = await this.prisma.membership.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
    });

    if (!memberToUpdate) {
      throw new NotFoundException('Member not found');
    }

    // Update role
    return this.prisma.membership.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  async removeMember(organizationId: string, memberId: string, userId: string) {
    // Verify user is ADMIN
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can remove members');
    }

    // Prevent removing yourself
    if (memberId === membership.id) {
      throw new BadRequestException('You cannot remove yourself from the organization');
    }

    // Verify member exists and belongs to organization
    const memberToRemove = await this.prisma.membership.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Member not found');
    }

    // Remove member
    await this.prisma.membership.delete({
      where: { id: memberId },
    });

    return { message: 'Member removed successfully' };
  }

  async inviteUser(organizationId: string, userId: string, dto: InviteUserDto) {
    // Verify user is ADMIN or MANAGER
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admins and managers can invite users');
    }

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.membership.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    // Check for pending invitation
    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: dto.email,
        status: InviteStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (pendingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration date (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    // Create invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.role,
        token,
        invitedById: userId,
        expiresAt,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // In a real app, you would send an email here with the invitation link
    // For now, we return the token (in production, only send via email)

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token, // Remove in production, send via email only
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`,
    };
  }

  async getInvitations(organizationId: string, userId: string) {
    // Verify user is member
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    // Only ADMIN and MANAGER can see invitations
    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admins and managers can view invitations');
    }

    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId },
      include: {
        invitedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invitations;
  }

  async cancelInvitation(organizationId: string, invitationId: string, userId: string) {
    // Verify user is ADMIN or MANAGER
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admins and managers can cancel invitations');
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        status: InviteStatus.PENDING,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or already processed');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InviteStatus.CANCELLED },
    });

    return { message: 'Invitation cancelled successfully' };
  }
}
