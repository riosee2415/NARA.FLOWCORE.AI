import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import os from 'os';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class EnvProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnvProtectionMiddleware.name);
  private readonly blockedIPs = new Set<string>();
  private readonly safeIPs = new Set<string>();
  // 5xx 응답 감지용 카운터 (메모리 기반)
  private readonly serverErrorCounter = new Map<
    string,
    { count: number; firstAt: number }
  >();
  private readonly serverErrorWindowMs = 60 * 1000; // 관찰 윈도우: 60초
  private readonly serverErrorThreshold = 5; // 윈도우 내 5회 이상 5xx 발생 시 차단
  // 4xx(특히 401/403/404) 응답 과다 발생 감지용 카운터 (봇 탐색/브루트포스/스캐닝)
  private readonly clientErrorCounter = new Map<
    string,
    { count: number; firstAt: number }
  >();
  private readonly clientErrorWindowMs = 60 * 1000; // 60초
  private readonly clientErrorThreshold = 20; // 윈도우 내 20회 이상 4xx 발생 시 차단
  // 임시 차단 해제를 위한 만료시간 기억 (지속 차단 원하면 두지 않음)
  private readonly temporaryBanUntil = new Map<string, number>();
  private readonly temporaryBanMs = 30 * 60 * 1000; // 30분 임시 차단
  // 동시 요청 및 초당 요청 스파이크 제한
  private readonly inFlightByIp = new Map<string, number>();
  private readonly maxInFlightPerIp = 20; // IP당 동시 처리 한도
  private readonly rpsWindowMs = 1000; // 1초 윈도우
  private readonly maxReqPerWindow = 30; // 1초에 30건 초과 시 차단
  private readonly rpsCounter = new Map<
    string,
    { count: number; firstAt: number }
  >();
  private readonly suspiciousPaths = [
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.development',
    '/.env.test',
    '/env',
    '/environment',
    '/config',
    '/config/.env',
    '/config/env',
    '/.aws/credentials',
    '/aws/credentials',
    '/.dockerignore',
    '/docker-compose.yml',
    '/docker-compose.yaml',
    '/Dockerfile',
    '/.git/config',
    '/.git/HEAD',
    '/.gitignore',
    '/.ssh',
    '/.vscode',
    '/.DS_Store',
    '/package.json',
    '/composer.json',
    '/wp-config.php',
    '/wp-login.php',
    '/xmlrpc.php',
    '/config.php',
    '/.htaccess',
    '/robots.txt',
    '/sitemap.xml',
    '/admin',
    '/wp-admin',
    '/phpmyadmin',
    '/server-status',
    '/.well-known',
    // 프레임워크/관리 콘솔/디폴트 엔드포인트
    '/console',
    '/actuator',
    '/actuator/env',
    '/manager/html',
    '/hudson',
    '/jenkins',
    '/solr/admin/info/system',
    '/api/jsonws',
    '/HNAP1',
    '/boaform/admin/formLogin',
    '/wp-json/wp/v2/users',
    '/vendor/phpunit',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/phpunit',
    '/autodiscover/autodiscover.json',
    '/owa/auth/logon.aspx',
    '/telescope/requests',
    '/_ignition/execute-solution',
    '/graphql',
    '/shell',
    '/cmd',
    '/cgi-bin',
  ];

  private readonly suspiciousUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'zap',
    'burp',
    'dirb',
    'dirbuster',
    'gobuster',
    'wfuzz',
    'ffuf',
    'curl',
    'wget',
    'python-requests',
    'python-urllib',
    'java',
    'scanner',
    'bot',
    'crawler',
    'spider',
    'okhttp',
    'libwww-perl',
    'httpclient',
  ];

  // 악성 스크립트/툴에서 자주 노리는 확장자/파일명
  private readonly suspiciousExtensions = [
    '.php',
    '.php3',
    '.phtml',
    '.asp',
    '.aspx',
    '.jsp',
    '.jspx',
    '.cgi',
    '.pl',
    '.py',
    '.rb',
    '.sh',
    '.tar',
    '.tar.gz',
    '.7z',
    '.bak',
    '.backup',
    '.old',
  ];
  private readonly suspiciousFileNames = [
    'id_rsa',
    'id_dsa',
    'shadow',
    'passwd',
    'webshell',
    'phpinfo.php',
    'info.php',
    'test.php',
    'config.php.bak',
    'config.old',
  ];
  private readonly suspiciousQueryKeys = [
    'cmd',
    'exec',
    'execute',
    'system',
    'shell',
    'password',
    'passwd',
    'file',
    'path',
    'url',
    'redirect',
  ];

  constructor() {
    // 기본 안전 IP: 루프백 및 서버 NIC 주소들
    ['127.0.0.1', '::1'].forEach((ip) => this.safeIPs.add(ip));
    try {
      const nets = os.networkInterfaces();
      Object.values(nets).forEach((infos) => {
        (infos || []).forEach((ni) => {
          if (ni?.address) {
            this.safeIPs.add(this.normalizeIP(ni.address));
          }
        });
      });
    } catch (_e) {}

    // 환경변수 SAFE_IPS="ip1,ip2" 로 추가 화이트리스트 지정 가능
    const extra = process.env.SAFE_IPS || '';
    extra
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((ip) => this.safeIPs.add(this.normalizeIP(ip)));
  }

  use(req: Request, res: Response, next: NextFunction) {
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const path = req.path.toLowerCase();

    // 서버 자체/화이트리스트 IP는 차단 대상에서 제외
    if (this.safeIPs.has(clientIP)) {
      return next();
    }

    // 임시/영구 차단 확인 (요청 초기에 확인)
    if (this.blockedIPs.has(clientIP)) {
      const until = this.temporaryBanUntil.get(clientIP);
      if (until && Date.now() > until) {
        this.blockedIPs.delete(clientIP);
        this.temporaryBanUntil.delete(clientIP);
      } else {
        this.logger.warn(`🚫 차단된 IP 접근 시도(사전 차단)`, {
          ip: clientIP,
          userAgent,
          path: req.path,
          method: req.method,
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'IP blocked due to suspicious activity',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 동시 요청 제한 (in-flight)
    const currentInFlight = (this.inFlightByIp.get(clientIP) || 0) + 1;
    this.inFlightByIp.set(clientIP, currentInFlight);
    if (currentInFlight > this.maxInFlightPerIp) {
      // 즉시 임시 차단 및 거절
      const until = Date.now() + this.temporaryBanMs;
      this.blockedIPs.add(clientIP);
      this.temporaryBanUntil.set(clientIP, until);
      this.logger.warn(`⛔ 동시 요청 한도 초과로 임시 차단`, {
        ip: clientIP,
        userAgent,
        path: req.path,
        method: req.method,
        inFlight: currentInFlight,
        limit: this.maxInFlightPerIp,
        banUntil: new Date(until).toISOString(),
      });
      // 감소 처리 후 거절
      this.inFlightByIp.set(clientIP, Math.max(0, currentInFlight - 1));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many concurrent requests from your IP.',
        timestamp: new Date().toISOString(),
      });
    }

    // RPS 제한 (1초 윈도우)
    const nowTs = Date.now();
    const rpsEntry = this.rpsCounter.get(clientIP);
    if (!rpsEntry || nowTs - rpsEntry.firstAt > this.rpsWindowMs) {
      this.rpsCounter.set(clientIP, { count: 1, firstAt: nowTs });
    } else {
      rpsEntry.count += 1;
      this.rpsCounter.set(clientIP, rpsEntry);
      if (rpsEntry.count > this.maxReqPerWindow) {
        const until = nowTs + this.temporaryBanMs;
        this.blockedIPs.add(clientIP);
        this.temporaryBanUntil.set(clientIP, until);
        this.logger.warn(`⚠️ 초당 요청 한도 초과로 임시 차단`, {
          ip: clientIP,
          userAgent,
          path: req.path,
          method: req.method,
          rpsCount: rpsEntry.count,
          limit: this.maxReqPerWindow,
          banUntil: new Date(until).toISOString(),
        });
        // 감소 처리 후 거절
        this.inFlightByIp.set(clientIP, Math.max(0, currentInFlight - 1));
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 의심스러운 경로 접근 시도 감지
    const isSuspiciousPath = this.suspiciousPaths.some((suspiciousPath) =>
      path.includes(suspiciousPath.toLowerCase()),
    );

    // 확장자/파일명 기반 의심 파일 접근 감지
    const lowerPath = path;
    const isSuspiciousExtension = this.suspiciousExtensions.some((ext) =>
      lowerPath.endsWith(ext),
    );
    const isSuspiciousFileName = this.suspiciousFileNames.some((name) =>
      lowerPath.includes(`/${name}`),
    );

    // 쿼리키 기반 의심 동작 감지
    const queryKeys = Object.keys(req.query || {}).map((k) => k.toLowerCase());
    const hasSuspiciousQueryKey = queryKeys.some((k) =>
      this.suspiciousQueryKeys.includes(k),
    );

    // 의심스러운 User-Agent 감지
    const isSuspiciousUserAgent = this.suspiciousUserAgents.some(
      (suspiciousUA) =>
        userAgent.toLowerCase().includes(suspiciousUA.toLowerCase()),
    );

    // 디렉터리 트래버설/인코딩 기반 탐색 차단
    const traversalIndicators = [
      '../',
      '..\\',
      '%2e%2e%2f',
      '%2e%2e/',
      '%252e%252e%252f',
      '%5c',
    ];
    const isTraversalAttempt = traversalIndicators.some((k) =>
      path.includes(k),
    );

    // .env 파일 직접 접근 시도 감지
    const isEnvAccessAttempt =
      path.includes('.env') ||
      path.includes('environment') ||
      (path.includes('config') && path.includes('env'));

    // 위험한 HTTP 메서드 사용 차단
    const dangerousMethods = new Set(['TRACE', 'TRACK', 'DEBUG', 'PROPFIND']);
    const isDangerousMethod = dangerousMethods.has(
      (req.method || '').toUpperCase(),
    );

    if (
      isDangerousMethod ||
      isTraversalAttempt ||
      isEnvAccessAttempt ||
      (isSuspiciousPath && isSuspiciousUserAgent) ||
      isSuspiciousExtension ||
      isSuspiciousFileName ||
      hasSuspiciousQueryKey
    ) {
      // IP 차단
      this.blockedIPs.add(clientIP);
      this.temporaryBanUntil.set(clientIP, Date.now() + this.temporaryBanMs);

      // 상세 로깅
      this.logger.warn(`🚨 .env 접근 시도 감지 및 차단`, {
        ip: clientIP,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        headers: req.headers,
        query: req.query,
        body: req.body,
      });

      // 403 Forbidden 응답
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
    }

    // 이미 차단된 IP인지 확인
    if (this.blockedIPs.has(clientIP)) {
      const until = this.temporaryBanUntil.get(clientIP);
      if (until && Date.now() > until) {
        // 임시 차단 기간 종료 → 해제
        this.blockedIPs.delete(clientIP);
        this.temporaryBanUntil.delete(clientIP);
      } else {
        this.logger.warn(`🚫 차단된 IP 접근 시도`, {
          ip: clientIP,
          userAgent,
          path: req.path,
          method: req.method,
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'IP blocked due to suspicious activity',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 응답 종료 시점에 5xx 여부를 확인하여 공격성 요청 감지
    const startedAt = Date.now();
    res.on('finish', () => {
      // in-flight 감소
      const prev = this.inFlightByIp.get(clientIP) || 1;
      const nextVal = Math.max(0, prev - 1);
      if (nextVal === 0) this.inFlightByIp.delete(clientIP);
      else this.inFlightByIp.set(clientIP, nextVal);

      const status = res.statusCode;
      // 서버 내부 오류(5xx) 발생 시, IP 기반 카운트 증가
      if (status >= 500 && status < 600) {
        const now = Date.now();
        const entry = this.serverErrorCounter.get(clientIP);
        if (!entry || now - entry.firstAt > this.serverErrorWindowMs) {
          // 새 윈도우 시작
          this.serverErrorCounter.set(clientIP, { count: 1, firstAt: now });
        } else {
          entry.count += 1;
          this.serverErrorCounter.set(clientIP, entry);

          if (entry.count >= this.serverErrorThreshold) {
            this.blockedIPs.add(clientIP);
            this.logger.warn(`🛡️ 5xx 반복 발생으로 IP 차단`, {
              ip: clientIP,
              userAgent,
              path: req.path,
              method: req.method,
              status,
              errorCountInWindow: entry.count,
              windowMs: this.serverErrorWindowMs,
              durationMs: now - entry.firstAt,
              startedAt,
              finishedAt: now,
            });
          }
        }
      }

      // 4xx(401/403/404 등) 반복 발생 시 임시 차단
      if (status >= 400 && status < 500) {
        const now = Date.now();
        const entry = this.clientErrorCounter.get(clientIP);
        if (!entry || now - entry.firstAt > this.clientErrorWindowMs) {
          this.clientErrorCounter.set(clientIP, { count: 1, firstAt: now });
        } else {
          entry.count += 1;
          this.clientErrorCounter.set(clientIP, entry);

          if (entry.count >= this.clientErrorThreshold) {
            this.blockedIPs.add(clientIP);
            const until = now + this.temporaryBanMs;
            this.temporaryBanUntil.set(clientIP, until);
            this.logger.warn(`🛡️ 4xx 과다 발생으로 임시 IP 차단`, {
              ip: clientIP,
              userAgent,
              path: req.path,
              method: req.method,
              status,
              errorCountInWindow: entry.count,
              windowMs: this.clientErrorWindowMs,
              banUntil: new Date(until).toISOString(),
            });
          }
        }
      }
    });

    next();
  }

  private getClientIP(req: Request): string {
    // 프록시를 통한 실제 IP 추출
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    const cfConnectingIP = req.get('CF-Connecting-IP');

    const pick =
      cfConnectingIP ||
      xRealIP ||
      (xForwardedFor ? xForwardedFor.split(',')[0].trim() : '') ||
      req.ip ||
      (req.connection as any).remoteAddress ||
      'unknown';

    return this.normalizeIP(pick);
  }

  /**
   * IPv6-mapped IPv4 (e.g., ::ffff:192.168.0.22) 등을 표준 IPv4 문자열로 정규화
   */
  private normalizeIP(ip: string): string {
    if (!ip) return 'unknown';
    // 헤더에 포트가 포함되어 오는 경우 제거 (e.g., 203.0.113.5:12345)
    const withoutPort =
      ip.includes(':') && !ip.startsWith('[')
        ? ip.split(':').filter((seg) => seg !== '').length > 2
          ? ip // IPv6로 판단
          : ip.split(':')[0]
        : ip;

    // IPv6-mapped IPv4
    if (withoutPort.startsWith('::ffff:')) {
      return withoutPort.replace('::ffff:', '');
    }

    // 대괄호가 포함된 IPv6 주소 표준화 [2001:db8::1]
    if (withoutPort.startsWith('[') && withoutPort.endsWith(']')) {
      return withoutPort.slice(1, -1);
    }

    return withoutPort;
  }

  // 차단된 IP 목록 조회 (관리용)
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  // IP 차단 해제 (관리용)
  unblockIP(ip: string): boolean {
    return this.blockedIPs.delete(ip);
  }

  // 모든 차단 해제 (관리용)
  clearBlockedIPs(): void {
    this.blockedIPs.clear();
  }
}
