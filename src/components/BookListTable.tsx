import React, { useState } from 'react';
import { CategoryTab, RequestedBook } from '../types';
import {
  Trash2,
  BookOpen,
  AlertTriangle,
  ExternalLink,
  Edit2,
  Check,
  Plus,
  Minus,
  Search,
} from 'lucide-react';

interface Props {
  activeTab: CategoryTab;
  requestedBooks: RequestedBook[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onUpdateNotes: (id: string, newNotes: string) => void;
  onRemoveBook: (id: string) => void;
}

export const BookListTable: React.FC<Props> = ({
  activeTab,
  requestedBooks,
  onUpdateQuantity,
  onUpdateNotes,
  onRemoveBook,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Filter books by active category tab and search query
  const tabBooks = requestedBooks.filter((b) => b.category === activeTab);
  const filteredBooks = tabBooks.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.publisher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabTotalUnique = tabBooks.length;
  const tabTotalVolume = tabBooks.reduce((acc, b) => acc + b.quantity, 0);
  const tabTotalCost = tabBooks.reduce((acc, b) => acc + b.price * b.quantity, 0);

  const handleStartEditNotes = (book: RequestedBook) => {
    setEditingNotesId(book.id);
    setTempNotes(book.notes || '');
  };

  const handleSaveNotes = (id: string) => {
    onUpdateNotes(id, tempNotes.trim());
    setEditingNotesId(null);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs flex-1 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            {activeTab} 신청 목록 ({tabTotalUnique}건)
          </h3>
          <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-50 rounded border border-amber-100 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>중복 도서 자동 감지됨</span>
          </span>
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="목록 검색..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Book Items List Table */}
      {filteredBooks.length === 0 ? (
        <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-700">
            [{activeTab}]에 등록된 신청 도서가 없습니다.
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            상단 파싱 폼에서 링크를 붙여넣어 도서를 추가해 보세요.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  도서명
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  저자 / 출판사
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  수량
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">
                  합계 금액
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  비고
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filteredBooks.map((book) => {
                const isEditingThisNotes = editingNotesId === book.id;
                const itemTotal = book.price * book.quantity;

                return (
                  <tr
                    key={book.id}
                    className={`transition-colors ${
                      book.isDuplicate ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Status Badge */}
                    <td className="px-4 py-3 shrink-0">
                      {book.isDuplicate ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-bold uppercase tracking-wider">
                          ⚠️ 보유중
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                          NEW
                        </span>
                      )}
                    </td>

                    {/* Book Title & Link */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{book.title}</span>
                        {book.sourceUrl && (
                          <a
                            href={book.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title="도서 상세페이지 이동"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Author / Publisher */}
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {book.author} | {book.publisher}
                    </td>

                    {/* Quantity Selector */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center border border-slate-200 rounded overflow-hidden bg-white">
                        <button
                          onClick={() => onUpdateQuantity(book.id, -1)}
                          disabled={book.quantity <= 1}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs disabled:opacity-30"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800 min-w-[20px] text-center">
                          {book.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(book.id, 1)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Item Subtotal Price */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {itemTotal.toLocaleString('ko-KR')}원
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3">
                      {isEditingThisNotes ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(book.id)}
                            className="px-2 py-0.5 text-xs bg-white border border-blue-400 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNotes(book.id)}
                            className="p-0.5 bg-blue-600 text-white rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleStartEditNotes(book)}
                          className="group cursor-pointer flex items-center justify-between gap-1 text-xs text-slate-500 hover:text-slate-900"
                        >
                          <span className="truncate max-w-[120px]">
                            {book.notes || <span className="text-slate-300 italic">비고 작성...</span>}
                          </span>
                          <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRemoveBook(book.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Dark Bottom Bar */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase">총 권수</span>
            <span className="text-lg font-bold">{tabTotalVolume}권</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase">총 품목</span>
            <span className="text-lg font-bold">{tabTotalUnique}종</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            예상 결제 금액 ({activeTab})
          </span>
          <div className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
            {tabTotalCost.toLocaleString('ko-KR')}원
          </div>
        </div>
      </div>
    </section>
  );
};
