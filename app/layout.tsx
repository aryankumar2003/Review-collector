// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Dashboard App',
  description: 'A search-based dashboard with review scraping and suggestions',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-gray-100 text-gray-900 min-h-screen">
        <header className="bg-white shadow p-4">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
        </header>
        <main className="p-6">{children}</main>
        <footer className="mt-auto p-4 bg-white border-t text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Dashboard App
        </footer>
      </body>
    </html>
  );
}
