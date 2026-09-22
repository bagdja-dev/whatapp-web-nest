import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';

@Module({
  imports: [WhatsAppModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
