import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface Column<T> {
  header: string;
  key: keyof T | string;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyIcon?: React.ElementType;
  emptyText?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;
}

export function DataTable<T>({ 
  title, 
  columns, 
  data, 
  isLoading, 
  emptyIcon: Icon, 
  emptyText,
  onSearch,
  searchValue
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden transition-all">
      
      {/* CONDITIONAL HEADER: 
          This section ONLY renders if you provide a title OR a search function.
          Since you aren't passing them in ManageManagers.tsx, this will disappear.
      */}
      {(title || onSearch) && (
        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
          {title && (
            <h2 className="text-xl font-black text-[#1E3A4C] tracking-tight">
              {title}
            </h2>
          )}
          
          {onSearch && (
            <div className="relative group">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E3A4C] transition-colors" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 w-64 transition-all"
              />
            </div>
          )}
        </div>
      )}

      {/* TABLE BODY */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/30 text-slate-400 text-[10px] uppercase font-black tracking-[0.15em] border-b border-slate-50">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-8 py-4 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.length > 0 ? (
              data.map((item, rowIdx) => (
                <tr key={rowIdx} className="group hover:bg-slate-50/50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`px-8 py-4 text-sm font-medium text-slate-600 ${col.className || ""}`}>
                      {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              !isLoading && (
                <tr>
                  <td colSpan={columns.length} className="px-8 py-24 text-center">
                    {Icon ? (
                      <Icon className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MagnifyingGlassIcon className="w-6 h-6 text-slate-200" />
                      </div>
                    )}
                    <p className="text-slate-400 font-bold text-sm">{emptyText || "No matching records found"}</p>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}