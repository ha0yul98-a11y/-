import { ExistingBook } from '../types';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedBook?: ExistingBook;
  duplicateReason?: string;
  duplicateInfo?: string;
}

/**
 * Normalizes title string for accurate comparison:
 * removes spacing, punctuation, brackets, case normalization.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)|<.*?>/g, '') // remove brackets content
    .replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '') // keep letters, numbers, Korean characters
    .trim();
}

/**
 * Checks if a given book title & author matches any existing library book.
 */
export function checkDuplicateBook(
  title: string,
  author: string,
  existingBooks: ExistingBook[]
): DuplicateCheckResult {
  if (!title || !title.trim()) {
    return { isDuplicate: false };
  }

  const normTitle = normalizeString(title);
  const normAuthor = normalizeString(author);

  if (!normTitle) {
    return { isDuplicate: false };
  }

  for (const book of existingBooks) {
    const existingNormTitle = normalizeString(book.title);
    const existingNormAuthor = normalizeString(book.author);

    // Exact or strong containment title match
    const titleMatch =
      normTitle === existingNormTitle ||
      (normTitle.length > 3 && existingNormTitle.includes(normTitle)) ||
      (existingNormTitle.length > 3 && normTitle.includes(existingNormTitle));

    const authorMatch =
      !normAuthor ||
      !existingNormAuthor ||
      normAuthor === existingNormAuthor ||
      existingNormAuthor.includes(normAuthor) ||
      normAuthor.includes(existingNormAuthor);

    if (titleMatch && authorMatch) {
      const regNo = book.registerNo ? `등록번호: ${book.registerNo}` : '';
      const loc = book.location ? `위치: ${book.location}` : '';
      const pub = book.publisher ? `출판사: ${book.publisher}` : '';
      const extraDetails = [regNo, pub, loc].filter(Boolean).join(' | ');

      return {
        isDuplicate: true,
        matchedBook: book,
        duplicateReason: `기존 보유 도서인 '${book.title}' (${book.author})와 일치합니다.`,
        duplicateInfo: extraDetails
          ? `${book.title} (${book.author}) [${extraDetails}]`
          : `${book.title} (${book.author})`,
      };
    }
  }

  return { isDuplicate: false };
}
