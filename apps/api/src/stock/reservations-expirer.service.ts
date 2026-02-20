import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, StockMovementType } from '@remember-me/prisma';

@Injectable()
export class ReservationsExpirerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationsExpirerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs = parseInt(process.env.RESERVATIONS_EXPIRER_INTERVAL_MS || '300000', 10); // Default 5 minutes
  private readonly enabled = process.env.RESERVATIONS_EXPIRER_ENABLED !== 'false'; // Enabled by default
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (this.enabled) {
      this.logger.log(`Starting reservations expirer with interval ${this.intervalMs}ms`);
      this.intervalId = setInterval(() => this.expireReservations(), this.intervalMs);
      // Run once immediately on startup
      this.expireReservations();
    } else {
      this.logger.log('Reservations expirer disabled');
    }
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async expireReservations() {
    if (this.isProcessing) {
      this.logger.debug('Expiration already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Find all ACTIVE reservations that have expired
      const expiredReservations = await this.prisma.stockReservation.findMany({
        where: {
          status: ReservationStatus.ACTIVE,
          expiresAt: {
            not: null,
            lt: now,
          },
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
            },
          },
          stockItem: {
            select: {
              id: true,
            },
          },
        },
      });

      if (expiredReservations.length === 0) {
        this.logger.debug('No expired reservations found');
        return;
      }

      this.logger.log(`Found ${expiredReservations.length} expired reservation(s), expiring...`);

      // Expire all reservations in a transaction
      await this.prisma.$transaction(async (tx) => {
        for (const reservation of expiredReservations) {
          // Update reservation status to EXPIRED
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { status: ReservationStatus.EXPIRED },
          });

          // Create movement record for expiration (RELEASE type)
          // If reservation is item-based, we need to find a stock item to link the movement
          if (reservation.itemId) {
            // Find first stock item for this item
            const stockItem = await tx.stockItem.findFirst({
              where: {
                organizationId: reservation.organizationId,
                itemId: reservation.itemId,
                deletedAt: null,
              },
            });

            if (stockItem) {
              await tx.stockMovement.create({
                data: {
                  organizationId: reservation.organizationId,
                  stockItemId: stockItem.id,
                  type: StockMovementType.RELEASE,
                  quantity: reservation.quantity,
                  quantityBefore: 0, // Not applicable for expiration
                  quantityAfter: 0,
                  reason: 'Reservation expired automatically',
                  reservationId: reservation.id,
                  createdById: reservation.createdById,
                  metadata: {
                    expiredAt: now.toISOString(),
                    itemId: reservation.itemId,
                  },
                },
              });
            }
          } else if (reservation.stockItemId) {
            // Legacy: stock item-based reservation
            await tx.stockMovement.create({
              data: {
                organizationId: reservation.organizationId,
                stockItemId: reservation.stockItemId,
                type: StockMovementType.RELEASE,
                quantity: reservation.quantity,
                quantityBefore: 0,
                quantityAfter: 0,
                reason: 'Reservation expired automatically',
                reservationId: reservation.id,
                createdById: reservation.createdById,
                metadata: {
                  expiredAt: now.toISOString(),
                },
              },
            });
          }
        }
      });

      this.logger.log(`Expired ${expiredReservations.length} reservation(s) successfully`);
    } catch (error) {
      this.logger.error(`Error expiring reservations: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    } finally {
      this.isProcessing = false;
    }
  }
}
