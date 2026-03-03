import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
const morgan = require('morgan');
const hpp = require('hpp');
const helmet = require('helmet');
const compression = require('compression');
import { rateLimit } from 'express-rate-limit';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { securityConfig } from './config/security.config';
import { getEnvProtectionInstance } from './middleware/env-protection-singleton';
import { AdminPermissionService } from './auth/admin-permission.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 프록시 신뢰 설정 (X-Forwarded-For/Proto 사용 시 필수)
  // Nest의 Express 인스턴스에 직접 설정해야 함
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', 1);

  // 요청 본문 크기 제한 설정은 NestJS 기본값 사용 (기본 1MB)
  // 필요시 MulterModule을 통해 파일 업로드 크기 조정 가능

  // 보안 미들웨어 설정
  app.use(helmet(securityConfig.helmet));

  // .env 파일 접근 차단 미들웨어 (최우선 적용)
  const envProtectionMiddleware = getEnvProtectionInstance();
  app.use(envProtectionMiddleware.use.bind(envProtectionMiddleware));

  // 커스텀 보안 미들웨어
  // app.use(new SecurityMiddleware().use.bind(new SecurityMiddleware()));

  // HPP (Hidden HTTP Parameter Pollution) 보호
  app.use(hpp());

  // 압축 미들웨어
  app.use(compression());

  // Rate Limiting 설정
  app.use(rateLimit(securityConfig.rateLimit));

  // Morgan 로깅 설정
  app.use(morgan(securityConfig.morgan.format, securityConfig.morgan));

  // 전역 유효성 검사 파이프 (UUID/CUID validation 문제로 인해 임시 비활성화)
  // SecurityMiddleware와 AccessTokenGuard 등 다른 보안 시스템이 구축되어 있어 안전
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //     disableErrorMessages: process.env.NODE_ENV === 'production',
  //   }),
  // );

  // CORS 설정 (단순화)
  app.enableCors({
    origin: true, // 모든 origin 허용
    credentials: true,
  });

  // 루트 경로에 대한 핸들러 추가 (전역 프리픽스 적용 전에 등록)
  app.getHttpAdapter().get('/', (req, res) => {
    res.json({
      message: 'Hello World!',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // 전역 프리픽스 적용: 모든 API를 /api 하위로 노출
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('공식 API 문서')
    .setDescription('기술연구소 공식 API 문서입니다.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'access-token',
        description: 'Enter access token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // JSON 엔드포인트 노출 (/api/docs-json)
  app.use('/api/docs-json', (req, res) => res.json(document));
  SwaggerModule.setup('api/docs', app, document);

  // 프로덕션 환경에서 Swagger 비활성화
  if (process.env.NODE_ENV === 'production') {
    app.use('/api/docs', (req, res) => {
      res
        .status(404)
        .json({ message: 'API 문서는 프로덕션 환경에서 비활성화되었습니다.' });
    });
  }

  // 전역 예외 필터 설정
  app.useGlobalFilters(new HttpExceptionFilter());

  // 프론트 라우트 폴백: 비-API 경로로 들어온 요청은 프론트엔드로 리다이렉트
  // 인프라 라우팅이 정리되기 전까지 임시 안전장치로 사용 가능
  // const frontendOrigin = process.env.FRONTEND_ORIGIN;
  // app.use((req, res, next) => {
  //   const pathOnly = (req.url || '').split('?')[0];
  //   const isApi =
  //     pathOnly.startsWith('/api/') ||
  //     pathOnly.startsWith('/dept/') ||
  //     pathOnly.startsWith('/user/') ||
  //     pathOnly.startsWith('/daily-record') ||
  //     pathOnly.startsWith('/approval/') ||
  //     pathOnly.startsWith('/auth/') ||
  //     pathOnly.startsWith('/board/') ||
  //     pathOnly.startsWith('/buyer/') ||
  //     pathOnly.startsWith('/duty/') ||
  //     pathOnly.startsWith('/fixture/') ||
  //     pathOnly.startsWith('/in-company/') ||
  //     pathOnly.startsWith('/media/') ||
  //     pathOnly.startsWith('/pos/') ||
  //     pathOnly.startsWith('/project/') ||
  //     pathOnly.startsWith('/api/docs');

  //   if (isApi) return next();

  //   if (frontendOrigin) {
  //     const redirectTo = frontendOrigin + req.url;
  //     return res.redirect(302, redirectTo);
  //   }
  //   return next();
  // });

  // 관리자 권한 초기화 (서버 시작 시 최초 1회 실행)
  try {
    const adminPermissionService = app.get(AdminPermissionService);
    await adminPermissionService.initializeAdminPermissions();
  } catch (error) {
    console.error('❌ 관리자 권한 초기화 실패:', error);
    // 권한 초기화 실패해도 서버는 계속 실행
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`📚 API 문서: http://localhost:${port}/docs`);
  console.log(`🔒 보안 설정이 활성화되었습니다.`);
}

bootstrap();
