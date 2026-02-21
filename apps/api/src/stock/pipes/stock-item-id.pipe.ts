import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Pipe to validate stock item ID parameter
 * Rejects reserved route names to prevent route conflicts
 */
@Injectable()
export class StockItemIdPipe implements PipeTransform<string, string> {
  private readonly reservedRoutes = [
    'seller-view',
    'summary',
    'movements',
    'health',
    'entries',
    'bulk-add',
    'ping',
    'item', // Reserved for /stock/item/:id routes
  ];

  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('Stock item ID is required');
    }

    // Reject reserved route names
    if (this.reservedRoutes.includes(value.toLowerCase())) {
      throw new BadRequestException(
        `"${value}" is a reserved route name and cannot be used as a stock item ID`,
      );
    }

    return value;
  }
}
