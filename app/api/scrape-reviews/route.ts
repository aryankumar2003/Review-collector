import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer';

// Define response type for better type safety
interface Review {
  fullName: string;
  stars: string;
  reviewText: string;
}

interface ErrorResponse {
  error: string;
}

// Configuration
const MAX_REVIEWS = 25;
const SCROLL_DELAY = 2000;
const SELECTOR_TIMEOUT = 10000;

export async function GET(req: NextRequest) {
  const searchTerm = req.nextUrl.searchParams.get('searchTerm');
  
  if (!searchTerm) {
    return NextResponse.json(
      { error: 'searchTerm is required' } as ErrorResponse, 
      { status: 400 }
    );
  }
  
  try {
    const url = searchTerm.startsWith('http') 
      ? searchTerm 
      : `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
    
    const reviews = await scrapeMapReviews(url);
    
    if ('error' in reviews) {
      return NextResponse.json(reviews, { status: 404 });
    }
    
    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape reviews' } as ErrorResponse, 
      { status: 500 }
    );
  }
}

async function scrapeMapReviews(url: string): Promise<Review[] | ErrorResponse> {
  // Launch browser with appropriate production settings
  const browser = await puppeteer.launch({ 
    headless: true, // Use the new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid being detected as a bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport to a reasonable desktop size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Add request timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Handle cookie consent if it appears (common in production)
    try {
      const consentSelector = 'button[aria-label*="Agree"], button[aria-label*="Accept"]';
      const hasConsent = await page.$(consentSelector);
      if (hasConsent) {
        await page.click(consentSelector);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      }
    } catch (error) {
      console.log('No consent button found or error handling it:', error);
    }

    // Check for reviews button
    try {
      await page.waitForSelector('button[aria-label*="Reviews for"]', { timeout: SELECTOR_TIMEOUT });
      await page.click('button[aria-label*="Reviews for"]');
    } catch (error) {
      console.log('No reviews button found:', error);
      return { error: 'No reviews found for this location' };
    }

    try {
      // Wait for reviews container to load
      await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf', { timeout: SELECTOR_TIMEOUT });
    } catch (error) {
      console.log('Reviews container not found:', error);
      return { error: 'Reviews container not found' };
    }

    // Extract reviews with retry logic
    const reviews = await scrapeReviewsWithScrolling(page);
    return reviews.slice(0, MAX_REVIEWS);
  } catch (error) {
    console.error('Error during scraping:', error);
    return { error: 'Failed to scrape reviews due to technical issues' };
  } finally {
    await browser.close();
  }
}

async function scrapeReviewsWithScrolling(page: Page): Promise<Review[]> {
  const extractReviews = async (): Promise<Review[]> => {
    return page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.jftiEf');
      return Array.from(reviewElements).map(review => {
        const fullName = review.querySelector('.d4r55')?.textContent?.trim() || 'Anonymous';
        const stars = review.querySelector('.kvMYJc')?.getAttribute('aria-label')?.trim() || 'No rating';
        
        // Handle expanded/collapsed review text
        let reviewText = '';
        const collapsedText = review.querySelector('.MyEned')?.textContent?.trim();
        const expandedText = review.querySelector('.wiI7pd')?.textContent?.trim();
        reviewText = expandedText || collapsedText || 'No review text';
        
        return { fullName, stars, reviewText };
      });
    });
  };

  let reviews: Review[] = await extractReviews();
  let previousLength = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 10; // Limit scrolling attempts for production
  
  while (scrollAttempts < maxScrollAttempts) {
    await page.evaluate(async (delay: number) => {
      const reviewsSection = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
      if (reviewsSection) {
        reviewsSection.scrollTop = reviewsSection.scrollHeight;
      }
      // Use the passed delay parameter
      await new Promise(resolve => setTimeout(resolve, delay));
    }, SCROLL_DELAY);
    
    // Add a small wait to ensure content loads
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    
    const newReviews = await extractReviews();
    
    // Stop conditions
    if (newReviews.length === previousLength || newReviews.length >= MAX_REVIEWS) {
      reviews = newReviews;
      break;
    }
    
    previousLength = newReviews.length;
    scrollAttempts++;
  }
  
  return reviews;
}