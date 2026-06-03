import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { SocialPost } from './entities/social-post.entity';
import { SocialPostImage } from './entities/social-post-image.entity';
import { SocialComment } from './entities/social-comment.entity';
import { SocialReaction } from './entities/social-reaction.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocialPost,
      SocialPostImage,
      SocialComment,
      SocialReaction,
      Admin,
      Tenant,
    ]),
    StorageModule,
  ],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
