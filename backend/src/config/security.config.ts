import { ipKeyGenerator } from 'express-rate-limit';

export const securityConfig = {
  // Rate Limiting 설정
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 최대 요청 수 (권한 체크 고려하여 증가)
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    standardHeaders: true,
    legacyHeaders: false,
    // IPv6 주소를 올바르게 처리하는 keyGenerator 사용
    keyGenerator: (req: any) => {
      // ipKeyGenerator를 사용하여 IPv6 주소를 안전하게 처리
      const ip = ipKeyGenerator(req);

      // 프록시 환경에서 올바른 클라이언트 IP 식별
      const xf = req.headers['x-forwarded-for'];
      if (typeof xf === 'string' && xf.length > 0) {
        const clientIp = xf.split(',')[0].trim();
        // ipKeyGenerator를 사용하여 IPv6 주소를 안전하게 처리
        const safeIp = ipKeyGenerator({ ...req, ip: clientIp });
        return `${req.method}:${req.url}:${safeIp}`;
      }
      const xr = req.headers['x-real-ip'];
      if (typeof xr === 'string' && xr.length > 0) {
        const safeIp = ipKeyGenerator({ ...req, ip: xr.trim() });
        return `${req.method}:${req.url}:${safeIp}`;
      }
      // 기본 IP 사용 (ipKeyGenerator로 안전하게 처리)
      return `${req.method}:${req.url}:${ip}`;
    },
    // 불필요한 요청은 카운트에서 제외
    skip: (req: any) => {
      const url: string = req.url || '';
      if (req.method === 'OPTIONS') return true; // CORS preflight 제외
      // 정적/문서/헬스체크/권한체크 API 제외
      return (
        url.startsWith('/_next/') ||
        url.startsWith('/static/') ||
        url === '/favicon.ico' ||
        url.startsWith('/docs') ||
        url.startsWith('/health') ||
        url === '/user/my-menus' // 권한 체크 API 제외 (보안상 중요)
      );
    },
  },

  // CORS 설정
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://3.34.5.86:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'access-token'],
    exposedHeaders: ['access-token'],
    maxAge: 86400, // 24시간
  },

  // Helmet 설정 (HTTPS 강제 적용)
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true,
      force: process.env.NODE_ENV === 'production', // 운영환경에서만 강제 적용
    },
    // 운영환경에서 HTTPS 강제 리다이렉트
    forceHTTPS: process.env.NODE_ENV === 'production',
  },

  // Morgan 로깅 설정
  morgan: {
    format: 'combined',
    skip: (req: any, res: any) => {
      // 정적 파일이나 헬스체크는 로그에서 제외
      return (
        req.url?.includes('/docs') ||
        req.url?.includes('/favicon.ico') ||
        req.url?.includes('/health')
      );
    },
  },

  // Validation Pipe 설정
  validation: {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true, // class-transformer 활성화
    disableErrorMessages: process.env.NODE_ENV === 'production',
    transformOptions: {
      enableImplicitConversion: true,
    },
  },
};
