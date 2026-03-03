import { EnvProtectionMiddleware } from './env-protection.middleware';

// 전역 싱글톤 인스턴스
let envProtectionInstance: EnvProtectionMiddleware | null = null;

export function getEnvProtectionInstance(): EnvProtectionMiddleware {
  if (!envProtectionInstance) {
    envProtectionInstance = new EnvProtectionMiddleware();
  }
  return envProtectionInstance;
}
