import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { EnvProtectionMiddleware } from '../middleware/env-protection.middleware';
import { Inject } from '@nestjs/common';

@ApiTags('보안 관리')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('security')
export class SecurityController {
  constructor(
    @Inject('EnvProtectionMiddleware')
    private readonly envProtectionMiddleware: EnvProtectionMiddleware,
  ) {}

  @Get('blocked-ips')
  @ApiOperation({ summary: '차단된 IP 목록 조회' })
  @ApiResponse({ status: 200, description: '차단된 IP 목록을 반환합니다.' })
  getBlockedIPs() {
    const blockedIPs = this.envProtectionMiddleware.getBlockedIPs();
    return {
      success: true,
      data: {
        blockedIPs,
        count: blockedIPs.length,
      },
      message: '차단된 IP 목록을 조회했습니다.',
    };
  }

  @Delete('blocked-ips/:ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '특정 IP 차단 해제' })
  @ApiResponse({ status: 200, description: 'IP 차단이 해제되었습니다.' })
  @ApiResponse({ status: 404, description: '해당 IP가 차단 목록에 없습니다.' })
  unblockIP(@Param('ip') ip: string) {
    const result = this.envProtectionMiddleware.unblockIP(ip);

    if (result) {
      return {
        success: true,
        message: `IP ${ip}의 차단이 해제되었습니다.`,
      };
    } else {
      return {
        success: false,
        message: `IP ${ip}가 차단 목록에 없습니다.`,
      };
    }
  }

  @Delete('blocked-ips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '모든 IP 차단 해제' })
  @ApiResponse({ status: 200, description: '모든 IP 차단이 해제되었습니다.' })
  clearAllBlockedIPs() {
    this.envProtectionMiddleware.clearBlockedIPs();
    return {
      success: true,
      message: '모든 IP 차단이 해제되었습니다.',
    };
  }
}
