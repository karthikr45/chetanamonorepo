import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeePayment } from './entities/fee-payment.entity';
import { Fee } from './entities/fee.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { Student } from '../students/entities/student.entity';
import { ReceiptPdfService } from './receipt-pdf.service';
import { AzureStorageService } from '../storage/azure-storage.service';

/** Fallback receipt logo when the tenant config has none configured. */
const DEFAULT_RECEIPT_LOGO =
  'https://aautifileuploads.blob.core.windows.net/svbk/svbk_receipt_logo.png';

/** Offline payment types — everything else is treated as an online/gateway payment. */
const OFFLINE_TYPES = new Set(['CASH', 'CHEQUE', 'DD', 'POS', 'NEFT']);

/** Human-readable label for each payment type. */
const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  DD: 'DD',
  POS: 'POS',
  NEFT: 'NEFT',
  RAZORPAY: 'Razorpay',
  CASHFREE: 'Cashfree',
  UPI: 'UPI',
  NETBANKING: 'Net Banking',
  CARD: 'Card',
};

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = ('0' + dt.getDate()).slice(-2);
  const mm = ('0' + (dt.getMonth() + 1)).slice(-2);
  const yyyy = dt.getFullYear();
  return `${dd} - ${mm} - ${yyyy}`;
}

/** Minimal HTML escaping for free-text values placed into the template. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a fee-payment receipt PDF and persists it to Azure Blob
 * storage, returning a public URL.
 *
 * Builds the receipt HTML using the legacy SVBK template, rasterises it
 * to PDF via `ReceiptPdfService.htmlToPdf` (puppeteer), then uploads via
 * `AzureStorageService` to `svbkschool/{tenantCode}/receipts/{receiptNumber}.pdf`.
 *
 * Callers are responsible for AUTHORISATION; this service only takes the
 * tenant that owns the fee payment and the payment id.
 */
