import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fee } from './entities/fee.entity';
import { FeePayment } from './entities/fee-payment.entity';
import { FeeAdjustment } from './entities/fee-adjustment.entity';
import { ReceiptSequence } from './entities/receipt-sequence.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { Student } from '../students/entities/student.entity';
import { FeesService } from './fees.service';
import { StudentFeesService } from './student-fees.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptStorageService } from './receipt-storage.service';
import { FeesController } from './fees.controller';
import { ReceiptTemplatesModule } from '../receipt-templates/receipt-templates.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Fee,
      FeePayment,
      FeeAdjustment,
      ReceiptSequence,
      Tenant,
      TenantConfig,
      Student,
    ]),
    ReceiptTemplatesModule,
    forwardRef(() => ApprovalsModule),
    StorageModule,
  ],
  controllers: [FeesController],
  providers: [
    FeesService,
    StudentFeesService,
    ReceiptPdfService,
    ReceiptStorageService,
  ],
  exports: [
    FeesService,
    StudentFeesService,
    ReceiptPdfService,
    ReceiptStorageService,
  ],
})
export class FeesModule {}
