import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt-access-token') {
  private readonly logger = new Logger(AccessTokenGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      // 간단한 로그인 실패 로그
      this.logger.warn('🔒 인증 실패');

      // 구체적인 실패 원인에 따른 메시지
      let failureReason = '인증에 실패했습니다.';

      if (err?.name === 'TokenExpiredError') {
        failureReason = '로그인 토큰이 만료되었습니다.';
      } else if (err?.name === 'JsonWebTokenError') {
        failureReason = '유효하지 않은 토큰입니다.';
      } else if (!user) {
        failureReason = '로그인 토큰이 제공되지 않았습니다.';
      }

      // 401 Unauthorized 예외로 던지기 (500 에러 방지)
      throw new UnauthorizedException({
        message: failureReason,
        error: 'Unauthorized',
        statusCode: 401,
      });
    }

    return user;
  }
}
