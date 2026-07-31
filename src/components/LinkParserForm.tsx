import React, { useState, useEffect } from 'react';
import { CategoryTab, ExistingBook, CATEGORY_TABS, RequestedBook } from '../types';
import { checkDuplicateBook, DuplicateCheckResult } from '../utils/duplicateCheck';
import {
  Link as LinkIcon,
  Sparkles,
  AlertTriangle,
  Plus,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  Building2,
  Tag,
  FileText,
} from 'lucide-react';

interface Props {
  activeTab: CategoryTab;
  existingBooks: ExistingBook[];
  onAddBook: (book: Omit<RequestedBook, 'id' | 'createdAt'>) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const LinkParserForm: React.FC<Props> = ({
  activeTab,
  existingBooks,
  onAddBook,
  onShowToast,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // Form states
  const [targetCategory, setTargetCategory] = useState<CategoryTab>(activeTab);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [price, setPrice] = useState<number>(12000);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isbn, setIsbn] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Duplicate check state
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult>({
    isDuplicate: false,
  });

  // Sync target category with active tab when user switches tabs
  useEffect(() => {
    setTargetCategory(activeTab);
  }, [activeTab]);

  // Real-time duplicate check whenever title or author changes
  useEffect(() => {
    if (title.trim()) {
      const res = checkDuplicateBook(title, author, existingBooks);
      setDuplicateResult(res);
    } else {
      setDuplicateResult({ isDuplicate: false });
    }
  }, [title, author, existingBooks]);

  // Handle URL parsing with Gemini API backend (/api/parse-book)
  const handleParseLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) {
      onShowToast('warning', '링크/검색어 입력 필요', '교보문고 또는 YES24 상세 페이지 링크를 입력해 주세요.');
      return;
    }

    setIsParsing(true);
    try {
      const res = await fetch('/api/parse-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '도서 정보를 파싱하지 못했습니다.');
      }

      const parsed = data.data;
      setTitle(parsed.title || '');
      setAuthor(parsed.author || '');
      setPublisher(parsed.publisher || '');
      setPrice(parsed.price || 12000);
      setCoverUrl(parsed.coverUrl || '');
      setIsbn(parsed.isbn || '');
      setSourceUrl(parsed.sourceUrl || urlInput);

      onShowToast(
        'success',
        '도서 정보 파싱 완료',
        `'${parsed.title}' 도서 정보가 성공적으로 자동 입력되었습니다.`
      );
    } catch (err: any) {
      console.error('Parse error:', err);
      onShowToast(
        'error',
        '도서 파싱 실패',
        err.message || '웹페이지 도서 정보를 가져오는 중 오류가 발생했습니다.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  // Submit book entry
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('warning', '도서명 필수', '신청할 도서명을 입력해 주세요.');
      return;
    }

    onAddBook({
      category: targetCategory,
      title: title.trim(),
      author: author.trim() || '미상',
      publisher: publisher.trim() || '미상',
      price: Number(price) || 0,
      quantity: Math.max(1, Number(quantity) || 1),
      notes: notes.trim(),
      coverUrl: coverUrl.trim(),
      isbn: isbn.trim(),
      sourceUrl: sourceUrl.trim() || urlInput.trim(),
      isDuplicate: duplicateResult.isDuplicate,
      duplicateInfo: duplicateResult.duplicateInfo,
    });

    onShowToast(
      duplicateResult.isDuplicate ? 'warning' : 'success',
      duplicateResult.isDuplicate ? '중복 도서 신청 등록' : '도서 신청 완료',
      duplicateResult.isDuplicate
        ? `'${title}' 도서가 [${targetCategory}] 신청 목록에 추가되었습니다. (보유도서 중복 ⚠️)`
        : `'${title}' 도서가 [${targetCategory}] 신청 목록에 추가되었습니다.`
    );

    // Reset form for next entry
    setTitle('');
    setAuthor('');
    setPublisher('');
    setPrice(12000);
    setQuantity(1);
    setNotes('');
    setCoverUrl('');
    setIsbn('');
    setUrlInput('');
    setSourceUrl('');
    setDuplicateResult({ isDuplicate: false });
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex-shrink-0 mb-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">
        도서 상세 링크 자동 분석 (Gemini AI)
      </h3>

      {/* URL Link Parser Input */}
      <form onSubmit={handleParseLink} className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="교보문고 또는 YES24 도서 상세 URL을 입력하세요..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isParsing || !urlInput.trim()}
            id="parse-book-btn"
            className="shrink-0 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            {isParsing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>정보 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>정보 파싱하기</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Warning Popover / Banner */}
      {duplicateResult.isDuplicate && (
        <div className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2">
              <strong className="font-bold text-xs text-amber-950">
                ⚠️ 기존 보유중 도서입니다
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                보유 중복
              </span>
            </div>
            <p className="mt-1 text-amber-800 leading-snug">
              {duplicateResult.duplicateReason}
            </p>
            {duplicateResult.duplicateInfo && (
              <p className="mt-1 font-mono text-[11px] bg-amber-100/80 px-2 py-0.5 rounded text-amber-900">
                {duplicateResult.duplicateInfo}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Manual & Auto-filled Book Detail Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* Target Grade Tab */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              신청 대상
            </label>
            <select
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value as CategoryTab)}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {CATEGORY_TABS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Book Title */}
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              도서명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="도서 제목 입력"
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              저자
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="글/그림 저자"
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Publisher */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              출판사
            </label>
            <input
              type="text"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="출판사명"
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              정가 (원)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 font-mono text-right focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Second Row: Quantity, Notes, Submit */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              수량 (권)
            </label>
            <div className="flex items-center border border-slate-200 rounded overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full text-center text-xs py-1 font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                +
              </button>
            </div>
          </div>

          <div className="sm:col-span-6">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              신청 사유 / 비고
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 1학기 학급문고용, 온책읽기 독서활동 교재"
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              id="add-to-tab-btn"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>[{targetCategory}] 추가하기</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
