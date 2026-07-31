import React, { useState } from 'react';
import { RequestedBook, CATEGORY_TABS, CategoryTab } from '../types';
import {
  Send,
  X,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Download,
  Layers,
  Building2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  requestedBooks: RequestedBook[];
  gasUrl: string;
  onClose: () => void;
  onClearAllRequested: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const SubmitModal: React.FC<Props> = ({
  isOpen,
  requestedBooks,
  gasUrl,
  onClose,
  onClearAllRequested,
  onShowToast,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // Breakdown statistics per category
  const breakdown = CATEGORY_TABS.map((tab) => {
    const tabItems = requestedBooks.filter((b) => b.category === tab);
    const count = tabItems.length;
    const volume = tabItems.reduce((acc, b) => acc + b.quantity, 0);
    const cost = tabItems.reduce((acc, b) => acc + b.price * b.quantity, 0);
    return { tab, count, volume, cost, items: tabItems };
  });

  const totalUnique = requestedBooks.length;
  const totalVolume = requestedBooks.reduce((acc, b) => acc + b.quantity, 0);
  const totalCost = requestedBooks.reduce((acc, b) => acc + b.price * b.quantity, 0);
  const duplicateCount = requestedBooks.filter((b) => b.isDuplicate).length;

  // Export to CSV with UTF-8 BOM so Excel opens Korean text without gibberish
  const handleDownloadCSV = () => {
    if (requestedBooks.length === 0) {
      onShowToast('warning', '신청 도서 없음', '다운로드할 신청 도서가 없습니다.');
      return;
    }

    const headers = [
      '신청대상',
      '도서명',
      '저자',
      '출판사',
      '정가(원)',
      '수량',
      '합계금액(원)',
      '신청사유/비고',
      '보유도서중복여부',
      '상세링크',
    ];

    const rows = requestedBooks.map((b) => [
      `"${b.category}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.author.replace(/"/g, '""')}"`,
      `"${b.publisher.replace(/"/g, '""')}"`,
      b.price,
      b.quantity,
      b.price * b.quantity,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
      b.isDuplicate ? '기존보유도서' : '정상',
      `"${b.sourceUrl || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `초등학교_도서구매신청취합_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onShowToast('success', 'CSV 다운로드 완료', '엑셀 연동용 CSV 파일이 생성되었습니다.');
  };

  // Submit all items to Google Sheets via GAS Web App URL
  const handleSubmitToGAS = async () => {
    if (requestedBooks.length === 0) {
      onShowToast('warning', '신청 도서 없음', '취합 전송할 신청 도서가 없습니다.');
      return;
    }

    const targetUrl = gasUrl || (import.meta as any).env?.VITE_GAS_URL || '';

    if (!targetUrl) {
      onShowToast(
        'warning',
        '구글 시트 URL 미설정',
        '관리자 모드에서 Google Apps Script (GAS) URL을 입력한 후 시도해 주세요.'
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    const payload = {
      action: 'submitBooks',
      timestamp: new Date().toLocaleString('ko-KR'),
      totalItems: totalUnique,
      totalVolume,
      totalCost,
      items: requestedBooks.map((b) => ({
        category: b.category,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        price: b.price,
        quantity: b.quantity,
        notes: b.notes,
        isDuplicate: b.isDuplicate,
        duplicateInfo: b.duplicateInfo,
        sourceUrl: b.sourceUrl,
      })),
    };

    try {
      const res = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gasUrl: targetUrl,
          payload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitStatus('success');
        setStatusMessage(
          data.data?.message ||
            `총 ${totalUnique}종 (${totalVolume}권, ₩${totalCost.toLocaleString(
              'ko-KR'
            )})의 신청 도서가 구글 스프레드시트에 성공적으로 취합·저장되었습니다!`
        );
        onShowToast('success', '구글 시트 취합 완료', '전체 신청 도서 데이터가 정상 저장되었습니다.');
      } else {
        throw new Error(data.error || 'GAS 응답 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitStatus('error');
      setStatusMessage(
        err.message ||
          '구글 시트 전송 중 오류가 발생했습니다. URL 및 스크립트 권한 설정을 확인하거나 CSV 다운로드를 이용해 주세요.'
      );
      onShowToast('error', '취합 전송 실패', '구글 시트로 데이터를 전송하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">도서 구매 신청 취합 & 구글 시트 전송</h3>
              <p className="text-xs text-slate-400">
                1학년~6학년 및 교직원 탭의 모든 신청 도서를 통합 검토 및 전송합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium">총 신청 종수</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{totalUnique}종</div>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-medium">총 신청 권수</span>
              <div className="text-lg font-bold text-emerald-800 mt-0.5">{totalVolume}권</div>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
              <span className="text-[11px] text-indigo-700 font-medium">총 소요 예상액</span>
              <div className="text-lg font-bold text-indigo-900 mt-0.5">
                ₩{totalCost.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] text-amber-800 font-medium">중복 보유 ⚠️</span>
              <div className="text-lg font-bold text-amber-900 mt-0.5">{duplicateCount}건</div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>탭별(학년/교직원) 취합 요약</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">구분</th>
                    <th className="py-2.5 px-4 text-center">신청 종수</th>
                    <th className="py-2.5 px-4 text-center">총 권수</th>
                    <th className="py-2.5 px-4 text-right">소계 금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdown.map((row) => (
                    <tr key={row.tab} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-800">{row.tab}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600">{row.count}종</td>
                      <td className="py-2.5 px-4 text-center text-slate-700 font-medium">
                        {row.volume}권
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                        ₩{row.cost.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Feedback Alert */}
          {submitStatus === 'success' && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="font-bold text-emerald-950 text-sm">구글 시트 취합 완료!</strong>
                <p className="mt-1 leading-relaxed">{statusMessage}</p>
              </div>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="font-bold text-rose-950 text-sm">취합 전송 중 오류 발생</strong>
                <p className="mt-1 leading-relaxed">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>엑셀/CSV 파일 다운로드</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              닫기
            </button>
            <button
              onClick={handleSubmitToGAS}
              disabled={isSubmitting || totalUnique === 0}
              id="confirm-gas-send-btn"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-500/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>구글 시트 전송 중...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>구글 시트로 취합 데이터 전송</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
