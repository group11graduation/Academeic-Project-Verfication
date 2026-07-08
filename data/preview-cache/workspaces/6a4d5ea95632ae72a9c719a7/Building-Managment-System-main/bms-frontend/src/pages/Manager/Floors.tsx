import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import * as reportsApi from "../../api/reports.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, floorFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function ManageFloors() {
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingFloor, setEditingFloor] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buildingInfo, setBuildingInfo] = useState<{ floorLimit?: number } | null>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    // Get selected building ID from localStorage
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    setSelectedBuildingId(savedBuildingId);
    loadData(savedBuildingId);
  }, []);

  useEffect(() => {
    // Listen for building changes
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId || localStorage.getItem("selectedBuildingId");
      setSelectedBuildingId(buildingId);
      loadData(buildingId);
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const loadData = async (buildingId?: string | null) => {
    try {
      setLoading(true);
      const [floorsData, reportData] = await Promise.all([
        api.getFloors(buildingId || undefined).catch(() => []),
        buildingId ? reportsApi.getManagerReport(buildingId).catch(() => null) : Promise.resolve(null)
      ]);
      setFloors(floorsData || []);
      if (reportData) {
        setBuildingInfo({ floorLimit: reportData.floorLimit });
      }
    } catch (err: any) {
      toast.error("Failed to sync floor data");
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
      await api.deleteFloor(floorId);
      toast.success("Floor deleted successfully");
      loadData(selectedBuildingId);
      setDeleteConfirmOpen(false);
      setFloorToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete floor");
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      // Get selected building ID from localStorage
      const currentBuildingId = localStorage.getItem("selectedBuildingId");
      
      if (editingFloor) {
        const floorId = editingFloor._id || editingFloor.id;
        if (!floorId) {
          toast.error("Floor ID is missing. Cannot update.");
          return;
        }
        await api.updateFloor(floorId, formData);
        toast.success("Floor updated successfully");
      } else {
        // Include buildingId in form data when creating floor
        await api.addFloor({ ...formData, buildingId: currentBuildingId });
        toast.success("Floor added successfully");
      }
      setView("LIST");
      setEditingFloor(null);
      loadData(selectedBuildingId || currentBuildingId);
    } catch (err: any) {
      // Check if it's a floor limit error
      if (err.response?.data?.isLimitReached) {
        const errorData = err.response.data;
        toast.error(
          `Floor Limit Reached!\n\nYou have reached the maximum of ${errorData.floorLimit} floor${errorData.floorLimit !== 1 ? 's' : ''} for this building.\n\nPlease contact your administrator to increase the floor limit if you need to add more floors.`,
          {
            duration: 6000, // Show for 6 seconds
            style: {
              whiteSpace: 'pre-line', // Allow line breaks
              maxWidth: '500px'
            }
          }
        );
      } else {
      toast.error(err.response?.data?.message || `Failed to ${editingFloor ? 'update' : 'create'} floor`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const floorColumns = [
    {
      header: "FLOOR LEVEL",
      render: (floor: any) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-[#1E3A4C] dark:text-blue-400 font-black">
            {floor.floorNumber}
          </div>
          <span className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-tight">Level {floor.floorNumber}</span>
        </div>
      )
    },
    {
      header: "BUILDING",
      render: (floor: any) => (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          {floor.building?.name || "Assigned Building"}
        </div>
      )
    },
    {
      header: "ID",
      render: (floor: any) => (
        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">#{floor._id?.slice(-6).toUpperCase() || "N/A"}</span>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage levels within your assigned building</p>
            {/* Floor Limit Indicator */}
            {buildingInfo?.floorLimit && buildingInfo.floorLimit > 0 && (
              <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                floors.length >= buildingInfo.floorLimit
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              }`}>
                {floors.length >= buildingInfo.floorLimit ? (
                  <ExclamationTriangleIcon className="h-4 w-4" />
                ) : (
                  <InformationCircleIcon className="h-4 w-4" />
                )}
                <span>
                  {floors.length >= buildingInfo.floorLimit 
                    ? `Floor limit reached: ${floors.length}/${buildingInfo.floorLimit} floors`
                    : `Floor usage: ${floors.length}/${buildingInfo.floorLimit} floors`
                  }
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => { setEditingFloor(null); setView("CREATE"); }}
            disabled={!!(buildingInfo?.floorLimit && buildingInfo.floorLimit > 0 && floors.length >= buildingInfo.floorLimit)}
            className={`px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
              buildingInfo?.floorLimit && buildingInfo.floorLimit > 0 && floors.length >= buildingInfo.floorLimit
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-[#1E3A4C] dark:bg-blue-700 text-white hover:bg-[#2a4d63] dark:hover:bg-blue-600'
            }`}
          >
            Add Floor
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
          title="Delete Floor"
          message="Are you sure you want to delete"
          itemName={floorToDelete?.floorNumber ? `Floor ${floorToDelete.floorNumber}` : "this floor"}
        />
        </div>
      </main>
    </div>
  );
}
