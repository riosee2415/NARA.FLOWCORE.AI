import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserEntity } from 'src/_gen/prisma-class/user';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { Prisma } from '@prisma/client';

// CUID 검증을 위한 커스텀 파이프
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

// TYPE

@Injectable()
export class ParseCuidPipe implements PipeTransform {
  transform(value: string) {
    // CUID 형식 검증: c로 시작하고 25자리인지 확인
    const cuidRegex = /^c[a-z0-9]{24}$/;
    if (!cuidRegex.test(value)) {
      throw new BadRequestException('Invalid CUID format');
    }
    return value;
  }
}

@ApiTags('사용자')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 모든 사용자 목록 조회 (관리자 메뉴 권한 설정용)
   */
  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: '사용자 목록 조회',
    type: [UserEntity],
  })
  findAll() {
    return this.userService.findAll();
  }

  @Get('my-menus')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: '현재 로그인된 사용자의 접근 가능 메뉴 목록' })
  getMyMenus(@Req() req: Request) {
    const userId = (req as Request & { user?: { sub?: string } }).user?.sub;
    return this.userService.getMyMenus(userId as string);
  }
}
