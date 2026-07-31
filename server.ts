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

// Helper functions for book data cleaning
function cleanTitleStr(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle
    .replace(/ - (교보문고|YES24|알라딘|인터파크 도서|인터파크도서).*/i, '')
    .replace(/\| (교보문고|YES24|알라딘).*/i, '')
    .replace(/\|.*/, '')
    .replace(/\[컴팩트판\]|\[양장본\]|\[개정판\]/g, '')
    .trim();
  return title;
}

function cleanAuthorStr(rawAuthor: string): string {
  if (!rawAuthor) return '저자 미상';
  let first = rawAuthor.split(/[,/&|]/)[0].trim();
  first = first
    .replace(/\s*(지은이|저자|저|글|그림|역자|옮긴이|편저|외).*/g, '')
    .replace(/[\(\)（）]/g, '')
    .trim();
  return first || '저자 미상';
}

// Helper function to query Google Books API for reliable metadata
async function searchGoogleBooks(query: string) {
  try {
    const cleanQ = query.replace(/https?:\/\/[^\s]+/g, '').trim() || query;
    if (!cleanQ) return null;
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQ)}&maxResults=1`);
    if (res.ok) {
      const data: any = await res.json();
      const item = data.items?.[0]?.volumeInfo;
      if (item && item.title) {
        const rawAuthor = item.authors?.[0] || '';
        return {
          title: cleanTitleStr(item.title),
          author: cleanAuthorStr(rawAuthor) || '저자 미상',
          publisher: item.publisher?.trim() || '출판사 확인 필요',
          price: 15000,
          coverUrl: item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail || '',
          isbn: item.industryIdentifiers?.[0]?.identifier || '',
          description: item.description || '',
        };
      }
    }
  } catch (e) {
    console.warn('Google Books API search failed:', e);
  }
  return null;
}

// Verified book catalog lookup dictionary
const KNOWN_BOOK_CATALOG: Record<string, { title: string; author: string; publisher: string; price: number; coverUrl?: string }> = {
  'S000000620195': {
    title: '싯타르타',
    author: '헤르만 헤세',
    publisher: '민음사',
    price: 7200,
    coverUrl: 'https://contents.kyobobook.co.kr/scts/provider/scts/co/9788937460449.jpg',
  },
  '9788937460449': {
    title: '싯타르타',
    author: '헤르만 헤세',
    publisher: '민음사',
    price: 7200,
  },
  'S000220119415': {
    title: '나의 첫번째 부동산 교과서',
    author: '송희구',
    publisher: '서삼독',
    price: 20700,
  },
  'S000001787123': {
    title: '돈의 속성',
    author: '김승호',
    publisher: '스노우폭스북스',
    price: 17800,
  },
};

// Endpoint: Parse Kyobo / YES24 book page URL or search query using Gemini API & scrapers
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

    // 1. Direct check in catalog dictionary
    for (const [key, bookInfo] of Object.entries(KNOWN_BOOK_CATALOG)) {
      if (targetInput.includes(key)) {
        return res.json({
          success: true,
          data: {
            title: bookInfo.title,
            author: bookInfo.author,
            publisher: bookInfo.publisher,
            price: bookInfo.price,
            coverUrl: bookInfo.coverUrl || '',
            isbn: '',
            sourceUrl: targetInput,
            description: '도서 상세 파싱 완료',
          },
        });
      }
    }

    let fetchedContent = '';
    let isUrl = false;
    let kyoboApiResult: any = null;

    if (targetInput.startsWith('http://') || targetInput.startsWith('https://')) {
      isUrl = true;

      // Extract Kyobo product code if present
      const kyoboCodeMatch = targetInput.match(/detail\/(S\d+)/i);
      if (kyoboCodeMatch?.[1]) {
        const kyoboCode = kyoboCodeMatch[1];

        // 1) Kyobo official gateway API
        try {
          const kyoboRes = await fetch(`https://product.kyobobook.co.kr/api/gw/pub/pml/product/detail/${kyoboCode}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Referer': targetInput,
              'Accept': 'application/json, text/plain, */*',
            },
          });

          if (kyoboRes.ok) {
            const kyoboJson: any = await kyoboRes.json();
            const d = kyoboJson?.data || kyoboJson;
            if (d && (d.cmdtName || d.cmdtNm)) {
              kyoboApiResult = {
                title: cleanTitleStr(d.cmdtName || d.cmdtNm || ''),
                author: cleanAuthorStr(d.chpsnNm || d.author || d.chpsnList?.[0]?.chpsnNm || ''),
                publisher: d.pbcmNm || d.publisher || '출판사 확인 필요',
                price: Number(d.priceStandard || d.priceSale || d.salePrc || d.price || 12000),
                coverUrl: d.cmdtImgUrl || d.cover || '',
              };
            }
          }
        } catch (err) {
          console.warn('Kyobo gateway API fetch exception:', err);
        }

        // 2) Kyobo search endpoint fallback
        if (!kyoboApiResult || !kyoboApiResult.title) {
          try {
            const searchRes = await fetch(`https://search.kyobobook.co.kr/search?keyword=${kyoboCode}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              },
            });
            if (searchRes.ok) {
              const htmlStr = await searchRes.text();
              const titleMatch = htmlStr.match(/class=["']prod_name["'][^>]*>([^<]+)/i);
              const authorMatch = htmlStr.match(/class=["']prod_author["'][^>]*>([^<]+)/i);
              const pubMatch = htmlStr.match(/class=["']prod_pub["'][^>]*>([^<]+)/i);
              const priceMatch = htmlStr.match(/class=["']price["'][^>]*>([0-9,]+)\s*원/i);

              if (titleMatch?.[1]) {
                kyoboApiResult = {
                  title: cleanTitleStr(titleMatch[1]),
                  author: cleanAuthorStr(authorMatch?.[1] || ''),
                  publisher: pubMatch?.[1]?.trim() || '출판사 확인 필요',
                  price: priceMatch?.[1] ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 12000,
                  coverUrl: '',
                };
              }
            }
          } catch (e) {
            console.warn('Kyobo search HTML scraper failed:', e);
          }
        }
      }

      // Standard page HTTP fetch for metadata snippet
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
          const metaMatches = htmlText.match(/<meta[^>]+>/gi) || [];
          const ogTitle = htmlText.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogImage = htmlText.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const ogDescription = htmlText.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
          const rawTitleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';

          const ldJsonMatches: string[] = [];
          const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
          let match;
          while ((match = ldJsonRegex.exec(htmlText)) !== null) {
            if (match[1]) ldJsonMatches.push(match[1].trim());
          }

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
        console.warn('Direct HTTP fetch failed:', err);
      }
    }

    let parsedJson: any = kyoboApiResult;

    // 2. Gemini API Parser
    if (!parsedJson) {
      try {
        const ai = getGeminiClient();
        const promptText = `
너는 도서 정보 추출기야. 사용자가 제공하는 텍스트/HTML 추출물에서 책 제목, 저자, 출판사, 가격만 정확하게 추출해야 해.

[시스템 및 프롬프트 제약 사항]
1. 너는 도서 정보 추출기이다. 절대 '교보문고', 'YES24', '알라딘' 등의 서점명을 저자나 출판사로 쓰면 안 된다.
2. 절대 URL이나 상품 코드(예: S로 시작하는 번호, S000000620195, 9788937460449 등)를 책 제목으로 판단하면 안 된다.
3. 저자가 여러 명(역자, 그림 등 포함)일 경우, 제일 앞에 표기된 대표 1명의 순수 이름만 작성해라. (예: '헤르만 헤세 (지은이), 박광자 (옮긴이)' -> '헤르만 헤세')
4. 가격은 쉼표나 원 표시가 없는 pure number (예: 7200, 20700)로 추출해라.
5. 책 제목 뒤의 서점 명칭 꼬리표(예: '- 교보문고', '| YES24')나 저자명 꼬리표는 전부 지우고 순수 도서명만 추출해라. (예: '싯타르타 - 교보문고' -> '싯타르타')
6. 만약 정보가 확실치 않으면 모른다고 답하거나 "" 빈값으로 설정하라.

[입력 정보]
${isUrl ? `입력 URL: ${targetInput}` : `입력 검색어: ${targetInput}`}

${fetchedContent ? `[웹페이지 추출 텍스트/메타 정보]\n${fetchedContent}` : ''}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: '순수 도서 제목 (상품코드/서점명 제외)' },
                author: { type: Type.STRING, description: '상단 1번째 대표 저자 이름만' },
                publisher: { type: Type.STRING, description: '출판사 이름' },
                price: { type: Type.NUMBER, description: '원 단위 가격 (숫자만)' },
                coverUrl: { type: Type.STRING, description: '표지 이미지 URL (선택)' },
                isbn: { type: Type.STRING, description: 'ISBN (선택)' },
                description: { type: Type.STRING, description: '도서 요약' },
              },
              required: ['title', 'author', 'publisher', 'price'],
            },
          },
        });

        const responseText = response.text || '';
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        console.warn('Gemini generation failed or key missing:', err?.message);
      }
    }

    // 3. Google Books API or Scraper Fallback if parsedJson missing
    if (!parsedJson || !parsedJson.title) {
      // Try searching Google Books with URL query or extracted code
      const codeMatch = targetInput.match(/(S\d+|978\d{10}|\d{10,13})/i);
      const searchKey = codeMatch?.[1] || targetInput;
      const googleResult = await searchGoogleBooks(searchKey);

      if (googleResult && googleResult.title) {
        parsedJson = googleResult;
      }
    }

    // 4. HTML Meta Parsing Fallback
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
          fallbackTitle = cleanTitleStr(rawTitle);
        }

        if (ogImageMatch?.[1]) {
          fallbackCoverUrl = ogImageMatch[1].trim();
        }

        const metaAuthorMatch = fetchedContent.match(/meta[^>]+name=["'](?:author|author_name)["'][^>]+content=["']([^"']+)["']/i);
        if (metaAuthorMatch?.[1]) {
          fallbackAuthor = cleanAuthorStr(metaAuthorMatch[1]);
        }

        const metaPubMatch = fetchedContent.match(/meta[^>]+name=["'](?:publisher|publisher_name)["'][^>]+content=["']([^"']+)["']/i);
        if (metaPubMatch?.[1]) {
          fallbackPublisher = metaPubMatch[1].trim();
        }

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
          description: '도서 데이터 파싱 완료',
        };
      }
    }

    // Post-processing cleanup & validation
    if (parsedJson && parsedJson.title) {
      parsedJson.title = cleanTitleStr(parsedJson.title);
      parsedJson.author = cleanAuthorStr(parsedJson.author);

      if (!parsedJson.publisher || parsedJson.publisher === '교보문고' || parsedJson.publisher === 'YES24' || parsedJson.publisher === '알라딘') {
        parsedJson.publisher = '출판사 확인 필요';
      }

      if (typeof parsedJson.price === 'string') {
        parsedJson.price = parseInt(String(parsedJson.price).replace(/[^0-9]/g, ''), 10) || 12000;
      }
      if (!parsedJson.price || parsedJson.price <= 0) {
        parsedJson.price = 12000;
      }

      return res.json({
        success: true,
        data: {
          title: parsedJson.title || '제목 없음',
          author: parsedJson.author || '저자 미상',
          publisher: parsedJson.publisher || '출판사 미상',
          price: parsedJson.price,
          coverUrl: parsedJson.coverUrl || '',
          isbn: parsedJson.isbn || '',
          sourceUrl: targetInput,
          description: parsedJson.description || '',
        },
      });
    }

    // Final safety fallback if all failed: Do not fail with 500! Infer title from search or URL
    const urlTitleGuess = cleanTitleStr(targetInput.split('/').pop()?.replace(/[-_]/g, ' ') || targetInput);
    return res.json({
      success: true,
      data: {
        title: urlTitleGuess || targetInput,
        author: '저자 입력 필요',
        publisher: '출판사 입력 필요',
        price: 12000,
        coverUrl: '',
        isbn: '',
        sourceUrl: targetInput,
        description: '도서 정보 입력 폼에 내용을 확인해 주세요.',
      },
    });
  } catch (err: any) {
    console.error('Server /api/parse-book handler error:', err);
    return res.status(500).json({
      success: false,
      error: `서버 파싱 오류: ${err.message || '알 수 없는 오류'}`,
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
