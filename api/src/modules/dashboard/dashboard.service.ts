import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { FeePayment, ClearanceStatus } from '../fees/entities/fee-payment.entity';

export interface PlatformSummary {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    byType: { type: string; count: number }[];
    recent: { id: string; name: string; type: string | null; createdAt: Date }[];
  };
  admins: {
    total: number;
    byRole: { role: string; count: number }[];
  };
  students: { total: number };
  payments: {
    receivedThisMonth: string;
    receivedLastMonth: string;
    pendingClearance: string;
  };
  fees: {
    outstandingBalance: string;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Student) private readonly studentRepo: Repository<Student>,
    @InjectRepository(Fee) private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeePayment)
    private readonly paymentRepo: Repository<FeePayment>,
  ) {}

  async getPlatformSummary(): Promise<PlatformSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      tenantsTotal,
      tenantsActive,
      adminsTotal,
      studentsTotal,
    ] = await Promise.all([
      this.tenantRepo.count(),
      this.tenantRepo.count({ where: { isActive: true } }),
      this.adminRepo.count({ where: { isActive: true } }),
      this.studentRepo.count(),
    ]);

    const tenantsByTypeRaw = await this.tenantRepo
      .createQueryBuilder('t')
      .select('COALESCE(t.type, \'School\')', 'type')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('t.type')
      .getRawMany<{ type: string; count: number }>();

    const recentTenants = await this.tenantRepo
      .createQueryBuilder('t')
      .select(['t.id AS id', 't.tenantName AS name', 't.type AS type', 't.createdAt AS "createdAt"'])
      .orderBy('t.createdAt', 'DESC')
      .limit(5)
      .getRawMany<{ id: string; name: string; type: string | null; createdAt: Date }>();

    const adminsByRoleRaw = await this.adminRepo
      .createQueryBuilder('a')
      .select('a.role', 'role')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.isActive = TRUE')
      .groupBy('a.role')
      .getRawMany<{ role: string; count: number }>();

    // Cleared payments this month / last month
    const sumPayments = async (from: Date, to: Date | null): Promise<string> => {
      const qb = this.paymentRepo
        .createQueryBuilder('fp')
        .select('COALESCE(SUM(fp.amount), 0)', 'total')
        // Settled ledger entries only — exclude unrecognised gateway orders.
        .where('fp.receipt_number IS NOT NULL')
        .andWhere('fp.clearanceStatus IN (:...statuses)', {
          statuses: [ClearanceStatus.CLEARED, ClearanceStatus.NA],
        })
        .andWhere('fp.paidAt >= :from', { from });
      if (to) qb.andWhere('fp.paidAt < :to', { to });
      const row = await qb.getRawOne<{ total: string }>();
      return Number(row?.total ?? 0).toFixed(2);
    };

    const [receivedThisMonth, receivedLastMonth] = await Promise.all([
      sumPayments(monthStart, null),
      sumPayments(lastMonthStart, lastMonthEnd),
    ]);

    // Pending clearance (cheque/DD not yet cleared)
    const pendingRow = await this.paymentRepo
      .createQueryBuilder('fp')
      .select('COALESCE(SUM(fp.amount), 0)', 'total')
      .where('fp.clearanceStatus = :p', { p: ClearanceStatus.PENDING })
      .getRawOne<{ total: string }>();

    // Outstanding balance across all fees
    const outstandingRow = await this.feeRepo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.netAmount - f.paidAmount), 0)', 'total')
      .getRawOne<{ total: string }>();

    return {
      tenants: {
        total: tenantsTotal,
        active: tenantsActive,
        inactive: tenantsTotal - tenantsActive,
        byType: tenantsByTypeRaw.map((r) => ({ type: r.type, count: Number(r.count) })),
        recent: recentTenants,
      },
      admins: {
        total: adminsTotal,
        byRole: adminsByRoleRaw.map((r) => ({ role: r.role, count: Number(r.count) })),
      },
      students: { total: studentsTotal },
      payments: {
        receivedThisMonth,
        receivedLastMonth,
        pendingClearance: Number(pendingRow?.total ?? 0).toFixed(2),
      },
      fees: {
        outstandingBalance: Number(outstandingRow?.total ?? 0).toFixed(2),
      },
    };
  }
}
