import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

/**
 * Renders the receipt HTML produced by FeesService.renderReceipt into
 * a PDF using a headless Chromium kept warm across requests. Launched
 * lazily on first use; closed on module shutdown.
 *
 * Deployed on a plain VM (no Docker / Lambda). On a fresh Ubuntu box
 * install the Chromium runtime libs once:
 *   sudo apt-get install -y libnss3 libatk-bridge2.0-0 libxkbcommon0 \
 *     libgbm1 libasound2 fonts-liberation libcups2 libxcomposite1 \
 *     libxdamage1 libxrandr2 libgtk-3-0
 */
@Injectable()
export class ReceiptPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(ReceiptPdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;
    this.launching = puppeteer
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      })
      .then((b) => {
        this.browser = b;
        b.on('disconnected', () => {
          this.browser = null;
        });
        return b;
      })
      .finally(() => {
        this.launching = null;
      });
    return this.launching;
  }

  /**
   * HTML → PDF. The HTML is expected to be self-contained (inline CSS,
   * no external assets), which the receipt renderer already enforces.
   */
  async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      return Buffer.from(buf);
    } finally {
      await page.close().catch(() => {});
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser?.connected) {
      await this.browser.close().catch((err) => {
        this.logger.warn(`Browser close failed: ${(err as Error).message}`);
      });
      this.browser = null;
    }
  }
}
