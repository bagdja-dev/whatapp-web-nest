import { describe, expect, it } from 'vitest';
import { WhatsAppService } from './whatsapp.service.js';

describe('WhatsAppService', () => {
  it('should return disconnected status before initialization', () => {
    const service = new WhatsAppService();

    expect(service.getStatus()).toMatchObject({
      status: 'disconnected',
      connected: false,
    });
  });

  it('should report connecting while the client is preparing QR', () => {
    const service = new WhatsAppService();
    (service as any).client = { id: 'client' };

    expect(service.getQrCodeJson()).toMatchObject({
      status: 'connecting',
      connected: false,
    });
  });

  it('should return QR payload when QR is ready', () => {
    const service = new WhatsAppService();
    (service as any).qrCodeData = 'data:image/png;base64,abc';

    expect(service.getQrCodeJson()).toMatchObject({
      status: 'ready',
      connected: false,
      qrCode: 'data:image/png;base64,abc',
    });
  });

  it('should return a frontend-friendly connection summary', () => {
    const service = new WhatsAppService();
    (service as any).clientReady = true;

    expect(service.getConnectionSummary()).toMatchObject({
      connected: true,
      status: 'connected',
      message: 'WhatsApp sudah terhubung',
      qrCode: null,
    });
  });
});
