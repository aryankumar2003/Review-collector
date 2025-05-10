import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export async function POST(request: Request) {
  try {
    const { business, reviews } = await request.json();
    
    // Create a PDF document
    const doc = new PDFDocument();
    let buffers: Buffer[] = [];
    
    // Collect the PDF data chunks
    doc.on('data', buffers.push.bind(buffers));
    
    // Add content to PDF
    doc.fontSize(20).text(`Reviews for ${business}`, { align: 'center' });
    doc.moveDown();
    
    reviews.forEach((review: any, index: number) => {
      // Add some spacing between reviews
      if (index > 0) doc.moveDown(2);
      
      // Add reviewer name
      doc.fontSize(14).fillColor('#333333').text(review.fullName || 'Anonymous');
      
      // Add star rating
      doc.fontSize(12).fillColor('#FF3B30').text(`Rating: ${review.stars} stars`);
      doc.moveDown(0.5);
      
      // Add review text
      doc.fontSize(11).fillColor('#555555').text(review.reviewText || 'No review text provided');
      
      // Add a separator line
      if (index < reviews.length - 1) {
        doc.moveDown();
        doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      }
    });
    
    // Finalize the PDF
    doc.end();
    
    // Combine PDF chunks and convert to blob
    return new Promise<NextResponse>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${business.replace(/[^a-zA-Z0-9]/g, '_')}_reviews.pdf"`,
            },
          })
        );
      });
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}