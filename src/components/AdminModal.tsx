import React, { useState } from 'react';
import { ExistingBook } from '../types';
import { parseCSVToBooks } from '../utils/csvParser';
import {
  ShieldCheck,
  Lock,
  X,
  Upload,
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  BookOpen,
  Code,
  Link,
  RefreshCw,
  Info,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  isAdmin: boolean;
  gasUrl: string;
  existingBooks: ExistingBook[];
  onLogin: (password: string) => boolean;
  onLogout: () => void;
  onClose: () => void;
  onUpdateExistingBooks: (books: ExistingBook[]) => void;
  onUpdateGasUrl: (url: string) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const AdminModal: React.FC<Props> = ({
  isOpen,
  isAdmin,
  gasUrl,
  existingBooks,
  onLogin,
  onLogout,
  onClose,
  onUpdateExistingBooks,
  onUpdateGasUrl,
  onShowToast,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<'books' | 'gas'>('books');

  // Existing Books Management state
  const [searchQuery, setSearchQuery] = useState('');
  const [rawCsvInput, setRawCsvInput] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);

  // New book manual entry
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newPublisher, setNewPublisher] = useState('');
  const [newRegNo, setNewRegNo] = useState('');

  // GAS Setup state
  const [tempGasUrl, setTempGasUrl] = useState(gasUrl);
  const [isTestingGas, setIsTestingGas] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(passwordInput);
    if (success) {
      onShowToast('success', '관리자 인증 성공', '관리자 모드에 진입했습니다.');
      setPasswordInput('');
    } else {
      onShowToast('error', '비밀번호 오류', '비밀번호가 올바르지 않습니다. (기본: admin)');
    }
  };

  // CSV File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedBooks = parseCSVToBooks(text);
        if (parsedBooks.length === 0) {
          onShowToast('warning', '데이터 없음', 'CSV 파일에서 도서 정보를 찾지 못했습니다.');
          return;
        }

        const merged = [...parsedBooks, ...existingBooks];
        onUpdateExistingBooks(merged);
        onShowToast(
          'success',
          '보유 도서 업로드 완료',
          `총 ${parsedBooks.length}권의 기존 보유 도서가 성공적으로 등록되었습니다.`
        );
      } catch (err: any) {
        onShowToast('error', '파일 파싱 오류', 'CSV 파일 형식을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // CSV Text Paste handler
  const handlePasteSubmit = () => {
    if (!rawCsvInput.trim()) return;
    try {
      const parsedBooks = parseCSVToBooks(rawCsvInput);
      if (parsedBooks.length === 0) {
        onShowToast('warning', '데이터 없음', '입력된 텍스트에서 도서를 파싱하지 못했습니다.');
        return;
      }

      onUpdateExistingBooks([...parsedBooks, ...existingBooks]);
      onShowToast(
        'success',
        '보유 도서 등록 완료',
        `${parsedBooks.length}권의 보유 도서 목록이 추가되었습니다.`
      );
      setRawCsvInput('');
      setShowPasteModal(false);
    } catch {
      onShowToast('error', '파싱 오류', '올바른 CSV 텍스트 형식으로 입력해 주세요.');
    }
  };

  // Add single existing book manually
  const handleAddSingleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newBook: ExistingBook = {
      id: `man-${Date.now()}`,
      title: newTitle.trim(),
      author: newAuthor.trim() || '미상',
      publisher: newPublisher.trim() || '',
      registerNo: newRegNo.trim() || `LIB-${Date.now().toString().slice(-4)}`,
    };

    onUpdateExistingBooks([newBook, ...existingBooks]);
    onShowToast('success', '도서 등록 완료', `'${newTitle}' 도서가 보유 목록에 추가되었습니다.`);
    setNewTitle('');
    setNewAuthor('');
    setNewPublisher('');
    setNewRegNo('');
  };

  // Delete single existing book
  const handleDeleteBook = (id: string) => {
    onUpdateExistingBooks(existingBooks.filter((b) => b.id !== id));
    onShowToast('info', '도서 삭제', '보유 도서 목록에서 해당 항목이 삭제되었습니다.');
  };

  // Save GAS URL
  const handleSaveGasUrl = () => {
    onUpdateGasUrl(tempGasUrl.trim());
    onShowToast('success', 'GAS URL 저장 완료', 'Google Apps Script 배포 URL이 설정되었습니다.');
  };

  // Test connection to GAS Web App
  const handleTestGasConnection = async () => {
    if (!tempGasUrl.trim()) {
      onShowToast('warning', 'URL 입력 필요', '테스트할 Google Apps Script URL을 입력해 주세요.');
      return;
    }

    setIsTestingGas(true);
    try {
      const res = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gasUrl: tempGasUrl.trim(),
          payload: { action: 'ping', test: true },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast('success', 'GAS 통신 성공', '구글 앱스 스크립트 연결이 정상 확인되었습니다.');
      } else {
        onShowToast('warning', 'GAS 응답 확인', 'GAS URL로 요청을 전송했으나 성공 응답(CORS/HTML)을 점검해 주세요.');
      }
    } catch (err: any) {
      onShowToast('error', '연결 실패', err.message || 'GAS 서버 통신 중 오류가 발생했습니다.');
    } finally {
      setIsTestingGas(false);
    }
  };

  const gasScriptCode = `/**
 * 초등학교 도서 구매 관리 시스템 Google Apps Script (GAS) Code.gs
 * 구글 스프레드시트에 도서 신청 내역 및 기존 보유 도서 목록 저장
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. '신청도서' 시트 처리 (도서 구매 신청 취합)
    if (data.items && Array.isArray(data.items)) {
      var sheet = ss.getSheetByName('신청도서') || ss.insertSheet('신청도서');
      
      // 헤더 작성 (시트가 처음 생성된 경우)
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          '접수일시',
          '신청학년/구분',
          '도서명',
          '저자',
          '출판사',
          '정가(원)',
          '신청수량',
          '합계금액(원)',
          '신청사유/비고',
          '보유도서중복여부',
          '출처링크'
        ]);
        sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#e2e8f0');
      }
      
      var timestamp = data.timestamp || new Date().toLocaleString('ko-KR');
      
      data.items.forEach(function(item) {
        var total = (item.price || 0) * (item.quantity || 1);
        sheet.appendRow([
          timestamp,
          item.category || '',
          item.title || '',
          item.author || '',
          item.publisher || '',
          item.price || 0,
          item.quantity || 1,
          total,
          item.notes || '',
          item.isDuplicate ? '⚠️ 중복보유' : '정상신청',
          item.sourceUrl || ''
        ]);
      });
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: '성공적으로 ' + data.items.length + '건의 도서 신청이 저장되었습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. '보유도서' 시트 처리 (기존 보유 도서 목록 저장)
    if (data.existingBooks && Array.isArray(data.existingBooks)) {
      var existSheet = ss.getSheetByName('보유도서') || ss.insertSheet('보유도서');
      existSheet.clear(); // 기존 내용 갱신
      existSheet.appendRow(['등록번호', '도서명', '저자', '출판사', '서가위치']);
      existSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#fef3c7');
      
      data.existingBooks.forEach(function(b) {
        existSheet.appendRow([
          b.registerNo || '',
          b.title || '',
          b.author || '',
          b.publisher || '',
          b.location || ''
        ]);
      });
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: '기존 보유 도서 ' + data.existingBooks.length + '건이 보유도서 시트에 업데이트되었습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '요청 수신 완료 (Ping test)'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("초등학교 도서 구매 관리 시스템 Web App이 정상 동작 중입니다.");
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopiedScript(true);
    onShowToast('info', '코드 복사됨', 'Google Apps Script 스크립트 코드가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const filteredExisting = existingBooks.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.registerNo && b.registerNo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">관리자 모드 (Admin Portal)</h3>
              <p className="text-xs text-slate-400">
                기존 도서관 보유 도서 등록, 중복 체크 기준 데이터 및 구글 시트(GAS) 연동 설정
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
        {!isAdmin ? (
          /* Password Authentication Gate */
          <div className="p-8 text-center max-w-md mx-auto my-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-800">관리자 인증이 필요합니다</h4>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              기존 보유 도서 DB를 관리하거나 구글 시트 연동을 수정하려면 비밀번호를 입력해 주세요. (초기 비밀번호: <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-800">admin</code>)
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력 (admin)"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                id="admin-login-btn"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition shadow-md"
              >
                인증 완료 및 진입
              </button>
            </form>
          </div>
        ) : (
          /* Admin Main Portal */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Admin Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50">
              <button
                onClick={() => setActiveAdminTab('books')}
                className={`py-3.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                  activeAdminTab === 'books'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>기존 보유 도서 등록 & 관리 ({existingBooks.length}권)</span>
              </button>
              <button
                onClick={() => setActiveAdminTab('gas')}
                className={`py-3.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                  activeAdminTab === 'gas'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="w-4 h-4" />
                <span>구글 시트(GAS) 설정 및 코드 가이드</span>
              </button>

              <button
                onClick={onLogout}
                className="ml-auto my-auto text-xs text-slate-500 hover:text-rose-600 font-medium underline px-2 py-1"
              >
                로그아웃
              </button>
            </div>

            {/* TAB 1: Existing Books Management */}
            {activeAdminTab === 'books' && (
              <div className="p-6 space-y-6">
                {/* Upload & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      기존 도서관 보유 도서 목록 (중복 대조용 데이터)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      CSV 파일 업로드 또는 직접 텍스트 입력을 통해 교내 도서관 보유 도서를 등록할 수 있습니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* CSV Upload */}
                    <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>CSV 파일 업로드</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Paste CSV */}
                    <button
                      onClick={() => setShowPasteModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>텍스트 붙여넣기</span>
                    </button>
                  </div>
                </div>

                {/* Paste Text Modal / Box */}
                {showPasteModal && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="text-xs font-bold text-indigo-900">
                        CSV 텍스트 직접 입력 (도서명, 저자, 출판사, 등록번호)
                      </h5>
                      <button
                        onClick={() => setShowPasteModal(false)}
                        className="text-indigo-500 hover:text-indigo-800 text-xs"
                      >
                        닫기
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={rawCsvInput}
                      onChange={(e) => setRawCsvInput(e.target.value)}
                      placeholder={`예시:\n도서명,저자,출판사,등록번호\n마당을 나온 암탉,황선미,사계절,LIB-2022-0012\n강아지 똥,권정생,길벗어린이,LIB-2021-0089`}
                      className="w-full p-3 text-xs bg-white border border-indigo-300 rounded-lg font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handlePasteSubmit}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                      >
                        파싱하여 목록 추가
                      </button>
                    </div>
                  </div>
                )}

                {/* Single Book Manual Add */}
                <form
                  onSubmit={handleAddSingleBook}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end bg-white p-3 border border-slate-200 rounded-xl"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      도서명
                    </label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="예: 백희나 구름빵"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      저자
                    </label>
                    <input
                      type="text"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      placeholder="저자명"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      등록번호
                    </label>
                    <input
                      type="text"
                      value={newRegNo}
                      onChange={(e) => setNewRegNo(e.target.value)}
                      placeholder="LIB-2026-001"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-1.5 px-3 bg-slate-900 text-white rounded-md text-xs font-bold hover:bg-slate-800 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>추가</span>
                  </button>
                </form>

                {/* Table Filter & Existing Books Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700">
                      등록된 보유 도서 목록 ({filteredExisting.length} / {existingBooks.length}권)
                    </span>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="제목, 저자, 등록번호 검색..."
                        className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">등록번호</th>
                          <th className="py-2.5 px-3">도서명</th>
                          <th className="py-2.5 px-3">저자</th>
                          <th className="py-2.5 px-3">출판사</th>
                          <th className="py-2.5 px-3 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredExisting.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400">
                              검색 결과가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredExisting.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-[11px] text-indigo-600">
                                {b.registerNo || '-'}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">{b.title}</td>
                              <td className="py-2 px-3 text-slate-600">{b.author}</td>
                              <td className="py-2 px-3 text-slate-500">{b.publisher || '-'}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteBook(b.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GAS Setup & Code Guide */}
            {activeAdminTab === 'gas' && (
              <div className="p-6 space-y-6">
                {/* GAS URL Input Box */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2">
                    <Link className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-800">
                      Google Apps Script (GAS) Web App URL 설정
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    구글 스프레드시트에 도서 신청 내역을 자동 취합하려면 배포된 GAS 웹 앱 URL을 입력해 주세요. (환경변수 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">NEXT_PUBLIC_GAS_URL</code>도 지원)
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempGasUrl}
                      onChange={(e) => setTempGasUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={handleSaveGasUrl}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleTestGasConnection}
                      disabled={isTestingGas}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      {isTestingGas ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>연결 테스트</span>
                    </button>
                  </div>
                </div>

                {/* Copyable Script Box */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-indigo-600" />
                        <span>Google Apps Script 코드 (Code.gs)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        구글 스프레드시트 {`>`} 확장 프로그램 {`>`} Apps Script 편집기에 아래 코드를 복사하여 붙여넣고 [웹 앱으로 배포]하세요.
                      </p>
                    </div>

                    <button
                      onClick={copyScriptToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>복사 완료!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>전체 코드 복사</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto max-h-60 leading-relaxed">
                    <pre>{gasScriptCode}</pre>
                  </div>

                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
                    <strong className="font-bold flex items-center gap-1">
                      <Info className="w-4 h-4 text-amber-600" />
                      구글 앱스 스크립트 배포 시 주의사항:
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px]">
                      <li>[배포] {`>`} [새 배포] {`>`} 유형: <strong>웹 앱 (Web App)</strong> 선택</li>
                      <li>다음 사용자 권한으로 실행: <strong>나 (Me)</strong></li>
                      <li>액세스 권한이 있는 사용자: <strong>모든 사용자 (Anyone)</strong> 로 설정 필수</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
