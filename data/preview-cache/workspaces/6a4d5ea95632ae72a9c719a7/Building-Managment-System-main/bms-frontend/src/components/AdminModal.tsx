export function AdminModal({ title, isOpen, onClose, children }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#1E3A4C] p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}