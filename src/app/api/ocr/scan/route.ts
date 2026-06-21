import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { parseReceipt } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 3. Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'image/jpeg';
    const fileName = file.name || 'receipt.jpg';

    // 4. Run Gemini Parse or Mock Fallback
    const result = await parseReceipt(buffer, mimeType, fileName);

    return NextResponse.json({ result });

  } catch (error: any) {
    console.error('OCR Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
export const config = {
  api: {
    bodyParser: false, // Disables standard body parser to receive multipart form data
  },
};
