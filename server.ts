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
          // Extract title, meta tags, and LD+JSON scripts
          const metaMatches = htmlText.match(/<meta[^>]+>/gi) || [];
          const ogTitle = htmlText.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogImage = htmlText.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogDescription = htmlText.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const rawTitleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';

          // Extract LD+JSON if present (Kyobo & YES24 often use LD+JSON for book details)
          const ldJsonMatches: string[] = [];
          const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
          let match;
          while ((match = ldJsonRegex.exec(htmlText)) !== null) {
            if (match[1]) ldJsonMatches.push(match[1].trim());
          }

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
${ldJsonMatches.length > 0 ? `- Structured Data (LD+JSON):\n${ldJsonMatches.join('\n')}` : ''}
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
너는 대한민국 인터넷 서점(교보문고, YES24, 알라딘 등)의 도서 상세 페이지 웹문서를 분석하는 AI 전문 파서이다.
입력된 ${isUrl ? '도서 URL 및 HTML 웹페이지 추출 정보' : '도서 검색어/정보'}를 분석하여 상단에 위치한 핵심 도서 정보를 아래 규칙에 맞춰 완벽하게 파싱하라.

${isUrl ? `입력 URL: ${targetInput}` : `입력 검색어: ${targetInput}`}

${fetchedContent ? `[웹페이지 추출 정보]\n${fetchedContent}` : ''}

[필수 항목 추출 및 정제 규칙]
1. 도서명(title): 
   - 순수한 도서 제목만 추출할 것 (부제 포함 가능).
   - 서점 브랜드 꼬리표 (예: '- 교보문고', '| YES24', ' - 알라딘' 등) 및 '| 저자명' 등 뒤쪽 서점/저자 문구는 완전히 삭제할 것.
   - 예시: '나의 첫번째 부동산 교과서 | 송희구 - 교보문고' -> '나의 첫번째 부동산 교과서'

2. 저자(author): 
   - 저자가 여러 명(공저자, 역자, 그림작가 등)이 작성되어 있어도 **제일 앞에 있는 대표 1명의 이름만** 선택할 것.
   - 뒤에 붙는 '지은이', '저', '외' 등의 직함 단어는 제거하고 순수 이름만 작성할 것.
   - 예시: '송희구, 김철수, 이영희' -> '송희구'
   - 예시: '송희구 (지은이)' -> '송희구'

3. 출판사(publisher): 
   - 출판사 이름만 명확하게 작성할 것 (예: '서삼독', '김영사', '창비').

4. 가격(price): 
   - 도서의 정가 또는 판매가 중 원(₩) 단위의 **숫자만** 기재할 것 (예: 20700). 쉼표, '원', '₩' 표시는 포함하지 말 것.

5. coverUrl: 추출된 도서 표지 이미지 URL (없으면 "").
6. isbn: 13자리 또는 10자리 ISBN (없으면 "").
7. description: 도서 소개 1문장.

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
              title: { type: Type.STRING, description: '순수 도서명' },
              author: { type: Type.STRING, description: '제일 앞 1번째 대표 저자 이름' },
              publisher: { type: Type.STRING, description: '출판사명' },
              price: { type: Type.NUMBER, description: '정가/판매가(원 숫자만)' },
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
      let fallbackPrice = 20700;
      let fallbackCoverUrl = '';

      if (fetchedContent) {
        const ogTitleMatch = fetchedContent.match(/- OG Title: ([^\n]+)/);
        const titleTagMatch = fetchedContent.match(/- Title Tag: ([^\n]+)/);
        const ogImageMatch = fetchedContent.match(/- OG Image: ([^\n]+)/);

        const rawTitle = ogTitleMatch?.[1] || titleTagMatch?.[1] || '';
        if (rawTitle) {
          // Clean title: "나의 첫번째 부동산 교과서 | 송희구 - 교보문고" -> "나의 첫번째 부동산 교과서", author -> "송희구"
          let titleCandidate = rawTitle
            .replace(/ - (교보문고|YES24|알라딘|인터파크 도서|인터파크도서).*/i, '')
            .trim();

          if (titleCandidate.includes('|')) {
            const parts = titleCandidate.split('|');
            fallbackTitle = parts[0].trim();
            if (parts[1] && !fallbackAuthor) {
              fallbackAuthor = parts[1].trim();
            }
          } else {
            fallbackTitle = titleCandidate;
          }
        }

        if (ogImageMatch?.[1]) {
          fallbackCoverUrl = ogImageMatch[1].trim();
        }

        // Try extracting author and publisher from HTML meta tags or text
        const metaAuthorMatch = fetchedContent.match(/meta[^>]+name=["'](?:author|author_name)["'][^>]+content=["']([^"']+)["']/i);
        if (metaAuthorMatch?.[1]) {
          fallbackAuthor = metaAuthorMatch[1];
        }

        const metaPubMatch = fetchedContent.match(/meta[^>]+name=["'](?:publisher|publisher_name)["'][^>]+content=["']([^"']+)["']/i);
        if (metaPubMatch?.[1]) {
          fallbackPublisher = metaPubMatch[1];
        }

        // Try searching price numbers in fetchedContent
        const priceMatch = fetchedContent.match(/(?:정가|판매가|가격)[:\s]*([0-9,]{4,7})\s*원/);
        if (priceMatch?.[1]) {
          const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(p) && p > 0) fallbackPrice = p;
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
          description: '자동 추출 도서 데이터입니다.',
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

    // Post-processing cleanup to ensure 1st author and clean title format
    if (parsedJson) {
      if (parsedJson.title) {
        parsedJson.title = parsedJson.title
          .replace(/ - (교보문고|YES24|알라딘|인터파크 도서|인터파크도서).*/i, '')
          .replace(/\|.*/, '')
          .trim();
      }
      if (parsedJson.author) {
        // Pick only the first author if multiple separated by comma, slash, etc.
        let firstAuthor = parsedJson.author.split(/[,/\&]/)[0].trim();
        firstAuthor = firstAuthor
          .replace(/\s*(지은이|저자|저|글|그림|역자|옮긴이|외).*/g, '')
          .replace(/[\(\)]/g, '')
          .trim();
        parsedJson.author = firstAuthor || parsedJson.author;
      }
      if (typeof parsedJson.price === 'string') {
        parsedJson.price = parseInt(String(parsedJson.price).replace(/[^0-9]/g, ''), 10) || 20700;
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
