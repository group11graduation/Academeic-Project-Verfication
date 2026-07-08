import React from "react";
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  FunnelIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface ReusableTableProps<T> {
  title?: string; // Made optional
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  data: T[];
  columns: Column<T>[];
  onAdd?: () => void;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
  onExport?: () => void;
  onRowClick?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  addButtonLabel?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  themeColor?: "indigo" | "green" | "blue" | "purple";
}

export function ReusableTable<T extends { _id?: string; id?: string | number }>({
  title,
  tabs,
  activeTab,
  onTabChange,
  data,
  columns,
  onAdd,
  onSearch,
  onFilter,
  onExport,
  onRowClick,
  onEdit,
  onDelete,
  addButtonLabel = "Add New",
  isLoading = false,
  emptyMessage = "No records found",
  themeColor = "indigo"
}: ReusableTableProps<T>) {

  const themeClasses = {
    indigo: {
      activeTab: "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30",
      button: "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-indigo-200",
      checkbox: "text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
    },
    green: {
      activeTab: "text-green-600 dark:text-green-400 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/30",
      button: "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 shadow-green-200",
      checkbox: "text-green-600 dark:text-green-400 focus:ring-green-500 dark:focus:ring-green-400"
    },
    blue: {
      activeTab: "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30",
      button: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-blue-200",
      checkbox: "text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
    },
    purple: {
      activeTab: "text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/30",
      button: "bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 shadow-purple-200",
      checkbox: "text-purple-600 dark:text-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400"
    }
  };

  const theme = themeClasses[themeColor];

  // Logic to determine if the entire header section should be hidden
  const hasHeader = title || onAdd || onExport || onFilter;
  const hasSubHeader = (tabs && tabs.length > 0) || onSearch;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      
      {/* HEADER SECTION - Only shows if primary actions or title exist */}
      {hasHeader && (
        <div className="p-6 border-b border-slate-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {title && <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{title}</h2>}
            
            <div className="flex items-center gap-3">
              {onExport && (
                <button onClick={onExport} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors">
                  <ArrowDownTrayIcon className="w-4 h-4" /> Export
                </button>
              )}
              {onFilter && (
                <button onClick={onFilter} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                  <FunnelIcon className="w-4 h-4" /> Filter
                </button>
              )}
              {onAdd && (
                <button onClick={onAdd} className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95 ${theme.button}`}>
                  <PlusIcon className="w-5 h-5 stroke-[3]" /> {addButtonLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-HEADER (Tabs & Search) - Only shows if tabs or onSearch exist */}
      {hasSubHeader && (
        <div className={`px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 ${!hasHeader ? '' : 'border-t border-slate-50 dark:border-gray-700'}`}>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {tabs?.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap border ${activeTab === tab.id ? theme.activeTab : "text-slate-500 dark:text-gray-400 border-transparent hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-200"}`}
              >
                {tab.label}
                {tab.count !== undefined && <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* INTERNAL SEARCH BAR - Only renders if onSearch prop is passed */}
          {onSearch && (
            <div className="relative w-full md:w-72">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-gray-500" />
              <input 
                type="text"
                placeholder="Search..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500"
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-700/50">
              <th className="p-4 w-12 text-center">
                <input type="checkbox" className={`rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 ${theme.checkbox}`} />
              </th>
              {columns.map((col, idx) => (
                <th key={idx} className={`p-4 text-[11px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="p-4 text-[11px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider text-right">
                  ACTIONS
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-4"><div className="w-4 h-4 bg-slate-200 dark:bg-gray-700 rounded mx-auto"></div></td>
                  {columns.map((_, j) => (
                    <td key={j} className="p-4"><div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                  ))}
                </tr>
              ))
            ) : data.length > 0 ? (
              data.map((item, rowIdx) => (
                <tr 
                  key={item._id || item.id || rowIdx} 
                  className={`group hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors duration-200 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className={`rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 ${theme.checkbox}`} />
                  </td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="p-4 text-sm text-slate-600 dark:text-gray-300 font-medium">
                      {col.render ? col.render(item) : (item as any)[col.accessorKey!]}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {onEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                            className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-[#1E3A4C] dark:text-blue-400"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1 + ((onEdit || onDelete) ? 1 : 0)} className="p-12 text-center text-slate-400 dark:text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <MagnifyingGlassIcon className="w-8 h-8 text-slate-200 dark:text-gray-700" />
                    <p className="font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}