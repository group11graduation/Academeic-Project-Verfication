import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableForm, buildingFormConfig } from "../../components/ReusableForm";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  MapPinIcon, 
  UserCircleIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  PlusIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

export function ManageBuildings() {
  const [view, setView] = useState<"LIST" | "CREATE" | "EDIT">("LIST");
  const [buildings, setBuildings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [buildingToDelete, setBuildingToDelete] = useState<any>(null);

  useEffect(() => {
    loadData();
    // Real-time updates every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAllBuildings();
      setBuildings(data || []);
    } catch (err) {
      toast.error("Failed to fetch buildings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingBuilding) {
        const buildingId = editingBuilding._id || editingBuilding.id;
        if (!buildingId) {
          toast.error("Building ID is missing. Cannot update.");
          setIsSubmitting(false);
          return;
        }
        await api.updateBuilding(buildingId, formData);
        toast.success("Building updated successfully");
        // Dispatch event to notify other pages (like Payments) that a building was updated
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('buildingUpdated', { detail: { buildingId } }));
        }, 100);
      } else {
        await api.createBuilding(formData);
        toast.success("Building created successfully");
        // Dispatch event to notify other pages (like Payments) that a building was created
        // Use a small delay to ensure the event is dispatched after state updates
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('buildingCreated', { detail: { building: formData } }));
        }, 100);
      }
      setView("LIST");
      setEditingBuilding(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (building: any) => {
    setSelectedBuilding(building);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (building: any) => {
    // Ensure managerId is set from manager object for form
    const buildingData = { ...building };
    if (buildingData.manager?._id) {
      buildingData.managerId = buildingData.manager._id;
    }
    // Ensure allowedRoomTypes is an array
    if (!Array.isArray(buildingData.allowedRoomTypes)) {
      buildingData.allowedRoomTypes = [];
    }
    setEditingBuilding(buildingData);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleEditClick = (building: any) => {
    handleEdit(building);
  };

  const handleDeleteClick = (building: any) => {
    setBuildingToDelete(building);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!buildingToDelete) return;
    try {
      const buildingId = buildingToDelete._id || buildingToDelete.id;
      if (!buildingId) {
        toast.error("Building ID is missing. Cannot delete.");
        return;
      }
      await api.deleteBuilding(buildingId);
      toast.success("Building deleted successfully");
      // Dispatch event to notify other pages (like Payments) that a building was deleted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('buildingDeleted', { detail: { buildingId } }));
      }, 100);
      loadData();
      setDeleteConfirmOpen(false);
      setBuildingToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete building");
    }
  };

  const filteredBuildings = (buildings || []).filter((b: any) =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.manager?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-black text-[#1E3A4C] tracking-tight">Building Directory</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                  Property Management Hub
                </p>
              </div>

              {view === "LIST" && (
                <button
                  onClick={() => {
                    setEditingBuilding(null);
                    setView("CREATE");
                  }}
                  style={{ backgroundColor: SYSTEM_BLUE }}
                  className="text-white px-5 py-2 rounded-xl font-bold text-[13px] flex items-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95"
                >
                  <PlusIcon className="h-4 w-4 stroke-[2.5]" /> Add Building
                </button>
              )}
            </div>

            {view === "LIST" ? (
              <div className="flex-1 animate-in fade-in zoom-in-95 duration-500">
                <ReusableTable
                  themeColor="blue"
                  data={filteredBuildings}
                  isLoading={isLoading}
                  onSearch={setSearchQuery}
                  onRowClick={handleRowClick}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  onAdd={() => {
                    setEditingBuilding(null);
                    setView("CREATE");
                  }}
                  addButtonLabel="Add Building"
                  tabs={[
                    { id: "all", label: "All Buildings", count: buildings.length },
                    { id: "active", label: "Active", count: buildings.length }
                  ]}
                  activeTab="all"
                  columns={[
                    {
                      header: "BUILDING DETAILS",
                      render: (b) => (
                        <div className="flex items-center gap-3 py-1">
                          <div className="w-9 h-9 rounded-xl bg-slate-50 text-[#1E3A4C] flex items-center justify-center font-black text-xs border border-slate-100">
                            <BuildingOfficeIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm leading-none">{b.name}</p>
                            <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase">ID: {b._id?.slice(-5).toUpperCase()}</p>
                          </div>
                        </div>
                      )
                    },
                    {
                      header: "LOCATION",
                      render: (b) => (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-300" /> {b.location}
                        </div>
                      )
                    },
                    {
                      header: "MANAGER",
                      render: (b) => (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {b.manager?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{b.manager?.name || "Unassigned"}</p>
                            <p className="text-[10px] text-slate-400">{b.manager?.email || "—"}</p>
                          </div>
                        </div>
                      )
                    },
                    {
                      header: "POLICY",
                      render: (b) => (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          b.approvalPolicy === 'MANAGER_ONLY' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                        }`}>
                          <ShieldCheckIcon className="h-3 w-3" />
                          {b.approvalPolicy?.replace('_', ' ')}
                        </span>
                      )
                    },
                    {
                      header: "FLOORS",
                      render: (b) => (
                        <span className="text-[11px] text-slate-600 font-medium">
                          {b.floorLimit || 0} floors
                        </span>
                      )
                    },
                    {
                      header: "STATUS",
                      render: () => (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-100 uppercase tracking-widest">
                          Active
                        </span>
                      )
                    }
                  ]}
                />
              </div>
            ) : (
              <div className="w-full flex justify-center py-4">
                <ReusableForm
                  config={buildingFormConfig}
                  initialData={editingBuilding}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setView("LIST");
                    setEditingBuilding(null);
                  }}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}

            <DeleteConfirmModal
              isOpen={deleteConfirmOpen}
              onClose={() => {
                setDeleteConfirmOpen(false);
                setBuildingToDelete(null);
              }}
              onConfirm={handleDeleteConfirm}
              title="Delete Building"
              message="Are you sure you want to delete this building"
              itemName={buildingToDelete?.name}
            />

            <DetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              title="Building Details"
              data={selectedBuilding}
              onEdit={handleEdit}
              onDelete={(building) => handleDeleteClick(building)}
              fields={[
                { key: "name", label: "Building Name" },
                { key: "location", label: "Location" },
                { key: "manager.name", label: "Manager" },
                { key: "manager.email", label: "Manager Email" },
                { key: "approvalPolicy", label: "Approval Policy" },
                { key: "floorLimit", label: "Floor Limit" },
                { key: "allowedRoomTypes", label: "Allowed Room Types", render: (v) => Array.isArray(v) ? v.join(", ") : "—" },
                { key: "brandingName", label: "Branding Name" },
                { key: "createdAt", label: "Created At", render: (v) => v ? new Date(v).toLocaleDateString() : "—" }
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
