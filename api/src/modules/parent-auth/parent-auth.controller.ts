import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParentAuthService } from './parent-auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ParentRefreshTokenDto } from './dto/refresh-token.dto';
import { ParentSelectTenantDto } from './dto/select-tenant.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('parent-auth')
@Controller('parent/auth')
// OTP request + verify are the highest-abuse surface — 8/min/IP.
@Throttle({ default: { ttl: 60_000, limit: 8 } })
export class ParentAuthController {
  constructor(private readonly parentAuthService: ParentAuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit OTP to a parent email' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.parentAuthService.sendOtp(dto.email, dto.tenantCode);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive access + refresh tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.parentAuthService.verifyOtp(dto.email, dto.otp, dto.tenantCode);
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pick a school after OTP when the email spans multiple tenants',
  })
  selectTenant(@Body() dto: ParentSelectTenantDto) {
    return this.parentAuthService.selectTenant(
      dto.selectionToken,
      dto.parentId,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token, issue new pair' })
  refresh(@Body() dto: ParentRefreshTokenDto) {
    return this.parentAuthService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@CurrentUser() user: any) {
    await this.parentAuthService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }
}
