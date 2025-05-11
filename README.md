# Dashboard App - Reviews Scraper

A modern web application for scraping, analyzing, and visualizing Google Maps reviews. This dashboard allows users to search for businesses, retrieve their reviews, and get valuable insights from customer feedback.

## Features

- 🔍 **Google Maps Review Scraping**: Fetch reviews for any business or location
- 📊 **Data Visualization**: View analytics based on review sentiment and ratings
- 💾 **Caching System**: Reduce redundant requests with built-in caching
- 🛡️ **Error Handling**: Robust error handling with retry logic
- 🌐 **Serverless Compatible**: Designed to work with edge functions
- 🔄 **Real-time Updates**: Dynamic content loading with scroll pagination

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API Routes (Edge Runtime)
- **Scraping Engine**: Puppeteer with Chromium
- **Styling**: Custom Tailwind theme with light/dark mode support

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/dashboard-app.git
   cd dashboard-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   # Any required environment variables
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Enter a business name or Google Maps URL in the search bar
2. The application will fetch and display available reviews
3. Use the dashboard controls to filter and analyze the data
4. View visualizations and insights about the business reviews

## API Endpoints

### GET `/api/scrape-reviews`

Scrapes reviews from Google Maps.

**Query Parameters:**
- `searchTerm` (required): Business name or Google Maps URL
- `skipCache` (optional): Set to "true" to bypass cache

**Response:**
```json
{
  "businessName": "Example Business",
  "totalReviews": 42,
  "averageRating": "4.5",
  "reviews": [
    {
      "fullName": "John Doe",
      "stars": "5 stars",
      "reviewText": "Great service!",
      "datePosted": "1 month ago",
      "reviewId": "123456"
    },
    // More reviews...
  ]
}
```

## Project Structure

```
├── app
│   ├── api
│   │   └── scrape-reviews
│   │       └── route.ts    # Review scraping API endpoint
│   ├── globals.css         # Global styles and Tailwind config
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Main page component
├── components
│   └── Dashboard.tsx       # Main dashboard component
└── ...
```

## Configuration

The scraper can be configured by modifying the `CONFIG` object in `app/api/scrape-reviews/route.ts`:

- `MAX_REVIEWS`: Maximum number of reviews to scrape (default: 25)
- `SCROLL_DELAY`: Delay between scroll attempts in ms (default: 2000)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 3600)
- And more...

## Error Handling

The application implements a retry mechanism with exponential backoff to handle transient failures. All errors are properly logged with unique request IDs for better traceability.

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Built with [Next.js](https://nextjs.org/)
- Web scraping powered by [Puppeteer](https://pptr.dev/)
- UI styled with [TailwindCSS](https://tailwindcss.com/)