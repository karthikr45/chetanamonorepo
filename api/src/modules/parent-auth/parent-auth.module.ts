import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ParentsModule } from '../parents/parents.module';
import { ParentOtp } from './entities/otp.entity';
import { ParentAuthService } from './parent-auth.service';
import { ParentAuthController } from './parent-auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParentOtp, Tenant]),
    ParentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: Number(config.get('jwt.expiresIn')) || 86400,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ParentAuthService],
  controllers: [ParentAuthController],
  exports: [ParentAuthService],
})
export class ParentAuthModule {}
