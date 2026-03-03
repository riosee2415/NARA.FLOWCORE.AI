import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '기본 Hello 메시지' })
  @ApiResponse({ status: 200, description: 'Hello 메시지 반환' })
  getHello(@Res() res: Response) {
    return res.json({
      message: this.appService.getHello(),
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }
}
