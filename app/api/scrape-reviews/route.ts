import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page, Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

// Define response types for better type safety
interface Review {
  fullName: string;
  stars: string;
  reviewText: string;
  datePosted?: string;
  reviewId?: string;
}

interface ScraperResponse {
  businessName?: string;
  totalReviews?: number;
  averageRating?: string;
  reviews: Review[];
}

interface ErrorResponse {
  error: string;
  requestId?: string;
}

// Human-like behavior delays
const DELAYS = {
  TYPING: { min: 50, max: 150 },    // Delay between typing characters
  CLICKING: { min: 100, max: 300 }, // Delay before clicking elements
  SCROLLING: { min: 800, max: 2000 }, // Delay between scrolls
  LOADING: { min: 2000, max: 4000 }  // Delay for page loading
};

// CSS selectors - extracted as constants for easier maintenance
const SELECTORS = {
  REVIEWS_BUTTON: 'button[aria-label*="Reviews for"]',
  REVIEWS_CONTAINER: '.m6QErb.DxyBCb.kA9KIf.dS8AEf',
  REVIEW_ITEM: '.jftiEf',
  REVIEWER_NAME: '.d4r55',
  RATING_STARS: '.kvMYJc',
  COLLAPSED_TEXT: '.MyEned',
  EXPANDED_TEXT: '.wiI7pd',
  BUSINESS_NAME: 'h1.DUwDvf',
  BUSINESS_RATING: 'div.F7nice span[aria-hidden="true"]',
  TOTAL_REVIEWS: 'div.F7nice span[aria-label*="reviews"]',
  CONSENT_BUTTON: 'button[aria-label*="Agree"], button[aria-label*="Accept"]'
};

// Configuration
const CONFIG = {
  MAX_REVIEWS: 25,
  SELECTOR_TIMEOUT: 10000,
  MAX_SCROLL_ATTEMPTS: 10,
  CACHE_TTL: 3600,
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
  ],
  RETRY_ATTEMPTS: 3,
};

// In-memory cache
const cache: Record<string, { data: ScraperResponse; timestamp: number }> = {};

// Utility functions for human-like behavior
async function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function humanClick(page: Page, selector: string): Promise<void> {
  await randomDelay(DELAYS.CLICKING.min, DELAYS.CLICKING.max);
  const element = await page.$(selector);
  if (element) {
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + (box.width * Math.random());
      const y = box.y + (box.height * Math.random());
      await page.mouse.move(x, y, { steps: 10 });
      await randomDelay(50, 150);
      await page.mouse.down();
      await randomDelay(50, 150);
      await page.mouse.up();
    }
  }
}

