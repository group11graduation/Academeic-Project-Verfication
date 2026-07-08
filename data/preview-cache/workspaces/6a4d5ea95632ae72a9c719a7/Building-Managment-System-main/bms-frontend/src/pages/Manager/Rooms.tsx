import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, roomFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function ManageRooms() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      const [rRes, fRes] = await Promise.all([
        api.getRooms(false, buildingId || undefined), 
        api.getFloors(buildingId || undefined)
      ]);
      // Filter out only child rooms inside apartments - they are managed in the Apartments page
      // Keep regular rooms AND parent apartments visible
      const mainRooms = (Array.isArray(rRes) ? rRes : []).filter((r: any) => 
        !r.parentApartment // Only exclude child rooms inside apartments
      );
      setRooms(mainRooms);
      setFloors(Array.isArray(fRes) ? fRes : []);
    } catch (err) {
      toast.error("Failed to load room data");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (room: any) => {
    setSelectedRoom(room);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (room: any) => {
    // Map floor object to floorId for the form
    const dataForEdit = {
      ...room,
      floorId: room.floor?._id || room.floorId || ""
    };
    setEditingRoom(dataForEdit);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (room: any) => {
    setRoomToDelete(room);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roomToDelete) return;
    const roomId = roomToDelete._id || roomToDelete.id;
    if (!roomId) {
      toast.error("Room ID is missing. Cannot delete.");
      return;
    }
    try {
      await api.deleteRoom(roomId);
      toast.success("Room deleted successfully");
      loadData(selectedBuildingId);
      setDeleteConfirmOpen(false);
      setRoomToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete room");
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      // Get selected building ID from localStorage
      const currentBuildingId = localStorage.getItem("selectedBuildingId");
      
      if (editingRoom) {
        const roomId = editingRoom._id || editingRoom.id;
        if (!roomId) {
          toast.error("Room ID is missing. Cannot update.");
          return;
        }
        await api.updateRoom(roomId, formData);
        toast.success("Room updated successfully");
      } else {
        // Include buildingId in form data when creating room
        await api.addRoom({ ...formData, buildingId: currentBuildingId });
        toast.success("Room added successfully");
      }
      setView("LIST");
      setEditingRoom(null);
      loadData(selectedBuildingId || currentBuildingId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${editingRoom ? 'update' : 'create'} room`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRooms = rooms.filter(r =>
    r.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.floor?.building?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roomColumns = [
    {
      header: "ROOM",
      render: (room: any) => (
        <div>
          <div className="font-black text-[#1E3A4C]">{room.roomNumber}</div>
          <div className="text-xs text-gray-500">{room.type}</div>
        </div>
      )
    },
    {
      header: "STATUS",
      render: (room: any) => {
        const isOccupied = room.status === "OCCUPIED";
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            isOccupied ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {room.status || "AVAILABLE"}
          </span>
        );
      }
    },
    {
      header: "LOCATION",
      render: (room: any) => (
        <div className="text-sm">
          Level {room.floor?.floorNumber || "N/A"} ({room.floor?.building?.name || "N/A"})
        </div>
      )
    },
    {
      header: "PAYMENT",
      render: (room: any) => (
        <div className="text-sm">
          {room.payment?.amount ? `$${room.payment.amount}/${room.payment.frequency || "MONTHLY"}` : "N/A"}
        </div>
      )
    }
  ];

  const roomDetailFields = [
    { label: "Room Number", key: "roomNumber" },
    { label: "Type", key: "type" },
    { label: "Status", key: "status" },
    { label: "Capacity", key: "capacity" },
    { label: "Floor", key: "floor.floorNumber", transform: (val: number) => `Level ${val}` },
    { label: "Building", key: "floor.building.name" },
    { label: "Payment Amount", key: "payment.amount", transform: (val: number) => val ? `$${val}` : "N/A" },
    { label: "Payment Frequency", key: "payment.frequency" },
    { label: "Currency", key: "payment.currency" }
  ];

  if (view !== "LIST") {
    return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-4xl mx-auto w-full">
            <ReusableForm
              config={roomFormConfig}
              initialData={editingRoom}
              onSubmit={handleSubmit}
              onCancel={() => { setView("LIST"); setEditingRoom(null); }}
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
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">Room Inventory</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage rooms within your building</p>
          </div>
          <button
            onClick={() => { setEditingRoom(null); setView("CREATE"); }}
            className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
          >
            Add Room
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search rooms by number, type, or building..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <ReusableTable
          data={filteredRooms}
          columns={roomColumns}
          isLoading={loading}
          onRowClick={handleRowClick}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          emptyMessage="No rooms registered yet."
        />

        <DetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Room Details"
          data={selectedRoom}
          fields={roomDetailFields}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />

        <DeleteConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => { setDeleteConfirmOpen(false); setRoomToDelete(null); }}
          onConfirm={handleDeleteConfirm}
          title="Delete Room"
          message="Are you sure you want to delete"
          itemName={roomToDelete?.roomNumber || "this room"}
        />
        </div>
      </main>
    </div>
  );
}
