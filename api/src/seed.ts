/**
 * SVBK Seed Script — bootstrap essentials only
 * Usage:  pnpm --filter @svbk/api seed
 *
 * Seeds just what a fresh install needs:
 *   1. Super-admin login
 *   2. System metadata (reference data + starter receipt template)
 *
 * No demo tenant / admin / student / fee / parent data — those are created
 * through the app. Idempotent: re-runnable, skips anything already present.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { Admin } from './modules/admins/entities/admin.entity';
import { SystemMetadata } from './modules/system-metadata/entities/system-metadata.entity';
import { Role } from './common/enums/roles.enum';

const SALT_ROUNDS = 10;

const SUPER_ADMIN = {
  email: 'superadmin@svbk.com',
  password: 'Admin@123',
  firstName: 'Super',
  lastName: 'Admin',
};

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const get = <T extends ObjectLiteral>(entity: any) =>
    app.get<Repository<T>>(getRepositoryToken(entity));

  const adminsRepo = get<Admin>(Admin);
  const metadataRepo = get<SystemMetadata>(SystemMetadata);

  console.log('━'.repeat(60));
  console.log('  SVBK seed — super-admin + system metadata');
  console.log('━'.repeat(60));

  await ensureSuperAdmin(adminsRepo);
  await ensureSystemMetadata(metadataRepo);

  console.log('━'.repeat(60));
  console.log('  ✔ Seed complete');
  console.log('━'.repeat(60));
  console.log('');
  console.log('  Super-admin login (POST /api/auth/signin):');
  console.log(`    email    : ${SUPER_ADMIN.email}`);
  console.log(`    password : ${SUPER_ADMIN.password}`);
  console.log('');

  await app.close();
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureSuperAdmin(repo: Repository<Admin>): Promise<Admin> {
  const existing = await repo
    .findOne({ where: { email: SUPER_ADMIN.email } })
    .catch(() => null);
  if (existing) {
    console.log(`↩  super-admin exists: ${SUPER_ADMIN.email}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, SALT_ROUNDS);
  const created = await repo.save(
    repo.create({
      firstName: SUPER_ADMIN.firstName,
      lastName: SUPER_ADMIN.lastName,
      email: SUPER_ADMIN.email,
      role: Role.SUPER_ADMIN,
      clientId: `client_${randomBytes(8).toString('hex')}`,
      secretKey: randomBytes(32).toString('hex'),
      passwordHash,
    }),
  );
  console.log(`✔  super-admin created: ${created.email}`);
  return created;
}

async function ensureSystemMetadata(
  repo: Repository<SystemMetadata>,
): Promise<void> {
  // Default reference data the super-admin can later edit.
  const defaults: { type: string; value: string; displayOrder: number }[] = [
    // Academic years
    { type: 'academic_year', value: '2024-2025', displayOrder: 1 },
    { type: 'academic_year', value: '2025-2026', displayOrder: 2 },
    { type: 'academic_year', value: '2026-2027', displayOrder: 3 },
    { type: 'academic_year', value: '2027-2028', displayOrder: 4 },
    // Boards
    { type: 'board_type', value: 'CBSE', displayOrder: 1 },
    { type: 'board_type', value: 'ICSE', displayOrder: 2 },
    { type: 'board_type', value: 'State', displayOrder: 3 },
    { type: 'board_type', value: 'IB', displayOrder: 4 },
    // Mediums (TS/AP)
    { type: 'medium', value: 'English', displayOrder: 1 },
    { type: 'medium', value: 'Telugu', displayOrder: 2 },
    { type: 'medium', value: 'Hindi', displayOrder: 3 },
    // Tenant types
    { type: 'tenant_type', value: 'School', displayOrder: 1 },
    { type: 'tenant_type', value: 'Hostel', displayOrder: 2 },
    { type: 'tenant_type', value: 'Transport', displayOrder: 3 },
    // Classes (full range for TS/AP)
    ...['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Inter 1Y', 'Inter 2Y']
      .map((v, i) => ({ type: 'class', value: v, displayOrder: i })),
    // Sections (common)
    ...['A', 'B', 'C', 'D', 'E']
      .map((v, i) => ({ type: 'section', value: v, displayOrder: i })),
    // Inter streams
    ...['MPC', 'BiPC', 'CEC', 'MEC', 'HEC']
      .map((v, i) => ({ type: 'stream', value: v, displayOrder: i })),
    // Admin roles assignable in the Add-Admin / Tenant Users forms.
    // Super-admin can add more here at runtime; permission gating in code
    // is keyed off the four built-ins, so custom roles act as labels only.
    { type: 'admin_role', value: 'admin', displayOrder: 1 },
    { type: 'admin_role', value: 'fin_admin', displayOrder: 2 },
    { type: 'admin_role', value: 'ops_admin', displayOrder: 3 },
    // Term labels — mirror of the TermType enum, used by every fee/penalty/
    // student form. TS/AP schools commonly run 5 terms.
    { type: 'term', value: '1st Term Fee', displayOrder: 1 },
    { type: 'term', value: '2nd Term Fee', displayOrder: 2 },
    { type: 'term', value: '3rd Term Fee', displayOrder: 3 },
    { type: 'term', value: '4th Term Fee', displayOrder: 4 },
    { type: 'term', value: '5th Term Fee', displayOrder: 5 },
    // Billing mode — admin picks per tenant. Transport defaults to
    // monthly; school/hostel default to term-wise.
    { type: 'billing_mode', value: 'term_wise', displayOrder: 1 },
    { type: 'billing_mode', value: 'monthly', displayOrder: 2 },
    // Monthly billing periods (academic year Apr–Mar) used when a
    // tenant's billing mode is monthly (e.g. transport).
    ...[
      'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December', 'January', 'February', 'March',
    ].map((v, i) => ({ type: 'month', value: v, displayOrder: i + 1 })),
    // Fee payment status (mirrors PaymentStatus enum; labels only).
    { type: 'payment_status', value: 'UNPAID', displayOrder: 1 },
    { type: 'payment_status', value: 'PARTIAL', displayOrder: 2 },
    { type: 'payment_status', value: 'PAID', displayOrder: 3 },
    // Cheque / DD clearance lifecycle.
    { type: 'clearance_status', value: 'PENDING', displayOrder: 1 },
    { type: 'clearance_status', value: 'CLEARED', displayOrder: 2 },
    { type: 'clearance_status', value: 'BOUNCED', displayOrder: 3 },
    // Template moderation states.
    { type: 'template_status', value: 'approved', displayOrder: 1 },
    { type: 'template_status', value: 'rejected', displayOrder: 2 },
    // Tenant config dropdowns.
    { type: 'payment_gateway', value: 'Razorpay', displayOrder: 1 },
    { type: 'payment_gateway', value: 'Cashfree', displayOrder: 2 },

    // ── Geography (flat lists; super-admin can extend from the
    // System Metadata UI without a deploy). India-first because the
    // pilot schools are Indian; international schools later just add
    // more rows under the same `type`. If you need parent-child
    // (state belongs to country) add a `parent_value` column later.
    ...[
      'India',
      'United States',
      'United Kingdom',
      'United Arab Emirates',
      'Australia',
      'Canada',
      'Singapore',
    ].map((v, i) => ({ type: 'country', value: v, displayOrder: i + 1 })),

    // All 28 states + 8 union territories of India.
    ...[
      'Andhra Pradesh',
      'Arunachal Pradesh',
      'Assam',
      'Bihar',
      'Chhattisgarh',
      'Goa',
      'Gujarat',
      'Haryana',
      'Himachal Pradesh',
      'Jharkhand',
      'Karnataka',
      'Kerala',
      'Madhya Pradesh',
      'Maharashtra',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Odisha',
      'Punjab',
      'Rajasthan',
      'Sikkim',
      'Tamil Nadu',
      'Telangana',
      'Tripura',
      'Uttar Pradesh',
      'Uttarakhand',
      'West Bengal',
      'Andaman and Nicobar Islands',
      'Chandigarh',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Delhi',
      'Jammu and Kashmir',
      'Ladakh',
      'Lakshadweep',
      'Puducherry',
    ].map((v, i) => ({ type: 'state', value: v, displayOrder: i + 1 })),

    // Major Indian cities — admins extend per onboarding. Keep this
    // list tight: too many cities makes the dropdown noisy.
    ...[
      'Hyderabad',
      'Bengaluru',
      'Chennai',
      'Mumbai',
      'Pune',
      'Delhi',
      'New Delhi',
      'Gurugram',
      'Noida',
      'Kolkata',
      'Ahmedabad',
      'Visakhapatnam',
      'Vijayawada',
      'Guntur',
      'Tirupati',
      'Warangal',
      'Karimnagar',
      'Nizamabad',
      'Khammam',
      'Kochi',
      'Thiruvananthapuram',
      'Coimbatore',
      'Madurai',
      'Tiruchirappalli',
      'Mysuru',
      'Mangaluru',
      'Nagpur',
      'Nashik',
      'Indore',
      'Bhopal',
      'Jaipur',
      'Lucknow',
      'Chandigarh',
      'Bhubaneswar',
      'Patna',
      'Surat',
      'Vadodara',
    ].map((v, i) => ({ type: 'city', value: v, displayOrder: i + 1 })),
  ];

  let created = 0;
  for (const d of defaults) {
    const existing = await repo.findOne({
      where: { type: d.type, value: d.value },
    });
    if (!existing) {
      await repo.save(
        repo.create({ ...d, isActive: true, label: null, description: null }),
      );
      created++;
    }
  }

  // ── Starter receipt template HTML, stored in system_metadata so the
  // sections are editable from the System Metadata UI rather than code.
  // Each row uses `value` for the section key and `description` for the
  // HTML body of that section.
  const starterTemplate: Record<'header' | 'body' | 'footer', string> = {
    header: `
<div style="text-align:center;border-bottom:2px solid #6c739c;padding-bottom:12px;margin-bottom:16px">
  <h1 style="margin:0;font-size:22px;color:#6c739c">{{tenant.tenantName}}</h1>
  <p style="margin:4px 0 0;color:#475569;font-size:13px">{{tenant.address}}, {{tenant.city}}, {{tenant.state}}</p>
  <h2 style="margin:10px 0 0;font-size:14px;color:#334155;letter-spacing:.15em">FEE RECEIPT</h2>
</div>`.trim(),
    body: `
<table style="width:100%;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 8px;color:#64748b">Receipt No.</td><td style="padding:4px 8px;font-weight:600">{{payment.receiptNumber}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Date</td><td style="padding:4px 8px">{{payment.paidAtFormatted}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Student</td><td style="padding:4px 8px">{{student.name}} ({{student.admissionNumber}})</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Class</td><td style="padding:4px 8px">{{student.class}}-{{student.section}} · Roll {{student.rollNo}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Academic Year</td><td style="padding:4px 8px">{{fee.academicYear}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Term</td><td style="padding:4px 8px">{{fee.term}}</td></tr>
</table>
<table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
  <tr><td style="padding:6px 8px;color:#64748b">Original Amount</td><td style="padding:6px 8px;text-align:right">{{fee.originalAmountInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b">Penalty</td><td style="padding:6px 8px;text-align:right">{{fee.totalPenaltyInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b">Discount</td><td style="padding:6px 8px;text-align:right">−{{fee.totalDiscountInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b;font-weight:700">Net Amount</td><td style="padding:6px 8px;text-align:right;font-weight:700">{{fee.netAmountInr}}</td></tr>
</table>
<div style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
  <div style="font-size:12px;color:#64748b">Amount received via {{payment.source}} ({{payment.paymentType}})</div>
  <div style="font-size:22px;font-weight:700;margin-top:2px">{{payment.amountInr}}</div>
  <div style="font-size:12px;color:#475569;margin-top:6px">In words: {{payment.amountInWords}}</div>
</div>`.trim(),
    footer: `
<div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
  <span>This is a computer-generated receipt.</span>
  <span>Generated on {{date.now}}</span>
</div>`.trim(),
  };

  for (const [section, html] of Object.entries(starterTemplate)) {
    const existing = await repo.findOne({
      where: { type: 'receipt_template_starter', value: section },
    });
    if (!existing) {
      await repo.save(
        repo.create({
          type: 'receipt_template_starter',
          value: section,
          isActive: true,
          label: `Receipt template starter — ${section}`,
          description: html,
          displayOrder: section === 'header' ? 1 : section === 'body' ? 2 : 3,
        }),
      );
      created++;
    }
  }
  console.log(
    `${created > 0 ? '✔' : '↩'}  system metadata: ${created} new, ${defaults.length - created} existing`,
  );
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
