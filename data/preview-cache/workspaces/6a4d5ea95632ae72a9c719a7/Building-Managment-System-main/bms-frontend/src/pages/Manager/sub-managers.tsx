import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as managerApi from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, subManagerFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function ManageTeam() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingSubManager, setEditingSubManager] = useState<any>(null);
  const [selectedSubManager, setSelectedSubManager] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [subManagerToDelete, setSubManagerToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    // Get selected building ID from localStorage
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    setSelectedBuildingId(savedBuildingId);
    loadTeam(savedBuildingId);
  }, []);

  useEffect(() => {
    // Listen for building changes
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId || localStorage.getItem("selectedBuildingId");
      setSelectedBuildingId(buildingId);
      loadTeam(buildingId);
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const loadTeam = async (buildingId?: string | null) => {
    try {
      setLoading(true);
      const data = await managerApi.getSubManagers(buildingId || undefined);
      setTeam(data || []);
    } catch (err: any) {
      toast.error("Could not load your team members");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (member: any) => {
    setSelectedSubManager(member);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (member: any) => {
    setEditingSubManager(member);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (member: any) => {
    setSubManagerToDelete(member);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!subManagerToDelete) return;
    const subManagerId = subManagerToDelete._id || subManagerToDelete.id;
    if (!subManagerId) {
      toast.error("Sub-manager ID is missing. Cannot delete.");
      return;
    }
    try {
      await managerApi.deleteSubManager(subManagerId);
      toast.success("Member removed from team");
      loadTeam(selectedBuildingId);
      setDeleteConfirmOpen(false);
      setSubManagerToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete member");
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      // Get selected building ID from localStorage
      const currentBuildingId = localStorage.getItem("selectedBuildingId");
      
      if (editingSubManager) {
        const subManagerId = editingSubManager._id || editingSubManager.id;
        if (!subManagerId) {
          toast.error("Sub-manager ID is missing. Cannot update.");
          return;
        }
        await managerApi.updateSubManager(subManagerId, formData);
        toast.success("Team member updated");
      } else {
        // Include buildingId in form data when creating sub-manager
        await managerApi.createSubManager({ ...formData, buildingId: currentBuildingId });
        toast.success("Sub-manager invited successfully");
      }
      setView("LIST");
      setEditingSubManager(null);
      loadTeam(selectedBuildingId || currentBuildingId);
    } catch (err: any) {
      console.error("Submission Error:", err.response?.data);
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const subManagerColumns = [
    {
      header: "NAME & CONTACT",
      render: (member: any) => (
        <div>
          <div className="font-bold text-gray-800 dark:text-gray-200">{member.name}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 lowercase">{member.email}</div>
        </div>
      )
    },
    {
      header: "ROLE",
      render: (member: any) => (
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full w-fit">
          <ShieldCheckIcon className="h-3 w-3" /> Sub-Manager
        </span>
      )
    }
  ];

  const subManagerDetailFields = [
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Role", key: "role" },
    { label: "ID", key: "_id", transform: (val: string) => val?.slice(-6).toUpperCase() }
  ];

  if (view !== "LIST") {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
            <div className="max-w-4xl mx-auto w-full">
              <ReusableForm
                config={subManagerFormConfig}
                initialData={editingSubManager}
                onSubmit={handleSubmit}
                onCancel={() => { setView("LIST"); setEditingSubManager(null); }}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">My Team</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your assigned sub-managers and assistants</p>
          </div>
          <button
            onClick={() => { setEditingSubManager(null); setView("CREATE"); }}
            className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-opacity-90 dark:hover:bg-blue-600 shadow-lg transition-all active:scale-95"
          >
            Add Team Member
          </button>
        </div>

        <ReusableTable
          data={team}
          columns={subManagerColumns}
          isLoading={loading}
          onRowClick={handleRowClick}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          emptyMessage="No sub-managers found. Add your first team member to get started."
        />

        <DetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Sub-Manager Details"
          data={selectedSubManager}
          fields={subManagerDetailFields}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />

        <DeleteConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => { setDeleteConfirmOpen(false); setSubManagerToDelete(null); }}
          onConfirm={handleDeleteConfirm}
          title="Delete Sub-Manager"
          message="Are you sure you want to delete"
          itemName={subManagerToDelete?.name || "this sub-manager"}
        />
        </div>
      </main>
    </div>
  );
}
