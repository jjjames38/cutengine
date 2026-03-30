import { mkdirSync } from 'fs';
import { join } from 'path';
import { acquirePage, releasePage } from './browser-pool.js';

export interface CaptureOptions {
  html: string;
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  isStatic?: boolean;
}

export interface CaptureResult {
  frameDir: string;
  frameCount: number;
  framePattern: string;
}

// Recycle the Puppeteer page every N frames to prevent Chromium OOM.
const PAGE_RECYCLE_INTERVAL = 500;

export async function captureFrames(opts: CaptureOptions): Promise<CaptureResult> {
  mkdirSync(opts.outputDir, { recursive: true });

  if (opts.isStatic) {
    const page = await acquirePage(opts.width, opts.height);
    try {
      // First load: networkidle2 with generous timeout, force continue if hangs
    await Promise.race([
      page.setContent(opts.html, { waitUntil: 'networkidle2', timeout: 60000 }),
      new Promise<void>(r => setTimeout(r, 60000)),
    ]).catch(() => {});
      await page.evaluate((time: number) => {
        if (typeof (window as any).updateFrame === 'function') {
          (window as any).updateFrame(time);
        }
      }, 0);
      await page.screenshot({
        path: join(opts.outputDir, 'frame_00001.png'),
        type: 'png',
      });
      return { frameDir: opts.outputDir, frameCount: 1, framePattern: 'frame_%05d.png' };
    } finally {
      await releasePage(page);
    }
  }

  const totalFrames = Math.ceil(opts.fps * opts.duration);
  let page = await acquirePage(opts.width, opts.height);
  let pageFrameCount = 0;

  try {
    // First load: networkidle2 with generous timeout, force continue if hangs
    await Promise.race([
      page.setContent(opts.html, { waitUntil: 'networkidle2', timeout: 60000 }),
      new Promise<void>(r => setTimeout(r, 60000)),
    ]).catch(() => {});

    for (let i = 0; i < totalFrames; i++) {
      // Recycle page every N frames — close old, open new, reload HTML
      if (pageFrameCount >= PAGE_RECYCLE_INTERVAL) {
        await releasePage(page);
        page = await acquirePage(opts.width, opts.height);
        // Navigate to blank first to fully reset, then set content
        await page.goto('about:blank').catch(() => {});
        // setContent with short timeout — if it hangs, force continue
        await Promise.race([
          page.setContent(opts.html, { waitUntil: 'load', timeout: 30000 }),
          new Promise<void>(r => setTimeout(r, 30000)),
        ]).catch(() => {});
        pageFrameCount = 0;
      }

      const currentTime = i / opts.fps;

      await page.evaluate((time: number) => {
        if (typeof (window as any).updateFrame === 'function') {
          (window as any).updateFrame(time);
        }
      }, currentTime);

      const frameNum = String(i + 1).padStart(5, '0');
      await page.screenshot({
        path: join(opts.outputDir, `frame_${frameNum}.png`),
        type: 'png',
      });

      pageFrameCount++;
    }

    return { frameDir: opts.outputDir, frameCount: totalFrames, framePattern: 'frame_%05d.png' };
  } finally {
    await releasePage(page);
  }
}
