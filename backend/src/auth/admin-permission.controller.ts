import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AdminPermissionService } from './admin-permission.service';
import { AccessTokenGuard } from './guards/access-token.guard';

@Controller('auth/admin-permission')
@UseGuards(AccessTokenGuard)
export class AdminPermissionController {
  constructor(
    private readonly adminPermissionService: AdminPermissionService,
  ) {}

  /**
   * 특정 사용자에게 모든 메뉴 권한 부여 (수동 실행)
   * POST /api/auth/admin-permission/grant-all
   */
  @Post('grant-all')
  async grantAllPermissions(@Body() body: { email: string }) {
    await this.adminPermissionService.grantAllPermissionsToUser(body.email);
    return {
      success: true,
      message: `${body.email} 사용자에게 모든 메뉴 권한을 부여했습니다.`,
    };
  }
}
