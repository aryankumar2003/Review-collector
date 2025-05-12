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
  SCROLL_DELAY: 2000,
  SELECTOR_TIMEOUT: 10000,
  MAX_SCROLL_ATTEMPTS: 10,
  CACHE_TTL: 3600, // Cache results for 1 hour
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
  ],
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// In-memory cache (would use Redis or DynamoDB in production)
const cache: Record<string, { data: ScraperResponse; timestamp: number }> = {};

/**
 * Next.js API route handler for Google Maps review scraping
 */
export async function GET(req: NextRequest) {
  // Generate a unique request ID for tracing
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Processing request`);
  
  const searchTerm = req.nextUrl.searchParams.get('searchTerm');
  const skipCache = req.nextUrl.searchParams.get('skipCache') === 'true';
  
  if (!searchTerm) {
    return NextResponse.json(
      { error: 'searchTerm is required', requestId } as ErrorResponse, 
      { status: 400 }
    );
  }
  
  // Check cache first
  const cacheKey = encodeURIComponent(searchTerm.toLowerCase());
  if (!skipCache && cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CONFIG.CACHE_TTL * 1000) {
    console.log(`[${requestId}] Returning cached result for: ${searchTerm}`);
    return NextResponse.json(cache[cacheKey].data);
  }
  
  try {
    const url = searchTerm.startsWith('http') 
      ? searchTerm 
      : `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
    
    console.log(`[${requestId}] Scraping reviews from: ${url}`);
    
    const result = await withRetry(() => scrapeMapReviews(url, requestId), 
      CONFIG.RETRY_ATTEMPTS, CONFIG.RETRY_DELAY);
    
    if ('error' in result) {
      return NextResponse.json(
        { ...result, requestId }, 
        { status: 404 }
      );
    }
    

    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[${requestId}] Scraping error:`, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to scrape reviews',
        requestId 
      } as ErrorResponse, 
      { status: 500 }
    );
  }
}

/**
 * Retries a function multiple times with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  maxRetries: number, 
  baseDelay: number
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Main scraping function for Google Maps reviews
 */
async function scrapeMapReviews(
  url: string, 
  requestId: string
): Promise<ScraperResponse | ErrorResponse> {
  // Configure Chromium settings for AWS Lambda compatibility

  
  // Select a random user agent
  const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
  
  // Launch browser with optimized AWS Lambda settings
  const isLocal=!!process.env.CHROME_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({ 

    args:isLocal? chromium.args:[...chromium.args, '--no-sandbox', '--disable-setuid-sandbox','--incognito','hide-scrollbars'],
    defaultViewport: chromium.defaultViewport,
    executablePath:process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath("https://brower.s3.ap-south-1.amazonaws.com/chromium-v135.0.0-next.3-pack.x64.tar"),
    headless: chromium.headless,
  });
  
  try {
    console.log(`[${requestId}] Browser launched`);
    const page = await browser.newPage();
    
    // Set user agent to avoid being detected as a bot
    await page.setUserAgent(userAgent);
    
    // Add request timeout
    console.log(`[${requestId}] Navigating to URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Handle cookie consent if it appears
    await handleConsentIfNeeded(page, requestId);
    
    // Extract business information
    const businessInfo = await extractBusinessInfo(page);
    
    // Check for reviews button
    try {
      console.log(`[${requestId}] Looking for reviews button`);
      await page.waitForSelector(SELECTORS.REVIEWS_BUTTON, { timeout: CONFIG.SELECTOR_TIMEOUT });
      await page.click(SELECTORS.REVIEWS_BUTTON);
    } catch (error) {
      console.log(`[${requestId}] No reviews button found:`, error);
      return { error: 'No reviews found for this location' };
    }

    try {
      // Wait for reviews container to load
      console.log(`[${requestId}] Waiting for reviews container`);
      await page.waitForSelector(SELECTORS.REVIEWS_CONTAINER, { timeout: CONFIG.SELECTOR_TIMEOUT });
    } catch (error) {
      console.log(`[${requestId}] Reviews container not found:`, error);
      return { error: 'Reviews container not found' };
    }

    // Extract reviews with scrolling
    console.log(`[${requestId}] Extracting reviews with scrolling`);
    const reviews = await scrapeReviewsWithScrolling(page);
    console.log("reviews", reviews);
    return {
      reviews: reviews
    };
  } catch (error) {
    console.error(`[${requestId}] Error during scraping:`, error);
    return { error: 'Failed to scrape reviews due to technical issues' };
  } finally {
    console.log(`[${requestId}] Closing browser`);
    await browser.close();
  }
}

/**
 * Handle cookie consent popups if they appear
 */
async function handleConsentIfNeeded(page: Page, requestId: string): Promise<void> {
  try {
    const hasConsent = await page.$(SELECTORS.CONSENT_BUTTON);
    if (hasConsent) {
      console.log(`[${requestId}] Handling consent popup`);
      await page.click(SELECTORS.CONSENT_BUTTON);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
  } catch (error) {
    console.log(`[${requestId}] No consent button found or error handling it:`, error);
  }
}

/**
 * Extract business information from the page
 */
async function extractBusinessInfo(page: Page): Promise<Partial<ScraperResponse>> {
  try {
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
    console.error('Error extracting business info:', error);
    return {};
  }
}

/**
 * Scrape reviews with scrolling pagination
 */
async function scrapeReviewsWithScrolling(page: Page): Promise<Review[]> {
  const extractReviews = async (): Promise<Review[]> => {
    return page.evaluate((selectors) => {
      const reviewElements = document.querySelectorAll(selectors.REVIEW_ITEM);
      
      return Array.from(reviewElements).map(review => {
        const fullName = review.querySelector(selectors.REVIEWER_NAME)?.textContent?.trim() || 'Anonymous';
        const stars = review.querySelector(selectors.RATING_STARS)?.getAttribute('aria-label')?.trim() || 'No rating';
        
        // Handle expanded/collapsed review text
        let reviewText = '';
        const collapsedText = review.querySelector(selectors.COLLAPSED_TEXT)?.textContent?.trim();
        const expandedText = review.querySelector(selectors.EXPANDED_TEXT)?.textContent?.trim();
        reviewText = expandedText || collapsedText || 'No review text';
        
        // Extract review ID if possible
        const reviewId = (review as HTMLElement).dataset.reviewId || undefined;
        
        // Extract date if available
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
    await page.evaluate(async (delay: number, containerSelector: string) => {
      const reviewsSection = document.querySelector(containerSelector);
      if (reviewsSection) {
        reviewsSection.scrollTop = reviewsSection.scrollHeight;
      }
      // Use the passed delay parameter
      await new Promise(resolve => setTimeout(resolve, delay));
    }, CONFIG.SCROLL_DELAY, SELECTORS.REVIEWS_CONTAINER);
    
    // Add a small wait to ensure content loads
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newReviews = await extractReviews();
    
    // Stop conditions
    if (newReviews.length === previousLength || newReviews.length >= CONFIG.MAX_REVIEWS) {
      reviews = newReviews;
      break;
    }
    console.log(`Found ${newReviews.length} reviews after scroll attempt ${scrollAttempts + 1}`);
    
    previousLength = newReviews.length;
    scrollAttempts++;
  }

  return reviews;
}

// For serverless environments, export the handler
export const config = {
  runtime: 'edge',
};