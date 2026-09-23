import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import WAWebJS from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { BatchMessageDto } from './dto/batch-message.dto.js';

const whatsappModule = (WAWebJS as typeof WAWebJS & { default?: typeof WAWebJS }).default ?? WAWebJS;
const { Client, LocalAuth } = whatsappModule as typeof WAWebJS;

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: InstanceType<typeof WAWebJS.Client> | null = null;
  private clientReady = false;
  private qrCodeData: string | null = null;

  onModuleInit() {
    this.initializeClient();
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }

    await this.client.destroy();
    this.client = null;
    this.clientReady = false;
    this.qrCodeData = null;
  }

  getStatus() {
    return {
      status: this.clientReady ? 'connected' : 'disconnected',
      connected: this.clientReady,
      message: this.clientReady
        ? 'WhatsApp sudah terhubung'
        : 'WhatsApp belum terhubung. Silakan scan QR Code terlebih dahulu.',
      hasQrCode: !!this.qrCodeData,
    };
  }

  getQrCodeJson() {
    if (this.clientReady) {
      return {
        message: 'WhatsApp sudah terhubung. QR Code tidak diperlukan lagi.',
        status: 'connected',
        connected: true,
      };
    }

    if (!this.qrCodeData) {
      return {
        message: 'QR Code belum tersedia. Silakan tunggu beberapa saat.',
        status: 'not_ready',
        connected: false,
      };
    }

    return {
      qrCode: this.qrCodeData,
      status: 'ready',
      connected: false,
    };
  }

  getQrCodeImage() {
    if (this.clientReady || !this.qrCodeData) {
      return null;
    }

    return Buffer.from(this.qrCodeData.replace(/^data:image\/png;base64,/, ''), 'base64');
  }

  private initializeClient() {
    if (this.client) {
      return;
    }

    const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    this.client.on('loading_screen', (percent: number, message: string) => {
      this.logger.log(`Loading: ${percent}% - ${message}`);
    });

    this.client.on('qr', async (qr: string) => {
      try {
        this.qrCodeData = await QRCode.toDataURL(qr);
        this.logger.log('QR Code generated successfully');
      } catch (error) {
        this.logger.error('Error generating QR code', error instanceof Error ? error.stack : error);
        this.qrCodeData = null;
      }
    });

    this.client.on('ready', () => {
      this.logger.log('WhatsApp Client is ready!');
      this.clientReady = true;
      this.qrCodeData = null;
    });

    this.client.on('authenticated', () => {
      this.logger.log('WhatsApp Client authenticated');
    });

    this.client.on('auth_failure', (message: string) => {
      this.logger.error('Authentication failure:', message);
      this.clientReady = false;
      this.qrCodeData = null;
    });

    this.client.on('disconnected', (reason: string) => {
      this.logger.warn(`WhatsApp Client disconnected: ${reason}`);
      this.clientReady = false;
      this.qrCodeData = null;
    });

    this.client.on('change_state', (state: string) => {
      this.logger.log(`Client state changed: ${state}`);
    });

    this.client.initialize().catch((error: unknown) => {
      this.logger.error('Error initializing client', error instanceof Error ? error.stack : error);
    });
  }

  private normalizePhoneNumber(input: string) {
    return input.replace(/\D/g, '');
  }

  private parseChatTarget(input: string) {
    const raw = input.trim();

    if (!raw) {
      return { error: 'Nomor tujuan tidak boleh kosong' };
    }

    if (raw.includes('@')) {
      return {
        chatId: raw,
        normalizedNumber: raw,
        isDirectUser: raw.endsWith('@c.us'),
      };
    }

    const normalizedNumber = this.normalizePhoneNumber(raw);
    if (!normalizedNumber) {
      return { error: 'Format nomor tidak valid' };
    }

    return {
      chatId: `${normalizedNumber}@c.us`,
      normalizedNumber,
      isDirectUser: true,
    };
  }

  private async resolveChatId(input: string) {
    const parsed = this.parseChatTarget(input);
    if ('error' in parsed && parsed.error) {
      return parsed;
    }

    if (!parsed.isDirectUser) {
      return parsed;
    }

    const normalizedNumber = this.normalizePhoneNumber(parsed.normalizedNumber.replace('@c.us', ''));
    if (!normalizedNumber) {
      return { error: 'Format nomor tidak valid' };
    }

    try {
      const result = await this.client?.getNumberId(normalizedNumber);
      const serialized = typeof result === 'string' ? result : result?._serialized;

      if (!serialized) {
        return { error: `Nomor ${normalizedNumber} tidak terdaftar di WhatsApp` };
      }

      return {
        chatId: serialized,
        normalizedNumber,
      };
    } catch (error) {
      this.logger.error(`Error validating number ${normalizedNumber}:`, error instanceof Error ? error.message : error);
      return {
        chatId: `${normalizedNumber}@c.us`,
        normalizedNumber,
      };
    }
  }

  async sendMessage(number: string, message: string) {
    if (!this.clientReady || !this.client) {
      return {
        success: false,
        message: 'WhatsApp belum terhubung. Silakan scan QR Code terlebih dahulu.',
      };
    }

    if (!number || !message) {
      return {
        success: false,
        message: 'Parameter number dan message harus diisi',
      };
    }

    try {
      const target = await this.resolveChatId(number);
      if ('error' in target && target.error) {
        return {
          success: false,
          message: target.error,
        };
      }

      const chatId = target.chatId;
      const normalizedNumber = target.normalizedNumber;

      if (!chatId || !normalizedNumber) {
        return {
          success: false,
          message: 'Target chat tidak valid',
        };
      }

      const result = await this.client.sendMessage(chatId, message);

      return {
        success: true,
        message: 'Pesan berhasil dikirim',
        messageId: result?.id?._serialized ?? null,
        to: normalizedNumber,
      };
    } catch (error) {
      this.logger.error('Error sending message', error instanceof Error ? error.stack : error);
      return {
        success: false,
        message: 'Gagal mengirim pesan',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatchMessage(dto: BatchMessageDto) {
    if (!this.clientReady || !this.client) {
      return {
        success: false,
        message: 'WhatsApp belum terhubung. Silakan scan QR Code terlebih dahulu.',
      };
    }

    const { recipients, message, delay = 1000 } = dto;
    const delayMs = Math.max(100, Math.min(delay || 1000, 10000));

    const results: Array<{ number: string; success: boolean; messageId?: string | null; error?: string | null }> = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];

      let targetNumber: string;
      let targetMessage: string;

      if (typeof recipient === 'string') {
        targetNumber = recipient;
        targetMessage = message ?? '';
      } else {
        targetNumber = recipient.number;
        targetMessage = recipient.message;
      }

      if (!targetNumber || !targetMessage) {
        results.push({
          number: typeof recipient === 'string' ? recipient : recipient.number,
          success: false,
          messageId: null,
          error: 'Format recipient tidak valid',
        });
        failedCount += 1;
        continue;
      }

      try {
        const target = await this.resolveChatId(targetNumber);
        if ('error' in target && target.error) {
          results.push({
            number: targetNumber,
            success: false,
            messageId: null,
            error: target.error,
          });
          failedCount += 1;
          continue;
        }

        const chatId = target.chatId;
        const normalizedNumber = target.normalizedNumber;

        if (!chatId || !normalizedNumber) {
          results.push({
            number: targetNumber,
            success: false,
            messageId: null,
            error: 'Target chat tidak valid',
          });
          failedCount += 1;
          continue;
        }

        const result = await this.client.sendMessage(chatId, targetMessage);
        results.push({
          number: normalizedNumber,
          success: true,
          messageId: result?.id?._serialized ?? null,
          error: null,
        });
        sentCount += 1;

        if (index < recipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        this.logger.error(`Error sending message to ${targetNumber}`, error instanceof Error ? error.stack : error);
        results.push({
          number: targetNumber,
          success: false,
          messageId: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failedCount += 1;
      }
    }

    return {
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    };
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
      }

      this.clientReady = false;
      this.qrCodeData = null;
      this.client = null;
      this.initializeClient();

      return {
        success: true,
        message: 'Logout berhasil. QR Code baru akan tersedia dalam beberapa saat.',
      };
    } catch (error) {
      this.logger.error('Error logging out', error instanceof Error ? error.stack : error);
      return {
        success: false,
        message: 'Gagal logout',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clearSession() {
    try {
      if (this.client) {
        await this.client.destroy();
      }

      this.client = null;
      this.clientReady = false;
      this.qrCodeData = null;

      const sessionPath = path.join(process.cwd(), '.wwebjs_auth');
      await fs.rm(sessionPath, { recursive: true, force: true });
      this.initializeClient();

      return {
        success: true,
        message: 'Session berhasil dihapus. QR Code baru akan tersedia dalam beberapa saat.',
      };
    } catch (error) {
      this.logger.error('Error clearing session', error instanceof Error ? error.stack : error);
      return {
        success: false,
        message: 'Gagal menghapus session',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
