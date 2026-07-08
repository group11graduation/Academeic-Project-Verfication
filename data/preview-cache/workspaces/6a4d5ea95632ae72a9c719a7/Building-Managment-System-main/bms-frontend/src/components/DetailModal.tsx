import React from "react";
import { XMarkIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
  fields: { key: string; label: string; render?: (value: any) => React.ReactNode }[];
  onEdit?: (data: any) => void;
  onDelete?: (data: any) => void;
}

export function DetailModal({ isOpen, onClose, title, data, fields, onEdit, onDelete }: DetailModalProps) {
  if (!isOpen) return null;

  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  const handleEdit = () => {
    if (onEdit && data) {
      onEdit(data);
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete && data) {
      if (window.confirm(`Are you sure you want to delete this ${title.toLowerCase()}? This action cannot be undone.`)) {
        onDelete(data);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {fields.map((field) => {
            const value = getNestedValue(data, field.key);
            return (
              <div key={field.key} className="border-b border-slate-100 pb-4 last:border-0">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {field.label}
                </label>
                <div className="text-sm text-slate-700 font-medium">
                  {field.render ? field.render(value) : (value !== null && value !== undefined ? String(value) : "—")}
                </div>
              </div>
            );
          })}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-sm"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
