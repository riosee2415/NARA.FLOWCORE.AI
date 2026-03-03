import { Injectable } from '@nestjs/common';
import { Menu } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Menu[]> {
    return await this.prisma.menu.findMany({
      where: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 사용자가 접근 가능한 메뉴 ID 목록을 반환
   */
  async getUserAccessibleMenuIds(userId: string): Promise<string[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId must be a valid string');
    }

    // 사용자 존재 여부 확인
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new Error(`User with id ${userId} not found`);
    }

    const userMenus = await this.prisma.userMenu.findMany({
      where: { userId },
      select: { menuId: true },
    });
    return userMenus.map((um) => um.menuId);
  }

  /**
   * 사용자의 화면 접근 권한(메뉴)을 일괄 갱신한다.
   * - 기존 user_menus는 모두 삭제하고, 전달받은 menuIds로 재생성
   */
  async updateUserMenuAccess(params: {
    userId: string;
    menuIds: string[];
  }): Promise<{ updated: number }> {
    const { userId, menuIds } = params;

    // 추가 안전성 검증
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId must be a valid string');
    }

    if (!Array.isArray(menuIds)) {
      throw new Error('menuIds must be an array');
    }

    // 사용자 존재 여부 확인
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new Error(`User with id ${userId} not found`);
    }

    // 메뉴 ID들이 실제 존재하는지 확인
    if (menuIds.length > 0) {
      const existingMenus = await this.prisma.menu.findMany({
        where: {
          id: { in: menuIds },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      const existingMenuIds = existingMenus.map((m) => m.id);
      const invalidMenuIds = menuIds.filter(
        (id) => !existingMenuIds.includes(id),
      );

      if (invalidMenuIds.length > 0) {
        throw new Error(
          `Invalid or inactive menu IDs: ${invalidMenuIds.join(', ')}`,
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // 기존 권한 삭제
      await tx.userMenu.deleteMany({ where: { userId } });

      // 새 권한 생성
      if (menuIds.length > 0) {
        await tx.userMenu.createMany({
          data: menuIds.map((menuId) => ({ userId, menuId })),
          skipDuplicates: true,
        });
      }

      return { updated: menuIds.length };
    });
  }
}
