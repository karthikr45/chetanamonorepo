import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantConfigsService } from '../tenant-configs/tenant-configs.service';

/**
 * Login-free parent-portal config surface. Used by both the authenticated
 * portal and the public parent-pay page: the client passes its
 * `window.location.href`, the server resolves the matching tenant config by
 * domain (preferring the config whose environment_type matches APP_ENV) and
 * returns the non-secret display config — branding + privacy / terms /
 * refund policy URLs.
 *
 * Intentionally public (no auth) so the public pay page can render the
 * policy links before any login.
 */
@ApiTags('parent-portal')
@Controller('parent')
export class ParentPortalPublicController {
  constructor(private readonly tenantConfigs: TenantConfigsService) {}

  @Get('config')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary:
      "Resolve the parent-portal config (branding + policy URLs) for the caller's domain",
    description:
      'Pass the browser `window.location.href` as `url`. The server matches ' +
      'its host against tenant_configurations.domain_url and returns the ' +
      'config for the running app environment (APP_ENV). No secrets are ' +
      'returned.',
  })
  async config(@Query('url') url: string) {
    if (!url?.trim()) {
      throw new BadRequestException('url query parameter is required');
    }
    const cfg = await this.tenantConfigs.resolvePublicByUrl(url);
    if (!cfg) {
      throw new NotFoundException('No school is configured for this domain.');
    }
    return cfg;
  }
}
