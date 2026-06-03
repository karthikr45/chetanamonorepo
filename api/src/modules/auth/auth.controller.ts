import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
// Brute-force protection: at most 10 auth attempts per minute per IP.
@Throttle({ default: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary:
      'Sign in with email + password. Returns either tokens (single tenant) ' +
      'or a tenant-picker payload (multiple matches).',
  })
  async signin(@Body() dto: LoginDto) {
    const result = await this.authService.signIn(dto.email, dto.password);
    if (result.kind === 'tokens') {
      return {
        message: 'Login successfully',
        response: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.user.tenantId,
          tenantName: result.user.tenantName,
          branch: result.user.branch,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      };
    }
    return {
      message: 'Choose a tenant to continue',
      requireTenantSelection: true,
      response: {
        email: result.email,
        selectionToken: result.selectionToken,
        tenants: result.tenants,
      },
    };
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a selection token + chosen tenant for real tokens.',
  })
  async selectTenant(@Body() dto: SelectTenantDto) {
    const result = await this.authService.selectTenant(
      dto.selectionToken,
      dto.adminId,
    );
    return {
      message: 'Tenant selected',
      response: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.user.tenantId,
        tenantName: result.user.tenantName,
        branch: result.user.branch,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email a password-reset link (always 200, no account enumeration)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(
      dto.email,
      dto.token,
      dto.newPassword,
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an admin email using a verification token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email a fresh verification link (always 200, no enumeration)',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.sendVerificationEmail(dto.email);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns new access + refresh tokens' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: any) {
    await this.authService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Returns the current authenticated user' })
  me(@CurrentUser() user: any) {
    return user;
  }
}
