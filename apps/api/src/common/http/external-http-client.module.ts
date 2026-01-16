import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExternalHttpClientService } from './external-http-client.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ExternalHttpClientService],
  exports: [ExternalHttpClientService],
})
export class ExternalHttpClientModule {}
