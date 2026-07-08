import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableForm, managerFormConfig } from "../../components/ReusableForm";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  EnvelopeIcon, PhoneIcon, 
  UserPlusIcon, ArrowDownTrayIcon,
  ChevronRightIcon, CurrencyDollarIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

export function ManageManagers() {
  const [view, setView] = useState<"LIST" | "CREATE" | "EDIT">("LIST");
  const [managers, setManagers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState<any>(null);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAllManagers();
      setManagers(data || []);
    } catch (err) {
      toast.error("Connectivity Issue: Failed to load directory");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingManager) {
        const managerId = editingManager._id || editingManager.id;
        if (!managerId) {
          toast.error("Manager ID is missing. Cannot update.");
          setIsSubmitting(false);
          return;
        }
        await api.updateManager(managerId, formData);
        toast.success("Manager updated successfully");
      } else {
        await api.createManager(formData);
        toast.success("Manager successfully registered");
      }
      setView("LIST");
      setEditingManager(null);
      fetchManagers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (manager: any) => {
    setSelectedManager(manager);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (manager: any) => {
    setEditingManager(manager);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (manager: any) => {
    setManagerToDelete(manager);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!managerToDelete) return;
    try {
      const managerId = managerToDelete._id || managerToDelete.id;
      if (!managerId) {
        toast.error("Manager ID is missing. Cannot delete.");
        return;
      }
      await api.deleteManager(managerId);
      toast.success("Manager deleted successfully");
      fetchManagers();
      setDeleteConfirmOpen(false);
      setManagerToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete manager");
    }
  };

  const handleEditClick = (manager: any) => {
    setEditingManager(manager);
    setView("EDIT");
  };

  const filteredManagers = (managers || []).filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            
            {/* COMPACT HEADER */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">Manager Hub</h1>
                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                  Sky Property Administration
                </p>
              </div>

              {view === "LIST" && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toast.success("Exporting data...")}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-xl text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 stroke-[2.5]" /> Export
                  </button>
                  <button 
                    onClick={() => setView("CREATE")}
                    style={{ backgroundColor: SYSTEM_BLUE }}
                    className="text-white px-5 py-2 rounded-xl font-bold text-[13px] flex items-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95"
                  >
                    <UserPlusIcon className="h-4 w-4 stroke-[2.5]" /> Register Manager
                  </button>
                </div>
              )}
            </div>

            {view === "LIST" ? (
              <div className="flex-1 animate-in fade-in zoom-in-95 duration-500">
                <ReusableTable
                  themeColor="blue"
                  data={filteredManagers}
                  isLoading={isLoading}
                  onSearch={setSearchQuery}
                  onRowClick={handleRowClick}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  tabs={[
                    { id: "all", label: "All Managers", count: managers.length },
                    { id: "active", label: "Active", count: managers.length }
                  ]}
                  activeTab="all"
                  columns={[
                    {
                      header: "MANAGER PROFILE",
                      render: (m) => (
                        <div className="flex items-center gap-3 py-1">
                          {m.buildingLogo ? (
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                              <img src={m.buildingLogo} alt={m.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-gray-700 text-[#1E3A4C] dark:text-white flex items-center justify-center font-black text-xs border border-slate-100 dark:border-gray-600 transition-all group-hover:bg-[#1E3A4C] dark:group-hover:bg-gray-600 group-hover:text-white">
                              {m.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800 dark:text-gray-200 text-sm leading-none">{m.name}</p>
                            <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold mt-1 uppercase">ID: {m._id?.slice(-5).toUpperCase()}</p>
                          </div>
                        </div>
                      )
                    },
                    {
                      header: "CONTACT CHANNELS",
                      render: (m) => (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                            <EnvelopeIcon className="w-3.5 h-3.5 text-slate-300 dark:text-gray-500" /> {m.email}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-gray-500 font-medium">
                            <PhoneIcon className="w-3.5 h-3.5 text-slate-300 dark:text-gray-500" /> {m.phone || "---"}
                          </div>
                        </div>
                      )
                    },
                    {
                      header: "ASSIGNED SECTIONS",
                      render: (m) => (
                        <span className="text-[11px] text-slate-600 dark:text-gray-300 font-medium">
                          {m.sections?.length > 0 ? `${m.sections.length} sections` : "Full Access"}
                        </span>
                      )
                    },
                    {
                      header: "PAYMENT",
                      render: (m) => (
                        <div className="flex items-center gap-2 text-[11px]">
                          <CurrencyDollarIcon className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500" />
                          <span className="text-slate-600 dark:text-gray-300 font-medium">
                            {m.paymentDetails?.amount ? `$${m.paymentDetails.amount}/${m.paymentDetails.frequency || "MONTHLY"}` : "—"}
                          </span>
                        </div>
                      )
                    },
                    {
                      header: "STATUS",
                      render: () => (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest">
                          Active
                        </span>
                      )
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="w-full max-w-4xl mx-auto">
                <ReusableForm
                  config={managerFormConfig}
                  initialData={editingManager}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setView("LIST");
                    setEditingManager(null);
                  }}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}

            <DeleteConfirmModal
              isOpen={deleteConfirmOpen}
              onClose={() => {
                setDeleteConfirmOpen(false);
                setManagerToDelete(null);
              }}
              onConfirm={handleDeleteConfirm}
              title="Delete Manager"
              message="Are you sure you want to delete this manager"
              itemName={managerToDelete?.name}
            />

            <DetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              title="Manager Details"
              data={selectedManager}
              onEdit={handleEdit}
              onDelete={(manager) => handleDeleteClick(manager)}
              fields={[
                { key: "name", label: "Full Name" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "adminPerson.name", label: "Admin Person Name" },
                { key: "adminPerson.email", label: "Admin Person Email" },
                { key: "adminPerson.phone", label: "Admin Person Phone" },
                { key: "paymentDetails.amount", label: "Payment Amount", render: (v) => v ? `$${v}` : "—" },
                { key: "paymentDetails.frequency", label: "Payment Frequency" },
                { key: "sections", label: "Sections", render: (v) => Array.isArray(v) ? v.join(", ") : "—" },
                { key: "createdAt", label: "Created At", render: (v) => v ? new Date(v).toLocaleDateString() : "—" }
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}