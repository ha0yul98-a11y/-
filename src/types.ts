export type CategoryTab = '1학년' | '2학년' | '3학년' | '4학년' | '5학년' | '6학년' | '교직원';

export const CATEGORY_TABS: CategoryTab[] = [
  '1학년',
  '2학년',
  '3학년',
  '4학년',
  '5학년',
  '6학년',
  '교직원',
];

export interface RequestedBook {
  id: string;
  category: CategoryTab;
  title: string;
  author: string;
  publisher: string;
  price: number;
  quantity: number;
  notes?: string;
  coverUrl?: string;
  isbn?: string;
  sourceUrl?: string;
  createdAt: string;
  isDuplicate?: boolean;
  duplicateInfo?: string;
}

export interface ExistingBook {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  registerNo?: string;
  isbn?: string;
  location?: string;
  createdAt?: string;
}

export interface ParsedBookData {
  title: string;
  author: string;
  publisher: string;
  price: number;
  coverUrl?: string;
  isbn?: string;
  description?: string;
  sourceUrl?: string;
}

export interface ParseBookResponse {
  success: boolean;
  data?: ParsedBookData;
  error?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
