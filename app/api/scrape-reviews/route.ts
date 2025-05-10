import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Configure runtime cache
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchTerm = req.nextUrl.searchParams.get('searchTerm');

    const ScraperMap = async (url: string) => {
        let browser;

        try {
            // Check if running in production environment
            const isProd = process.env.NODE_ENV === 'production';
            
            if (isProd) {
                // For production (serverless) environment
                const executablePath = await chromium.executablePath();
                
                browser = await puppeteer.launch({
                    args: chromium.args,
                    defaultViewport: chromium.defaultViewport,
                    executablePath,
                    headless: true,
                                    });
            } else {
                // For development environment
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                });
            }

            const page = await browser.newPage();
            
            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
            
            // Set viewport to a reasonable size
            await page.setViewport({ width: 1280, height: 800 });

            // Navigation with timeout
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for reviews button
            try {
                await page.waitForSelector('button[aria-label*="Reviews for"]', { timeout: 10000 });
            } catch (error) {
                console.log('No reviews found');
                await browser.close();
                return { error: 'No reviews found or page took too long to load' };
            }

            // Click reviews button
            await page.click('button[aria-label*="Reviews for"]');
            
            // Wait for reviews container
            await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf', { timeout: 10000 });

            // Extract reviews function
            const extractReviews = async () => {
                return page.evaluate(() => {
                    const reviewElements = document.querySelectorAll('.jftiEf');
                    return Array.from(reviewElements).map(review => {
                        const fullName = review.querySelector('.d4r55')?.textContent || 'No name';
                        const stars = review.querySelector('.kvMYJc')?.getAttribute('aria-label') || 'No stars info';
                        const reviewText = review.querySelector('.MyEned')?.textContent || 'No reviews info';

                        return { fullName, stars, reviewText };
                    });
                });
            };

            // Initial extraction
            let reviews = await extractReviews();
            let previousLength = 0;
            let attempts = 0;
            const maxAttempts = 5; // Limit scrolling attempts for serverless environments

            // Scroll to load more reviews
            while (attempts < maxAttempts) {
                await page.evaluate(async () => {
                    const reviewsSection = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
                    if (reviewsSection) {
                        reviewsSection.scrollTop = reviewsSection.scrollHeight;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                });

                const newReviews = await extractReviews();
                if (newReviews.length === previousLength || newReviews.length >= 10) {
                    reviews = newReviews.slice(0, 10); // Limiting to 10 reviews for faster response
                    break;
                }
                previousLength = newReviews.length;
                attempts++;
            }

            // Close browser
            await browser.close();
            return reviews;
        } catch (error) {
            // Make sure to close browser on error
            if (browser) {
                await browser.close();
            }
            console.error('Scraper error:', error);
            throw error;
        }
    };

    if (!searchTerm) {
        return NextResponse.json({ error: 'searchTerm is required' }, { status: 400 });
    }

    try {
        const url = searchTerm.startsWith('http') ? searchTerm : `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
        const reviews = await ScraperMap(url);

        if ('error' in reviews) {
            return NextResponse.json(reviews, { status: 404 });
        }

        return NextResponse.json(reviews);
    } catch (error) {
        console.error('Scraping error:', error);
        return NextResponse.json({ error: 'Failed to scrape reviews' }, { status: 500 });
    }
}