@Injectable()
export class ReceiptStorageService {
  constructor(
    @InjectRepository(FeePayment)
    private readonly feePaymentRepo: Repository<FeePayment>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantConfig)
    private readonly tenantConfigRepo: Repository<TenantConfig>,
    private readonly receiptPdf: ReceiptPdfService,
    private readonly storage: AzureStorageService,
  ) {}

  /**
   * Render → PDF → upload → return the blob URL. Always regenerates and
   * overwrites the stored copy.
   *
   * @param tenantId MUST be the tenant that owns the fee payment (the
   *   receiving tenant — may differ from the parent's home tenant for
   *   hostel/transport fees). The caller resolves and authorises it.
   */
  async generateAndStore(
    tenantId: string,
    paymentId: string,
  ): Promise<{ url: string }> {
    const fp = await this.feePaymentRepo.findOne({
      where: { id: paymentId, tenantId },
    });
    if (!fp || !fp.feeId) throw new NotFoundException('Receipt not found.');

    const fee = await this.feeRepo.findOne({
      where: { id: fp.feeId, tenantId },
    });
    if (!fee) throw new NotFoundException('Receipt not found.');

    const student = await this.studentRepo.findOne({
      where: { id: fee.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Receipt not found.');

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    // Logo comes from the tenant's active configuration: prefer a configured
    // receipt logo, then the general logo, then the default. A tenant can
    // have several active configs (one per environment), so scan all of
    // them for the first that actually has a logo rather than assuming the
    // most-recent one carries it.
    const configs = await this.tenantConfigRepo.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    const logoUrl =
      configs.find((c) => c.receiptLogoUrl?.trim())?.receiptLogoUrl?.trim() ||
      configs.find((c) => c.logoUrl?.trim())?.logoUrl?.trim() ||
      DEFAULT_RECEIPT_LOGO;

    const html = this.buildReceiptHtml(fp, fee, student, logoUrl);
    const pdf = await this.receiptPdf.htmlToPdf(html);

    const { url } = await this.storage.uploadReceiptPdf({
      tenantId,
      tenantCode: tenant.tenantCode,
      buffer: pdf,
      blobName: fp.receiptNumber ?? fp.id,
    });
    return { url };
  }

  /**
   * Legacy SVBK receipt HTML — kept faithful to the previous version's
   * `/getPdf` template, adapted to the current schema (FeePayment + Fee +
   * Student). Self-contained (inline CSS), so puppeteer can render it
   * with no external assets beyond the logo image.
   */
  private buildReceiptHtml(
    fp: FeePayment,
    fee: Fee,
    student: Student,
    logoUrl: string,
  ): string {
    const offlinePayment = fp.method ? OFFLINE_TYPES.has(fp.method) : false;
    const paymentMode =
      (fp.method ? MODE_LABELS[fp.method] : null) ?? fp.method ?? '';
    const receiptDate = fmtDate(fp.paidAt);
    const paymentDate = fmtDate(fp.paidAt);
    const printedDate = fmtDate(new Date());
    const penalityAmount =
      Number(fee.totalPenalty) > 0 ? fee.totalPenalty : false;
    const paidAmount =
      fp.amount !== undefined && fp.amount !== null
        ? fp.amount
        : fee.paidAmount;
    const paymentStatus = fee.paymentStatus === 'PAID' ? 'Paid' : fee.paymentStatus;

    return `<!DOCTYPE html>
        <html>

        <head>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Fee Receipt</title>
            <style>
                table {
                    font-family: arial;
                    border-collapse: collapse;
                    width: 100%;
                }

                td,
                th {
                    border: 1px solid #dddddd;
                    text-align: left;
                    padding: 8px;
                }

                td {
                    font-size: 15px;
                    font-weight: 100;
                }

                #detailsPara {
                    margin-left: 10px;
                    font-weight: 100
                }

                #detailsPara1 {
                    margin-left: 10px;
                    font-weight: 100;
                    float: right;
                }

                #hrline {
                    margin-top: 20px
                }

                p {
                    font-size: 15px;
                    font-weight: bold
                }

                img {
                    border-radius: 35px;
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                }

                .row:after {
                    content: "";
                    display: table;
                    clear: both;
                }

                .row {
                    width: 100%
                }

                .text-right {
                    text-align: right;
                    word-break: break-word
                }
            </style>
        </head>

        <body>
            <div id="main">
                <img src="${esc(logoUrl)}" alt="School logo" style="width:600px;height:110px" class="center">
            </div>
            <p style="text-align:center; font-size: 24px">Fee Receipt</p>
            <div>
                <div>
                    <div>
                        <p><span style="width:100px">Payment Status &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(paymentStatus)}</span></p>
                    </div>
                    <div>
                        <p><span style="width:100px">Academic Year &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(student.academicYear)}</span></p>
                    </div>
                    <div>
                        <p><span style="width:100px">Term &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(fee.term)}</span></p>
                    </div>
                    ${
                      !offlinePayment
                        ? `<div>
                            <p><span style="width:100px">Transaction ID &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(fp.transactionId ?? fp.orderId ?? '')}</span></p>
                        </div>`
                        : ''
                    }
                    <div>
                        <p><span style="width:100px">Receipt Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(receiptDate)}</span></p>
                    </div>
                    <div>
                        <p><span style="width:100px">Receipt No &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span id="detailsPara">: &nbsp;${esc(fp.receiptNumber ?? '')}</span></p>
                    </div>
                    <div>
                        <p><span style="width:100px">Payment Towards &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> <span id="detailsPara">:</span> <span>&nbsp;Tution Fee</span></p>
                    </div>
                </div>
            </div>
            <table>
                <tr>
                    <th>Name of the student</th>
                    <td>${esc(student.name)}</td>
                </tr>
                <tr>
                    <th>Admission Number</th>
                    <td id="detailsPara">${esc(student.admissionNumber)}</td>
                </tr>
                <tr>
                    <th>Class & Section</th>
                    <td>${esc(student.class)}&nbsp;${esc(student.section)}</td>
                </tr>
                <tr>
                    <th>Roll Number</th>
                    <td>${esc(student.rollNo)}</td>
                </tr>
                <tr>
                    <th>Payment Date</th>
                    <td>${esc(paymentDate)}</td>
                </tr>
                <tr>
                    <th>Fee Amount in INR</th>
                    <td>${esc(paidAmount)}/-</td>
                </tr>
                ${
                  penalityAmount
                    ? `<tr>
                    <th>Late Payment Fee</th>
                    <td>${esc(penalityAmount)}/-</td>
                </tr>`
                    : ''
                }
                <tr>
                    <th>Mode of Payment</th>
                    <td>${offlinePayment ? 'Offline' : 'Online'} (${esc(paymentMode)})</td>
                </tr>
                <tr>
                    <th>Remarks</th>
                    <td>${esc(fp.notes ?? '')}</td>
                </tr>
            </table>

            <p style="text-align:center;color:black;padding:10px;font-size:14px"><span id="detailsPara">This is a system generated receipt, hence no signature needed. In case of any issues please contact us.</span></p>
            <p style="text-align:center;color:black;padding:10px;font-size:14px"><span id="detailsPara"> **&nbsp; Print Receipt generated on ${esc(printedDate)} &nbsp;**</span></p>
        </body>

        </html>`;
  }
}
