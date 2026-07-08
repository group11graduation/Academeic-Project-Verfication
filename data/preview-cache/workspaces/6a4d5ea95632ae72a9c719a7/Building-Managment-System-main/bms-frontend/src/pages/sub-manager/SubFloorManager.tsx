import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, floorFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { PlusIcon } from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function SubManageFloors() {
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingFloor, setEditingFloor] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getFloors();
      setFloors(data || []);
    } catch (err: any) {
      toast.error("Error loading floors");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (floor: any) => {
    setSelectedFloor(floor);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (floor: any) => {
    setEditingFloor(floor);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (floor: any) => {
    setFloorToDelete(floor);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!floorToDelete) return;
    const floorId = floorToDelete._id || floorToDelete.id;
    if (!floorId) {
      toast.error("Floor ID is missing. Cannot delete.");
      return;
    }
    try {
      const res = await api.deleteFloor(floorId);
      if (res?.isPending) {
        toast.success("Delete request sent to manager for approval");
      } else {
        toast.success("Floor deleted successfully");
      }
      loadData();
      setDeleteConfirmOpen(false);
      setFloorToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete floor");
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingFloor) {
        const floorId = editingFloor._id || editingFloor.id;
        if (!floorId) {
          toast.error("Floor ID is missing. Cannot update.");
          return;
        }
        const res = await api.updateFloor(floorId, formData);
        if (res?.isPending) {
          toast.success("Update request sent to manager for approval");
        } else {
          toast.success("Floor updated successfully");
        }
      } else {
        await api.addFloor(formData);
        toast.success("Floor created successfully");
      }
      setView("LIST");
      setEditingFloor(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const floorColumns = [
    {
      header: "FLOOR",
      render: (floor: any) => (
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#1E3A4C] dark:bg-blue-700 text-white rounded-xl font-black text-lg">
            {floor.floorNumber}
          </div>
          <span className="font-bold text-[#1E3A4C] dark:text-white">Level {floor.floorNumber}</span>
        </div>
      )
    },
    {
      header: "BUILDING",
      render: (floor: any) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {floor.building?.name || "N/A"}
        </span>
      )
    }
  ];

  const floorDetailFields = [
    { label: "Floor Number", key: "floorNumber" },
    { label: "Building", key: "building.name" },
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
                config={floorFormConfig}
                initialData={editingFloor}
                onSubmit={handleSubmit}
                onCancel={() => { setView("LIST"); setEditingFloor(null); }}
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
              <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">Floor Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage building levels. Updates and deletions require manager approval.</p>
            </div>
            <button
              onClick={() => { setEditingFloor(null); setView("CREATE"); }}
              className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
            >
              <PlusIcon className="h-5 w-5" /> Add Floor
            </button>
          </div>

          <ReusableTable
            data={floors}
            columns={floorColumns}
            isLoading={loading}
            onRowClick={handleRowClick}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            emptyMessage="No floors registered for this building yet."
          />

          <DetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            title="Floor Details"
            data={selectedFloor}
            fields={floorDetailFields}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />

          <DeleteConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => { setDeleteConfirmOpen(false); setFloorToDelete(null); }}
            onConfirm={handleDeleteConfirm}
            title="Request Floor Deletion"
            message="This will send a deletion request to the manager for approval. Are you sure you want to delete"
            itemName={floorToDelete?.floorNumber ? `Floor ${floorToDelete.floorNumber}` : "this floor"}
          />
        </div>
      </main>
    </div>
  );
}
