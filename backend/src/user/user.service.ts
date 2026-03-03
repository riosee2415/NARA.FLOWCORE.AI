import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 사용자 목록 조회 (메뉴 권한 관리용)
   */
  async findAll() {
    return await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        isWorking: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 현재 로그인 사용자의 접근 가능 메뉴 조회 (UserMenu + Menu 계층 구조)
   */
  async getMyMenus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`사용자 ID ${userId}를 찾을 수 없습니다.`);
    }

    const userMenus = await this.prisma.userMenu.findMany({
      where: {
        userId,
        menu: { status: 'ACTIVE' },
      },
      include: { menu: true },
    });

    const menus = userMenus
      .map((um) => um.menu)
      .filter((m): m is NonNullable<typeof m> => m != null);

    const sorted = this.sortMenusHierarchically(menus);
    return { userId, menus: sorted, totalCount: menus.length };
  }

  private sortMenusHierarchically(
    menus: {
      id: string;
      parentId: string | null;
      sortOrder: number;
      [k: string]: unknown;
    }[],
  ) {
    const menuMap = new Map<
      string,
      {
        id: string;
        parentId: string | null;
        sortOrder: number;
        [k: string]: unknown;
        children: unknown[];
      }
    >();
    const root: unknown[] = [];

    menus.forEach((m) => {
      menuMap.set(m.id, { ...m, children: [] });
    });

    menus.forEach((m) => {
      const node = menuMap.get(m.id)!;
      if (m.parentId && menuMap.has(m.parentId)) {
        menuMap.get(m.parentId)!.children.push(node);
      } else {
        root.push(node);
      }
    });

    const sort = (list: { sortOrder: number; children: unknown[] }[]) => {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      list.forEach((n) => {
        if (Array.isArray(n.children) && n.children.length > 0) {
          sort(n.children as { sortOrder: number; children: unknown[] }[]);
        }
      });
    };
    sort(root as { sortOrder: number; children: unknown[] }[]);
    return root;
  }
}
