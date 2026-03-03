import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // API 경로 확인 함수
    const isApiPath = (url: string) => {
      // 쿼리 파라미터 제거하여 경로만 확인
      const pathOnly = url.split('?')[0];

      return (
        pathOnly.startsWith('/api/') ||
        pathOnly.startsWith('/dept/') ||
        pathOnly.startsWith('/user/') ||
        pathOnly.startsWith('/daily-record') ||
        pathOnly.startsWith('/approval/') ||
        pathOnly.startsWith('/dash/') ||
        pathOnly.startsWith('/auth/') ||
        pathOnly.startsWith('/board/') ||
        pathOnly.startsWith('/buyer/') ||
        pathOnly.startsWith('/duty/') ||
        pathOnly.startsWith('/fixture/') ||
        pathOnly.startsWith('/in-company/') ||
        pathOnly.startsWith('/media/') ||
        pathOnly.startsWith('/pos/') ||
        pathOnly.startsWith('/project/') ||
        pathOnly.startsWith('/docs')
      );
    };

    // 요청 로깅 (디버깅용)
    this.logger.log(
      `Security Middleware: ${req.method} ${req.url} - API Path: ${isApiPath(req.url)}`,
    );

    // API 경로는 모든 보안 검사를 건너뛰고 바로 통과
    if (isApiPath(req.url)) {
      this.logger.log(
        `API Path detected, skipping security checks: ${req.url}`,
      );
      return next();
    }

    // X-Forwarded-For 헤더 검증
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
      const ips = forwardedFor.split(',').map((ip) => ip.trim());
      if (ips.length > 5) {
        this.logger.warn(`Suspicious X-Forwarded-For header: ${forwardedFor}`);
        return res.status(400).json({ message: '잘못된 요청입니다.' });
      }
    }

    // User-Agent 검증
    const userAgent = req.headers['user-agent'];
    if (!userAgent || userAgent.length > 500) {
      this.logger.warn(`Suspicious User-Agent: ${userAgent}`);
      return res.status(400).json({ message: '잘못된 요청입니다.' });
    }

    // 요청 크기 제한
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 10 * 1024 * 1024) {
      // 10MB
      this.logger.warn(`Request too large: ${contentLength} bytes`);
      return res.status(413).json({ message: '요청 크기가 너무 큽니다.' });
    }

    // SQL Injection 패턴 검사 (더 정교한 패턴)
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\s+.*\b(FROM|INTO|SET|WHERE|VALUES)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
      /(\bUNION\s+SELECT\b)/i,
      /(\bDROP\s+TABLE\b)/i,
      /(\bINSERT\s+INTO\b)/i,
      /(\bUPDATE\s+.*\s+SET\b)/i,
      /(\bDELETE\s+FROM\b)/i,
    ];

    const checkSqlInjection = (value: string) => {
      return sqlPatterns.some((pattern) => pattern.test(value));
    };

    // URL 파라미터 검사 (API 경로 제외)
    const url = req.url;
    if (!isApiPath(url)) {
      if (checkSqlInjection(url)) {
        this.logger.warn(`Potential SQL injection in URL: ${url}`);
        return res.status(400).json({ message: '잘못된 요청입니다.' });
      }
    }

    // 쿼리 파라미터 검사 (API 경로 제외)
    const queryString = req.url.split('?')[1];
    if (queryString && !isApiPath(url)) {
      if (checkSqlInjection(queryString)) {
        this.logger.warn(`Potential SQL injection in query: ${queryString}`);
        return res.status(400).json({ message: '잘못된 요청입니다.' });
      }
    }

    // XSS 패턴 검사 (API 경로 제외)
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];

    const checkXss = (value: string) => {
      return xssPatterns.some((pattern) => pattern.test(value));
    };

    if (!isApiPath(url)) {
      if (checkXss(url)) {
        this.logger.warn(`Potential XSS in URL: ${url}`);
        return res.status(400).json({ message: '잘못된 요청입니다.' });
      }
    }

    // 요청 로깅
    this.logger.log(`${req.method} ${req.url} - ${req.ip} - ${userAgent}`);

    next();
  }
}
