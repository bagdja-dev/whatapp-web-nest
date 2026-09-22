import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'WhatsApp API dengan NestJS',
      endpoints: {
        swagger: '/api-docs',
        status: '/api/status',
        qrcode: '/api/qrcode',
        sendMessage: 'POST /api/send-message',
        sendBatchMessage: 'POST /api/send-batch-message',
        logout: 'POST /api/logout',
        clearSession: 'POST /api/clear-session',
      },
    };
  }
}
