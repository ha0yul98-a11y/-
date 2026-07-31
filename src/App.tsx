import React, { useState, useEffect } from 'react';
import { CategoryTab, RequestedBook, ExistingBook, ToastMessage } from './types';
import { INITIAL_EXISTING_BOOKS } from './data/defaultBooks';
import { Navbar } from './components/Navbar';
import { LinkParserForm } from './components/LinkParserForm';
import { GradeTabNav } from './components/GradeTabNav';
import { BookListTable } from './components/BookListTable';
import { AdminModal } from './components/AdminModal';
import { SubmitModal } from './components/SubmitModal';
import { ToastContainer } from './components/ToastContainer';
import { BookOpen, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  // Active category tab state
  const [activeTab, setActiveTab] = useState<CategoryTab>('1학년');

  // Requested books state with localStorage persistence
  const [requestedBooks, setRequestedBooks] = useState<RequestedBook[]>(() => {
    try {
      const saved = localStorage.getItem('school_requested_books');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse requested books from localStorage', e);
    }
    // Initial demo sample requested books
    return [
      {
        id: 'sample-1',
        category: '1학년',
        title: '알사탕',
        author: '백희나',
        publisher: '책읽는곰',
        price: 13000,
        quantity: 5,
        notes: '1학년 학급문고 온책읽기 독서활동 교재',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=200',
        createdAt: new Date().toISOString(),
        isDuplicate: true,
        duplicateInfo: '알사탕 (백희나) [등록번호: LIB-2023-0050 | 출판사: 책읽는곰 | 위치: 유아/저학년 그림책 [813.8]]',
      },
      {
        id: 'sample-2',
        category: '1학년',
        title: '커다란 수박',
        author: '김아람',
        publisher: '사계절',
        price: 12000,
        quantity: 3,
        notes: '여름 학학 독서 수업 교재',
        createdAt: new Date().toISOString(),
        isDuplicate: false,
      },
      {
        id: 'sample-3',
        category: '3학년',
        title: '만복이네 떡집',
        author: '김리리',
        publisher: '비룡소',
        price: 11000,
        quantity: 10,
        notes: '3학년 학년 공동 도서 구입',
        createdAt: new Date().toISOString(),
        isDuplicate: true,
        duplicateInfo: '만복이네 떡집 (김리리) [등록번호: LIB-2023-0145 | 출판사: 비룡소]',
      },
      {
        id: 'sample-4',
        category: '교직원',
        title: '수학적 사고를 키우는 초등 수업',
        author: '박성철',
        publisher: '교육과학사',
        price: 18000,
        quantity: 2,
        notes: '수학과 교사 연구회 수록도서',
        createdAt: new Date().toISOString(),
        isDuplicate: false,
      },
    ];
  });

  // Existing library books state with localStorage persistence
  const [existingBooks, setExistingBooks] = useState<ExistingBook[]>(() => {
    try {
      const saved = localStorage.getItem('school_existing_books');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse existing books from localStorage', e);
    }
    return INITIAL_EXISTING_BOOKS;
  });

  // GAS Web App URL state
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('school_gas_url') || '';
  });

  // Admin auth state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('school_requested_books', JSON.stringify(requestedBooks));
    } catch (e) {
      console.error(e);
    }
  }, [requestedBooks]);

  useEffect(() => {
    try {
      localStorage.setItem('school_existing_books', JSON.stringify(existingBooks));
    } catch (e) {
      console.error(e);
    }
  }, [existingBooks]);

  useEffect(() => {
    localStorage.setItem('school_gas_url', gasUrl);
  }, [gasUrl]);

  // Toast Helper
  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Add new requested book
  const handleAddBook = (bookData: Omit<RequestedBook, 'id' | 'createdAt'>) => {
    const newBook: RequestedBook = {
      ...bookData,
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setRequestedBooks((prev) => [newBook, ...prev]);
  };

  // Modify item quantity
  const handleUpdateQuantity = (id: string, delta: number) => {
    setRequestedBooks((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const newQ = Math.max(1, b.quantity + delta);
          return { ...b, quantity: newQ };
        }
        return b;
      })
    );
  };

  // Modify item notes
  const handleUpdateNotes = (id: string, newNotes: string) => {
    setRequestedBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, notes: newNotes } : b))
    );
  };

  // Remove requested book item
  const handleRemoveBook = (id: string) => {
    const target = requestedBooks.find((b) => b.id === id);
    setRequestedBooks((prev) => prev.filter((b) => b.id !== id));
    if (target) {
      showToast('info', '신청 항목 삭제', `'${target.title}' 항목이 삭제되었습니다.`);
    }
  };

  // Clear all requested books
  const handleClearAllRequested = () => {
    setRequestedBooks([]);
    showToast('info', '목록 초기화', '전체 신청 도서 목록이 초기화되었습니다.');
  };

  // Admin login check
  const handleAdminLogin = (password: string): boolean => {
    if (password === 'admin') {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    showToast('info', '관리자 로그아웃', '관리자 모드가 종료되었습니다.');
  };

  // Overall statistics calculations
  const totalRequestedBooks = requestedBooks.length;
  const totalVolumeCount = requestedBooks.reduce((acc, b) => acc + b.quantity, 0);
  const totalBudgetCost = requestedBooks.reduce((acc, b) => acc + b.price * b.quantity, 0);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* High Density Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-slate-200 bg-white flex-col shrink-0 justify-between">
        {/* Top Branding Section */}
        <div>
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                도서 구매 관리
              </h1>
            </div>
            <p className="text-xs text-slate-400">Elementary School Admin v2.1</p>
          </div>

          {/* Grade Selector Nav */}
          <div className="p-4">
            <GradeTabNav
              activeTab={activeTab}
              requestedBooks={requestedBooks}
              onSelectTab={setActiveTab}
              layout="sidebar"
            />
          </div>
        </div>

        {/* Bottom Sidebar Action */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="w-full py-2 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-md transition shadow-xs"
          >
            관리자 모드 (admin)
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <Navbar
          totalRequestedBooks={totalRequestedBooks}
          totalVolumeCount={totalVolumeCount}
          totalBudgetCost={totalBudgetCost}
          isAdmin={isAdmin}
          gasUrl={gasUrl}
          activeTab={activeTab}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        />

        {/* Scrollable Content Workspace */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto flex flex-col">
          {/* Mobile Grade Selector */}
          <div className="lg:hidden">
            <GradeTabNav
              activeTab={activeTab}
              requestedBooks={requestedBooks}
              onSelectTab={setActiveTab}
              layout="horizontal"
            />
          </div>

          {/* URL Link Parser Form */}
          <LinkParserForm
            activeTab={activeTab}
            existingBooks={existingBooks}
            onAddBook={handleAddBook}
            onShowToast={showToast}
          />

          {/* High Density Requested Books List Table */}
          <BookListTable
            activeTab={activeTab}
            requestedBooks={requestedBooks}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateNotes={handleUpdateNotes}
            onRemoveBook={handleRemoveBook}
          />
        </div>
      </main>

      {/* Admin Management Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        isAdmin={isAdmin}
        gasUrl={gasUrl}
        existingBooks={existingBooks}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onClose={() => setIsAdminModalOpen(false)}
        onUpdateExistingBooks={setExistingBooks}
        onUpdateGasUrl={setGasUrl}
        onShowToast={showToast}
      />

      {/* Submit / Aggregation Modal */}
      <SubmitModal
        isOpen={isSubmitModalOpen}
        requestedBooks={requestedBooks}
        gasUrl={gasUrl}
        onClose={() => setIsSubmitModalOpen(false)}
        onClearAllRequested={handleClearAllRequested}
        onShowToast={showToast}
      />

      {/* Floating Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
