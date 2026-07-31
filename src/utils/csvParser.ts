import Papa from 'papaparse';
import { ExistingBook } from '../types';

export function parseCSVToBooks(csvContent: string): ExistingBook[] {
  const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsed.data || parsed.data.length === 0) {
    // Try headerless parsing if header mode yielded nothing or single column
    const rawParsed = Papa.parse<string[]>(csvContent.trim(), {
      header: false,
      skipEmptyLines: true,
    });

    return rawParsed.data.map((row, idx) => {
      return {
        id: `imported-${Date.now()}-${idx}`,
        title: row[0]?.trim() || '제목 없음',
        author: row[1]?.trim() || '저자 미상',
        publisher: row[2]?.trim() || '',
        registerNo: row[3]?.trim() || `LIB-IMP-${idx + 1}`,
        isbn: row[4]?.trim() || '',
        location: row[5]?.trim() || '',
      };
    });
  }

  return parsed.data.map((row, idx) => {
    // Flexible header column matching
    const findValue = (...keys: string[]): string => {
      for (const k of keys) {
        for (const [rowKey, val] of Object.entries(row)) {
          if (rowKey.toLowerCase().includes(k.toLowerCase()) && val) {
            return val.trim();
          }
        }
      }
      return '';
    };

    const title = findValue('도서명', '제목', 'title', 'book') || '제목 없음';
    const author = findValue('저자', '글', 'author', 'writer') || '저자 미상';
    const publisher = findValue('출판사', 'publisher', 'pub') || '';
    const registerNo = findValue('등록번호', '등록', 'id', 'reg') || `LIB-${Date.now()}-${idx}`;
    const isbn = findValue('isbn', '바코드', 'barcode') || '';
    const location = findValue('청구기호', '위치', '청구', 'location') || '';

    return {
      id: `imported-${Date.now()}-${idx}`,
      title,
      author,
      publisher,
      registerNo,
      isbn,
      location,
    };
  });
}
