import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { getEnvProtectionInstance } from '../middleware/env-protection-singleton';

@Module({
  controllers: [SecurityController],
  providers: [
    {
      provide: 'EnvProtectionMiddleware',
      useFactory: () => getEnvProtectionInstance(),
    },
  ],
  exports: ['EnvProtectionMiddleware'],
})
export class SecurityModule {}