async function addRandomInteractions(page: Page): Promise<void> {
  const moveMouseRandomly = async () => {
    const viewport = await page.viewport();
    if (viewport) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      await page.mouse.move(x, y, { steps: 5 });
    }
  };

  if (Math.random() > 0.7) {
    await moveMouseRandomly();
  }
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const searchTerm = req.nextUrl.searchParams.get('searchTerm');
  const skipCache = req.nextUrl.searchParams.get('skipCache') === 'true';
  
  if (!searchTerm) {
    return NextResponse.json(
      { error: 'searchTerm is required', requestId } as ErrorResponse, 
      { status: 400 }
    );
  }
  
  const cacheKey = encodeURIComponent(searchTerm.toLowerCase());
  if (!skipCache && cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CONFIG.CACHE_TTL * 1000) {
    return NextResponse.json(cache[cacheKey].data);
  }
  
  try {
    const url = searchTerm.startsWith('http') 
      ? searchTerm 
      : `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
    
    const result = await withRetry(() => scrapeMapReviews(url, requestId), CONFIG.RETRY_ATTEMPTS);
    
    if ('error' in result) {
      return NextResponse.json({ ...result, requestId }, { status: 404 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to scrape reviews', requestId } as ErrorResponse, 
      { status: 500 }
    );
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await randomDelay(1000 * Math.pow(2, attempt), 3000 * Math.pow(2, attempt));
      }
    }
  }
  
  throw lastError;
}

async function scrapeMapReviews(url: string, requestId: string): Promise<ScraperResponse | ErrorResponse> {
  const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
  const isLocal = !!process.env.CHROME_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({ 
    args: isLocal ? chromium.args : [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--incognito', 'hide-scrollbars'],
    defaultViewport: chromium.defaultViewport,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath("https://brower.s3.ap-south-1.amazonaws.com/chromium-v135.0.0-next.3-pack.x64.tar"),
    headless: chromium.headless,
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    
    // Set random viewport size
    await page.setViewport({
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 100)
    });

    await page.goto(url, { waitUntil: 'networkidle2' });
    await randomDelay(DELAYS.LOADING.min, DELAYS.LOADING.max);

    await handleConsentIfNeeded(page, requestId);
    const businessInfo = await extractBusinessInfo(page);

    try {
      await page.waitForSelector(SELECTORS.REVIEWS_BUTTON);
      await humanClick(page, SELECTORS.REVIEWS_BUTTON);
      await randomDelay(DELAYS.LOADING.min, DELAYS.LOADING.max);
    } catch (error) {
      return { error: 'No reviews found for this location' };
    }

    try {
      await page.waitForSelector(SELECTORS.REVIEWS_CONTAINER);
    } catch (error) {
      return { error: 'Reviews container not found' };
    }

    const reviews = await scrapeReviewsWithScrolling(page);

    return {
      ...businessInfo,
      reviews
    };
  } catch (error) {
    return { error: 'Failed to scrape reviews due to technical issues' };
  } finally {
    await browser.close();
  }
}

async function handleConsentIfNeeded(page: Page, requestId: string): Promise<void> {
  try {
    const hasConsent = await page.$(SELECTORS.CONSENT_BUTTON);
    if (hasConsent) {
      await humanClick(page, SELECTORS.CONSENT_BUTTON);
      await randomDelay(DELAYS.LOADING.min, DELAYS.LOADING.max);
    }
  } catch (error) {
    // Continue if consent handling fails
  }
}

async function extractBusinessInfo(page: Page): Promise<Partial<ScraperResponse>> {
  try {
    await addRandomInteractions(page);
    return await page.evaluate((selectors) => {
      const businessNameEl = document.querySelector(selectors.BUSINESS_NAME);
      const businessRatingEl = document.querySelector(selectors.BUSINESS_RATING);
      const totalReviewsEl = document.querySelector(selectors.TOTAL_REVIEWS);
      
      return {
        businessName: businessNameEl?.textContent?.trim() || undefined,
        averageRating: businessRatingEl?.textContent?.trim() || undefined,
        totalReviews: totalReviewsEl 
          ? parseInt(totalReviewsEl.textContent?.replace(/[^0-9]/g, '') || '0')
          : undefined
      };
    }, SELECTORS);
  } catch (error) {
    return {};
  }
}

async function scrapeReviewsWithScrolling(page: Page): Promise<Review[]> {
  const smoothScroll = async (containerSelector: string) => {
    await page.evaluate(async (selector) => {
      const container = document.querySelector(selector);
      if (container) {
        const currentScroll = container.scrollTop;
        const targetScroll = currentScroll + (Math.random() * 300 + 100);
        
        for (let i = currentScroll; i < targetScroll; i += 10) {
          container.scrollTop = i;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }, containerSelector);
  };

  const extractReviews = async (): Promise<Review[]> => {
    return page.evaluate((selectors) => {
      const reviewElements = document.querySelectorAll(selectors.REVIEW_ITEM);
      
      return Array.from(reviewElements).map(review => {
        const fullName = review.querySelector(selectors.REVIEWER_NAME)?.textContent?.trim() || 'Anonymous';
        const stars = review.querySelector(selectors.RATING_STARS)?.getAttribute('aria-label')?.trim() || 'No rating';
        const collapsedText = review.querySelector(selectors.COLLAPSED_TEXT)?.textContent?.trim();
        const expandedText = review.querySelector(selectors.EXPANDED_TEXT)?.textContent?.trim();
        const reviewText = expandedText || collapsedText || 'No review text';
        const reviewId = (review as HTMLElement).dataset.reviewId;
        const dateElement = review.querySelector('.rsqaWe');
        const datePosted = dateElement?.textContent?.trim();
        
        return { fullName, stars, reviewText, reviewId, datePosted };
      });
    }, SELECTORS);
  };

  let reviews: Review[] = await extractReviews();
  let previousLength = 0;
  let scrollAttempts = 0;

  while (scrollAttempts < CONFIG.MAX_SCROLL_ATTEMPTS) {
    await smoothScroll(SELECTORS.REVIEWS_CONTAINER);
    await randomDelay(DELAYS.SCROLLING.min, DELAYS.SCROLLING.max);
    await addRandomInteractions(page);

    const newReviews = await extractReviews();
    
    if (newReviews.length === previousLength || newReviews.length >= CONFIG.MAX_REVIEWS) {
      reviews = newReviews;
      break;
    }

    previousLength = newReviews.length;
    scrollAttempts++;
  }

  return reviews;
}

export const config = {
  runtime: 'edge',
};