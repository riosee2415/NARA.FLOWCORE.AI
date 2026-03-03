import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminPermissionService {
  private readonly logger = new Logger(AdminPermissionService.name);
  private isInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 서버 시작 시 관리자 권한 부여
   * 최초 1번만 실행되도록 보장
   */
  async initializeAdminPermissions(): Promise<void> {
    if (this.isInitialized) {
      this.logger.log('관리자 권한 초기화는 이미 완료되었습니다.');
      return;
    }

    try {
      this.logger.log('🔐 관리자 권한 초기화 시작...');

      // root@rootlab.com 사용자 찾기
      const adminUser = await this.prisma.user.findUnique({
        where: { email: 'root@rootlab.com' },
      });

      if (!adminUser) {
        this.logger.warn('⚠️ root@rootlab.com 사용자를 찾을 수 없습니다.');
        return;
      }

      this.logger.log(
        `👤 관리자 사용자 발견: ${adminUser.name} (${adminUser.email})`,
      );

      // 활성화된 모든 메뉴 조회
      const activeMenus = await this.prisma.menu.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, label: true },
      });

      if (activeMenus.length === 0) {
        this.logger.warn('⚠️ 활성화된 메뉴가 없습니다.');
        return;
      }

      this.logger.log(`📋 활성화된 메뉴 개수: ${activeMenus.length}개`);

      // 기존 권한 확인
      const existingPermissions = await this.prisma.userMenu.findMany({
        where: { userId: adminUser.id },
        select: { menuId: true },
      });

      const existingMenuIds = new Set(existingPermissions.map((p) => p.menuId));
      const newMenuIds = activeMenus
        .filter((menu) => !existingMenuIds.has(menu.id))
        .map((menu) => menu.id);

      if (newMenuIds.length === 0) {
        this.logger.log('✅ 모든 메뉴 권한이 이미 부여되어 있습니다.');
        this.isInitialized = true;
        return;
      }

      // 새로운 권한 부여
      const permissionsToCreate = newMenuIds.map((menuId) => ({
        userId: adminUser.id,
        menuId: menuId,
      }));

      await this.prisma.userMenu.createMany({
        data: permissionsToCreate,
        skipDuplicates: true,
      });

      this.logger.log(
        `✅ ${newMenuIds.length}개의 새로운 메뉴 권한을 부여했습니다.`,
      );
      this.logger.log(`📊 총 메뉴 권한: ${activeMenus.length}개`);

      // 부여된 권한 로그 출력
      const grantedMenus = activeMenus.filter(
        (menu) => !existingMenuIds.has(menu.id),
      );

      if (grantedMenus.length > 0) {
        this.logger.log('🎯 새로 부여된 메뉴 권한:');
        grantedMenus.forEach((menu) => {
          this.logger.log(`   - ${menu.label} (${menu.id})`);
        });
      }

      this.isInitialized = true;
      this.logger.log('🎉 관리자 권한 초기화가 완료되었습니다.');
    } catch (error) {
      this.logger.error('❌ 관리자 권한 초기화 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * 특정 사용자에게 모든 메뉴 권한 부여 (수동 실행용)
   */
  async grantAllPermissionsToUser(email: string): Promise<void> {
    try {
      this.logger.log(`🔐 ${email} 사용자에게 모든 권한 부여 시작...`);

      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error(`사용자를 찾을 수 없습니다: ${email}`);
      }

      const activeMenus = await this.prisma.menu.findMany({
        where: { status: 'ACTIVE' },
      });

      const permissionsToCreate = activeMenus.map((menu) => ({
        userId: user.id,
        menuId: menu.id,
      }));

      await this.prisma.userMenu.createMany({
        data: permissionsToCreate,
        skipDuplicates: true,
      });

      this.logger.log(`✅ ${activeMenus.length}개의 메뉴 권한을 부여했습니다.`);
    } catch (error) {
      this.logger.error('❌ 권한 부여 중 오류 발생:', error);
      throw error;
    }
  }
}
