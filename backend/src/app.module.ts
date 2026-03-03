import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { MediaModule } from './media/media.module';
import { MenusModule } from './menus/menus.module';
import { AdminPermissionService } from './auth/admin-permission.service';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    UserModule,
    MediaModule,
    MenusModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminPermissionService],
})
export class AppModule {}
