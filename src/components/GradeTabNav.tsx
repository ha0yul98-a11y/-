import React from 'react';
import { CategoryTab, CATEGORY_TABS, RequestedBook } from '../types';

interface Props {
  activeTab: CategoryTab;
  requestedBooks: RequestedBook[];
  onSelectTab: (tab: CategoryTab) => void;
  layout?: 'sidebar' | 'horizontal';
}

export const GradeTabNav: React.FC<Props> = ({
  activeTab,
  requestedBooks,
  onSelectTab,
  layout = 'sidebar',
}) => {
  // Helper to count books per category
  const getTabStats = (tab: CategoryTab) => {
    const tabBooks = requestedBooks.filter((b) => b.category === tab);
    const count = tabBooks.length;
    return count;
  };

  if (layout === 'sidebar') {
    return (
      <nav className="space-y-1">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-2 tracking-wider">
          신청 학년 선택
        </div>
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = getTabStats(tab);

          return (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              id={`tab-${tab}`}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-blue-200 text-blue-800'
                    : count > 0
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Horizontal layout for smaller screens or top tab mode
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2 mb-4 shadow-xs overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = getTabStats(tab);

          return (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              id={`tab-${tab}`}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

