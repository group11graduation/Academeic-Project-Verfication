import React, { useState, useEffect } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, buildingFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  MapPinIcon, 
  BuildingOffice2Icon, 
  ChevronRightIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

interface Building {
  _id: string;
  name: string;
  brandingName?: string;
  brandingLogo?: string;
  location: string;
  floorLimit: number;
  manager?: {
    name: string;
    email: string;
  };
}

export function ManageBuildings() {
  const [view, setView] = useState<"LIST" | "CREATE" | "EDIT">("LIST");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [buildingToDelete, setBuildingToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadBuildings(); }, []);

  const loadBuildings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAllBuildings();
      setBuildings(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load buildings");
      setBuildings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBuildings = buildings.filter(b => 
    (b.name || b.brandingName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.location || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (building: Building) => {
    setSelectedBuilding(building);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (building: any) => {
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
      loadBuildings();
      setDeleteConfirmOpen(false);
      setBuildingToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete building");
    }
  };

  const handleFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      if (editingBuilding) {
        const buildingId = editingBuilding._id || editingBuilding.id;
        if (!buildingId) {
          toast.error("Building ID is missing. Cannot update.");
          setIsSubmitting(false);
          return;
        }
        await api.updateBuilding(buildingId, data);
        toast.success("Building updated successfully");
        // Dispatch event to notify other pages (like Payments) that a building was updated
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('buildingUpdated', { detail: { buildingId } }));
        }, 100);
      } else {
        await api.createBuilding(data);
        toast.success("Building created successfully");
        // Dispatch event to notify other pages (like Payments) that a building was created
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('buildingCreated', { detail: { building: data } }));
        }, 100);
      }
      setView("LIST");
      setEditingBuilding(null);
      loadBuildings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${editingBuilding ? 'update' : 'create'} building`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    setView("LIST");
    setEditingBuilding(null);
  };

  const detailFields = [
    { label: "Building Name", key: "name" },
    { label: "Branding Name", key: "brandingName" },
    { label: "Location", key: "location" },
    { label: "Floor Limit", key: "floorLimit" },
    { label: "Manager", key: "manager.name", nested: true },
    { label: "Manager Email", key: "manager.email", nested: true },
    { label: "Approval Policy", key: "approvalPolicy" },
    { label: "Room Types", key: "allowedRoomTypes", array: true },
  ];

  const columns = [
    {
      header: "PROPERTY IDENTITY",
      render: (b: Building) => (
        <div className="flex items-center gap-4 group/item py-1">
          <div className="w-11 h-11 overflow-hidden rounded-xl border border-slate-100 shadow-sm transition-all duration-300 group-hover/item:scale-110 flex-shrink-0">
            {b.brandingLogo ? (
              <img src={b.brandingLogo} className="w-full h-full object-cover" alt="logo" />
            ) : (
              <div style={{ backgroundColor: SYSTEM_BLUE }} className="w-full h-full text-white flex items-center justify-center">
                <BuildingOffice2Icon className="w-6 h-6" />
              </div>
            )}
          </div>
          <div>
            <p className="font-black text-slate-800 text-[13px] leading-tight tracking-tight uppercase">
                {b.brandingName || b.name || "Unnamed"}
            </p>
            <p className="text-[10px] text-blue-500 font-black mt-1 uppercase tracking-wider">
               ID: {b._id?.slice(-5).toUpperCase()} • {b.floorLimit || 0} FLOORS
            </p>
          </div>
        </div>
      )
    },
    {
      header: "LOCATION",
      render: (b: Building) => (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-tight">
          <MapPinIcon className="w-4 h-4 text-slate-300" />
          <span>{b.location}</span>
        </div>
      )
    },
    {
      header: "ASSIGNED MANAGER",
      render: (b: Building) => (
        <div className="flex items-center gap-3 group/mgr cursor-default">
          <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 transition-all duration-300 group-hover/mgr:bg-[#1E3A4C] group-hover/mgr:border-[#1E3A4C]">
            <span className="text-[11px] font-black text-slate-400 group-hover/mgr:text-white">
                {b.manager?.name?.[0] || "?"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-black text-slate-700 leading-tight">
                {b.manager?.name || "Unassigned"}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{b.manager?.email || "No email"}</span>
          </div>
        </div>
      )
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-hide">
          <div className="max-w-[1400px] mx-auto h-full flex flex-col">
            
            {/* TOP HEADER */}
            <div className="flex justify-between items-center mb-12">
              <div className="animate-in fade-in slide-in-from-left-6 duration-700">
                <h1 className="text-4xl font-black text-[#1E3A4C] tracking-tight">
                    {view === "LIST" ? "Building Hub" : "Register Property"}
                </h1>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1.5 opacity-70">
                    Sky Property Administration
                </p>
              </div>

              {view === "LIST" && (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-700">
                  <button 
                    onClick={() => toast.success("Exporting...")}
                    className="flex items-center gap-2.5 px-6 py-3 bg-white border border-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 stroke-[3]" /> Export
                  </button>
                  <button 
                    onClick={() => { setView("CREATE"); setEditingBuilding(null); }}
                    style={{ backgroundColor: SYSTEM_BLUE }}
                    className="flex items-center gap-2.5 px-8 py-3.5 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 hover:opacity-90 transition-all active:scale-95 hover:scale-[1.02]"
                  >
                    <PlusIcon className="w-5 h-5 stroke-[3]" /> Register Building
                  </button>
                </div>
              )}
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1">
                {view === "LIST" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <ReusableTable<Building>
                      themeColor="blue"
                      data={filteredBuildings}
                      columns={columns}
                      isLoading={isLoading}
                      onSearch={setSearchQuery}
                      onRowClick={handleRowClick}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteClick}
                      tabs={[
                        { id: "all", label: "All Properties", count: buildings.length },
                        { id: "active", label: "Active", count: buildings.length },
                      ]}
                      activeTab="all"
                    />
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto w-full">
                    <ReusableForm
                      config={buildingFormConfig}
                      initialData={editingBuilding}
                      onSubmit={handleFormSubmit}
                      onCancel={handleFormCancel}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        
        /* Premium Row Hover Effect */
        tr.group:hover {
          background-color: white !important;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.04);
          transform: translateY(-2px);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
          position: relative;
        }

        /* Input styling for Search Bar if needed */
        input::placeholder {
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-size: 10px;
            font-weight: 900;
            color: #94a3b8;
        }
      `}</style>

      {/* Detail Modal */}
      <DetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedBuilding(null); }}
        title="Building Details"
        data={selectedBuilding}
        fields={detailFields}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setBuildingToDelete(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Building"
        message="Are you sure you want to delete this building"
        itemName={buildingToDelete?.name || buildingToDelete?.brandingName}
      />
    </div>
  );
}