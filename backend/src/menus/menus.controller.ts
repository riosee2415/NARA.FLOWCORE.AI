import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Menu as MenuEntity } from 'src/_gen/prisma-class/menu';

// DTO 클래스를 사용하지 않고 최소한의 런타임 검증만 수행합니다.

@ApiTags('menus')
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: '메뉴 조회',
    type: MenuEntity,
  })
  findAll() {
    return this.menusService.findAll();
  }

  @Get('access/user/:userId')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자 기준 접근 가능한 메뉴 ID 목록' })
  async getUserAccessibleMenus(@Param('userId') userId: string) {
    const menuIds = await this.menusService.getUserAccessibleMenuIds(userId);
    return { userId, menuIds };
  }

  @Patch('access/user/:userId')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자의 화면 접근 권한(메뉴) 업데이트' })
  @ApiBody({
    description: '사용자의 화면 접근 권한(메뉴) 업데이트',
    schema: {
      type: 'object',
      properties: {
        menuIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '접근 허용할 메뉴 ID 배열',
        },
      },
      required: ['menuIds'],
    },
  })
  async updateUserAccess(
    @Param('userId') userId: string,
    @Body() body: { menuIds?: unknown },
  ) {
    if (!userId || userId.length === 0) {
      throw new BadRequestException('userId is required');
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }

    if (!Array.isArray(body.menuIds)) {
      throw new BadRequestException('menuIds must be an array');
    }

    // menuIds 배열의 각 요소가 문자열인지 검증
    const validMenuIds = body.menuIds.filter((id) => {
      if (typeof id !== 'string') {
        return false;
      }
      // UUID 형식 검증 (기본적인 길이 체크)
      return id.length > 0;
    }) as string[];

    // 유효하지 않은 항목이 있으면 에러
    if (validMenuIds.length !== body.menuIds.length) {
      throw new BadRequestException('All menuIds must be valid strings');
    }

    const result = await this.menusService.updateUserMenuAccess({
      userId,
      menuIds: validMenuIds,
    });
    return { userId, ...result };
  }
}
