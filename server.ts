import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// CORS & Options handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Favicon handler to avoid 404 warning in browser console
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Helper function to initialize Gemini AI lazily
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY environment variable is missing or not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

// Endpoint: Parse Kyobo / YES24 book page URL or search query using Gemini API
app.post(['/api/parse-book', '/api/parse-book/'], async (req, res) => {
  try {
    const { url, query } = req.body;
    const targetInput = url || query;

    if (!targetInput || typeof targetInput !== 'string') {
      return res.status(400).json({
        success: false,
        error: '올바른 도서 상세 페이지 URL 또는 도서 검색어를 입력해 주세요.',
      });
    }

    let fetchedContent = '';
    let isUrl = false;

    if (targetInput.startsWith('http://') || targetInput.startsWith('https://')) {
      isUrl = true;
      try {
        const fetchRes = await fetch(targetInput, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });

        if (fetchRes.ok) {
          const htmlText = await fetchRes.text();
          // Extract title, meta tags, and body text snippets to keep prompt manageable
          const metaMatches = htmlText.match(/<meta[^>]+>/gi) || [];
          const ogTitle = htmlText.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogImage = htmlText.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogDescription = htmlText.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const rawTitleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';

          // Strip heavy scripts and styles
          const strippedBody = htmlText
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 10000);

          fetchedContent = `
PAGE META INFO:
- Title Tag: ${rawTitleMatch}
- OG Title: ${ogTitle}
- OG Image: ${ogImage}
- OG Description: ${ogDescription}
- Meta Tags: ${metaMatches.slice(0, 35).join('\n')}

PAGE TEXT CONTENT SNIPPET:
${strippedBody}
`;
        }
      } catch (err) {
        console.warn('Direct HTTP fetch failed, falling back to URL metadata parsing with Gemini:', err);
      }
    }

    // Call Gemini API on server side if available, or use regex fallback
    let parsedJson: any = null;
    let geminiErrorMsg = '';

    try {
      const ai = getGeminiClient();
      const promptText = `
너는 대한민국 인터넷 서점(교보문고, YES24, 알라딘 등)의 도서 상세 페이지 정보를 정밀하게 분석하는 AI 파서이다.
입력된 ${isUrl ? '도서 URL 및 HTML 웹페이지 추출 정보' : '도서 검색어/정보'}를 분석하여 정확한 도서명, 저자, 출판사, 정가(가격, 원 단위 숫자), 대표 커버 이미지 URL, ISBN을 파싱하여 JSON 형태로 추출하라.

${isUrl ? `입력 URL: ${targetInput}` : `입력 검색어: ${targetInput}`}

${fetchedContent ? `[웹페이지 추출 정보]\n${fetchedContent}` : ''}

[작성 규칙]
1. 도서명(title): 부제나 시리즈명이 포함된 완벽하고 깨끗한 한국어 도서 제목.
2. 저자(author): 저자명 (예: '홍길동', '김철수 글, 이영희 그림').
3. 출판사(publisher): 출판사 이름 (예: '비룡소', '창비').
4. 가격(price): 숫자만 기재 (예: 13000, 15000). 단위나 쉼표 제외. 가격을 알 수 없는 경우 적절한 도서 가격 추정치 숫자.
5. coverUrl: 추출된 도서 표지 이미지 URL이 있다면 해당 URL, 없으면 "" (빈 문자열).
6. isbn: 13자리 ISBN 또는 10자리 ISBN (없으면 "").
7. description: 책 소개 간략히 1~2문장.

반드시 JSON 규격에 맞게 반환하라.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: '도서명' },
              author: { type: Type.STRING, description: '저자' },
              publisher: { type: Type.STRING, description: '출판사' },
              price: { type: Type.NUMBER, description: '정가(원)' },
              coverUrl: { type: Type.STRING, description: '표지 이미지 URL' },
              isbn: { type: Type.STRING, description: 'ISBN' },
              description: { type: Type.STRING, description: '도서 설명' },
            },
            required: ['title', 'author', 'publisher', 'price'],
          },
        },
      });

      const responseText = response.text || '';
      parsedJson = JSON.parse(responseText);
    } catch (err: any) {
      console.warn('Gemini generation failed or key missing, attempting regex fallback:', err?.message);
      geminiErrorMsg = err?.message || '';
    }

    // Fallback parsing if Gemini failed or key not configured
    if (!parsedJson || !parsedJson.title) {
      let fallbackTitle = '';
      let fallbackAuthor = '';
      let fallbackPublisher = '';
      let fallbackPrice = 12000;
      let fallbackCoverUrl = '';

      if (fetchedContent) {
        const ogTitleMatch = fetchedContent.match(/- OG Title: ([^\n]+)/);
        const titleTagMatch = fetchedContent.match(/- Title Tag: ([^\n]+)/);
        const ogImageMatch = fetchedContent.match(/- OG Image: ([^\n]+)/);

        const rawTitle = ogTitleMatch?.[1] || titleTagMatch?.[1] || '';
        if (rawTitle) {
          // Clean common bookstore suffixes (e.g. "- 교보문고", "- YES24")
          fallbackTitle = rawTitle
            .replace(/ - (교보문고|YES24|알라딘|인터파크 도서).*/i, '')
            .replace(/\| (교보문고|YES24|알라딘).*/i, '')
            .trim();
        }

        if (ogImageMatch?.[1]) {
          fallbackCoverUrl = ogImageMatch[1].trim();
        }
      }

      if (!fallbackTitle && !isUrl) {
        fallbackTitle = targetInput;
      }

      if (fallbackTitle) {
        parsedJson = {
          title: fallbackTitle,
          author: fallbackAuthor || '저자 확인 필요',
          publisher: fallbackPublisher || '출판사 확인 필요',
          price: fallbackPrice,
          coverUrl: fallbackCoverUrl,
          isbn: '',
          description: 'Gemini 키 미설정 또는 네트워크 폴백 추출 데이터입니다.',
        };
      } else {
        return res.status(500).json({
          success: false,
          error: geminiErrorMsg
            ? `Gemini API 오류: ${geminiErrorMsg}`
            : '도서 정보를 분석하지 못했습니다. GEMINI_API_KEY 설정 및 URL을 확인해 주세요.',
        });
      }
    }

    return res.json({
      success: true,
      data: {
        title: parsedJson.title || '제목 없음',
        author: parsedJson.author || '저자 미상',
        publisher: parsedJson.publisher || '출판사 미상',
        price: typeof parsedJson.price === 'number' ? parsedJson.price : 12000,
        coverUrl: parsedJson.coverUrl || '',
        isbn: parsedJson.isbn || '',
        description: parsedJson.description || '',
        sourceUrl: targetInput,
      },
    });
  } catch (error: any) {
    console.error('API Error in /api/parse-book:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Gemini API 호출 중 오류가 발생했습니다. GEMINI_API_KEY 설정을 확인해 주세요.',
    });
  }
});

// Endpoint: Proxy request to Google Apps Script Web App to safely handle POST submission without CORS issues
app.post('/api/gas-proxy', async (req, res) => {
  try {
    const { gasUrl, payload } = req.body;

    if (!gasUrl || !gasUrl.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: '올바른 Google Apps Script 배포 URL을 입력해 주세요.',
      });
    }

    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS Web App receives raw body in e.postData.contents
      },
      body: JSON.stringify(payload),
    });

    const responseText = await gasResponse.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawText: responseText };
    }

    return res.json({
      success: gasResponse.ok,
      status: gasResponse.status,
      data: responseData,
    });
  } catch (error: any) {
    console.error('GAS Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || '구글 시트(GAS) 전송 중 서버 통신 오류가 발생했습니다.',
    });
  }
});

// Explicit 404 JSON handler for /api/* to ensure API requests always return JSON, never HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `요청하신 API 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
  });
});

// Start dev server with Vite middleware or static dist server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
