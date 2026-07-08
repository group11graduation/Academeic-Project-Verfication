import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, roomFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { PlusIcon } from "@heroicons/react/24/outline";
import * as reportsApi from "../../api/reports.api";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function SubManageRooms() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRoomFormConfig, setCurrentRoomFormConfig] = useState(roomFormConfig);

  useEffect(() => {
    loadData();
    fetchBuildingInfo();
  }, []);

  const fetchBuildingInfo = async () => {
    try {
      const report = await reportsApi.getManagerReport();
      if (report?.allowedRoomTypes && report.allowedRoomTypes.length > 0) {
        const updatedConfig = { ...roomFormConfig };
        if (updatedConfig.steps[0]?.fields) {
          const typeField = updatedConfig.steps[0].fields.find((f: any) => f.name === "type");
          if (typeField) {
            typeField.options = report.allowedRoomTypes.map((t: string) => ({ value: t, label: t }));
          }
        }
        setCurrentRoomFormConfig(updatedConfig);
      }
    } catch (err) {
      console.error("Failed to load building info", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getRooms(false);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (room: any) => {
    setSelectedRoom(room);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (room: any) => {
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
      const res = await api.deleteRoom(roomId);
      if (res?.isPending) {
        toast.success("Delete request sent to manager for approval");
      } else {
        toast.success("Room deleted successfully");
      }
      loadData();
      setDeleteConfirmOpen(false);
      setRoomToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete room");
    }
  };

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingRoom) {
        const roomId = editingRoom._id || editingRoom.id;
        if (!roomId) {
          toast.error("Room ID is missing. Cannot update.");
          return;
        }
        const res = await api.updateRoom(roomId, formData);
        if (res?.isPending) {
          toast.success("Update request sent to manager for approval");
        } else {
          toast.success("Room updated successfully");
        }
      } else {
        await api.addRoom(formData);
        toast.success("Room created successfully");
      }
      setView("LIST");
      setEditingRoom(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          Level {room.floor?.floorNumber || "N/A"}
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
    { label: "Payment Amount", key: "payment.amount", transform: (val: number) => val ? `$${val}` : "N/A" },
    { label: "Payment Frequency", key: "payment.frequency" }
  ];

  if (view !== "LIST") {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
            <div className="max-w-4xl mx-auto w-full">
              <ReusableForm
                config={currentRoomFormConfig}
                initialData={editingRoom}
                onSubmit={handleFormSubmit}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage all rooms. Updates and deletions require manager approval.</p>
            </div>
            <button
              onClick={() => setView("CREATE")}
              className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
            >
              <PlusIcon className="h-5 w-5" /> Add Room
            </button>
          </div>

          <ReusableTable
            data={rooms}
            columns={roomColumns}
            isLoading={loading}
            onRowClick={handleRowClick}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            emptyMessage="No rooms registered for this building yet."
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
            title="Request Room Deletion"
            message="This will send a deletion request to the manager for approval. Are you sure you want to delete"
            itemName={roomToDelete?.roomNumber}
          />
        </div>
      </main>
    </div>
  );
}
