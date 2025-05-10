import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(req: NextRequest) {
    const searchTerm = req.nextUrl.searchParams.get('searchTerm');

    const ScraperMap = async (url: string) => {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

        try {
            await page.waitForSelector('button[aria-label*="Reviews for"]', { timeout: 5000 });
        } catch (error) {
            console.log('No reviews found');
            await browser.close();
            return { error: 'No reviews found' };
        }

        await page.click('button[aria-label*="Reviews for"]');
        await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde');

        const extractReviews = async () => {
            const reviews = await page.evaluate(() => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                return Array.from(reviewElements).map(review => {
                    const fullName = review.querySelector('.d4r55')?.textContent || 'No name';
                    const stars = review.querySelector('.kvMYJc')?.getAttribute('aria-label') || 'No stars info';
                    const reviewText = review.querySelector('.MyEned')?.textContent || 'No reviews info';

                    return { fullName, stars, reviewText };
                });
            });
            return reviews;
        };

        let reviews = await extractReviews();
        let previousLength = 0;

        while (true) {
            await page.evaluate(async () => {
                const reviewsSection = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
                if (reviewsSection) {
                    reviewsSection.scrollTop = reviewsSection.scrollHeight;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            });

            const newReviews = await extractReviews();
            if (newReviews.length === previousLength || newReviews.length >= 25) {
                reviews = newReviews.slice(0, 25);
                break;
            }
            previousLength = newReviews.length;
        }

        await browser.close();
        return reviews;
    };

    const ScraperBusiness = async (url: string) => {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

        try {
            await page.waitForSelector('button[aria-label*="Reviews for"]', { timeout: 5000 });
        } catch (error) {
            console.log('No reviews found');
            await browser.close();
            return { error: 'No reviews found' };
        }

        await page.click('button[aria-label*="Reviews for"]');
        await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde');

        const extractReviews = async () => {
            const reviews = await page.evaluate(() => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                return Array.from(reviewElements).map(review => {
                    const fullName = review.querySelector('.d4r55')?.textContent || 'No name';
                    const stars = review.querySelector('.kvMYJc')?.getAttribute('aria-label') || 'No stars info';
                    const reviewText = review.querySelector('.MyEned')?.textContent || 'No reviews info';

                    return { fullName, stars, reviewText };
                });
            });
            return reviews;
        };

        let reviews = await extractReviews();
        let previousLength = 0;

        while (true) {
            await page.evaluate(async () => {
                const reviewsSection = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
                if (reviewsSection) {
                    reviewsSection.scrollTop = reviewsSection.scrollHeight;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            });

            const newReviews = await extractReviews();
            if (newReviews.length === previousLength || newReviews.length >= 25) {
                reviews = newReviews.slice(0, 25);
                break;
            }
            previousLength = newReviews.length;
        }

        await browser.close();
        return reviews;
    };

    if (!searchTerm) {
        return NextResponse.json({ error: 'searchTerm is required' }, { status: 400 });
    }

    try {
        
        if (searchTerm.startsWith('http') && !(searchTerm.includes('maps'))) {
            const reviews = await ScraperBusiness(searchTerm);
            return NextResponse.json(reviews);
        }

        const url = searchTerm.startsWith('http') ? searchTerm : `https://www.google.com/maps/search/${searchTerm}`;
        
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
