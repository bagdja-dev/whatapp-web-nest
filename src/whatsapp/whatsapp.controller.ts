import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { BatchMessageDto } from './dto/batch-message.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { WhatsAppService } from './whatsapp.service.js';

@Controller('api')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('status')
  getStatus() {
    return this.whatsappService.getStatus();
  }

  @Get('qrcode')
  async getQrCode(@Req() req: Request, @Res() res: Response) {
    const preferJson = req.headers.accept?.includes('application/json');

    if (preferJson) {
      return res.json(this.whatsappService.getQrCodeJson());
    }

    const image = this.whatsappService.getQrCodeImage();
    if (!image) {
      return res.status(HttpStatus.NOT_FOUND).json({
        message: 'QR Code belum tersedia. Silakan tunggu beberapa saat.',
        status: 'not_ready',
        connected: false,
      });
    }

    res.setHeader('Content-Type', 'image/png');
    return res.send(image);
  }

  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: SendMessageDto,
    examples: {
      default: {
        summary: 'Contoh kirim satu pesan',
        value: {
        number: '6281234567890',
        message: 'Halo, ini pesan dari WhatsApp API.',
        },
      },
    },
  })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto.number, dto.message);
  }

  @Post('send-batch-message')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: BatchMessageDto,
    examples: {
      'Pesan berbeda per nomor': {
        summary: 'Setiap nomor menerima pesan berbeda',
        value: {
            recipients: [
              {
                number: '6281234567890',
                message: 'Halo Budi, ini pesan pertama.',
              },
              {
                number: '6289876543210',
                message: 'Halo Sari, ini pesan kedua.',
              },
            ],
            delay: 1500,
        },
      },
      'Satu pesan untuk semua nomor': {
        summary: 'Semua nomor menerima pesan yang sama',
        value: {
            recipients: ['6281234567890', '6289876543210'],
            message: 'Pengumuman: layanan tersedia hari ini.',
            delay: 1500,
        },
      },
    },
  })
  async sendBatchMessage(@Body() dto: BatchMessageDto) {
    return this.whatsappService.sendBatchMessage(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return this.whatsappService.logout();
  }

  @Post('clear-session')
  @HttpCode(HttpStatus.OK)
  async clearSession() {
    return this.whatsappService.clearSession();
  }
}
