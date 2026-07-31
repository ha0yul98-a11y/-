import React from 'react';
import { BookOpen, ShieldCheck, ShieldAlert, Send, Layers, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  totalRequestedBooks: number;
  totalVolumeCount: number;
  totalBudgetCost: number;
  isAdmin: boolean;
  gasUrl: string;
  activeTab: string;
  onOpenAdmin: () => void;
  onOpenSubmitModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRequestedBooks,
  totalVolumeCount,
  totalBudgetCost,
  isAdmin,
  gasUrl,
  activeTab,
  onOpenAdmin,
  onOpenSubmitModal,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0 z-20 shadow-xs">
      {/* Left: Tab Title & Sync Status */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-xs sm:text-sm font-semibold text-slate-500">
          현재 탭: <span className="text-blue-600 font-bold">{activeTab} 도서 신청 현황</span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-slate-200" />
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{gasUrl ? 'Google Sheets 연동 준비됨' : '구글 시트 연동 가능'}</span>
        </div>
      </div>

      {/* Right Actions & Stats */}
      <div className="flex items-center gap-3">
        {/* Quick Stats Summary */}
        <div className="hidden md:flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">
          <div>
            <span>총 품목: </span>
            <strong className="text-slate-900 font-bold">{totalRequestedBooks}종</strong>
          </div>
          <span className="text-slate-300">•</span>
          <div>
            <span>총 권수: </span>
            <strong className="text-blue-600 font-bold">{totalVolumeCount}권</strong>
          </div>
          <span className="text-slate-300">•</span>
          <div>
            <span>예상금액: </span>
            <strong className="text-slate-900 font-bold font-mono">
              ₩{totalBudgetCost.toLocaleString('ko-KR')}
            </strong>
          </div>
        </div>

        {/* Admin Button */}
        <button
          onClick={onOpenAdmin}
          id="admin-mode-btn"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition border ${
            isAdmin
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {isAdmin ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>관리자</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>관리자</span>
            </>
          )}
        </button>

        {/* Submit to GAS Button */}
        <button
          onClick={onOpenSubmitModal}
          id="submit-gas-btn"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs sm:text-sm font-bold shadow-xs transition active:scale-[0.98]"
        >
          <Send className="w-4 h-4" />
          <span>취합하기 (Sync to GAS)</span>
          {totalRequestedBooks > 0 && (
            <span className="ml-0.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-bold">
              {totalRequestedBooks}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

