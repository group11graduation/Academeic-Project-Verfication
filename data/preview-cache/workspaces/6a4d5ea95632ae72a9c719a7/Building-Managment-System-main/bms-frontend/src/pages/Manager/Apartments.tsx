import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
// No longer need useBuilding - using localStorage directly like other pages
import {
  BuildingOffice2Icon,
  PlusIcon,
  HomeModernIcon,
  XMarkIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE_APARTMENT" | "EDIT_APARTMENT" | "VIEW_ROOMS" | "ADD_ROOM";

interface Floor {
  _id: string;
  floorNumber: number;
}

interface Apartment {
  _id?: string;
  id?: string;
  roomNumber: string;
  type: string;
  capacity?: number;
  status?: string;
  floor?: Floor | string;
  isApartment: boolean;
  payment?: {
    amount: number;
    frequency: string;
    currency: string;
  };
}

export function ManageApartments() {
  const [apartments, setApartments] = useState<any[]>([]);
  const [apartmentRooms, setApartmentRooms] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [selectedApartment, setSelectedApartment] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [apartmentForm, setApartmentForm] = useState({
    roomNumber: "",
    type: "APARTMENT",
    capacity: 1,
    floorId: "",
    paymentAmount: 0,
    paymentFrequency: "MONTHLY"
  });

  const [roomForm, setRoomForm] = useState({
    roomNumber: "",
    type: "SINGLE",
    paymentAmount: 0,
    paymentFrequency: "MONTHLY"
  });

  // Local state for building ID (works even if context isn't populated)
  const [currentBuildingId, setCurrentBuildingId] = useState<string | null>(null);

  useEffect(() => {
    // Get selected building ID from localStorage on mount
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    setCurrentBuildingId(savedBuildingId);
    if (savedBuildingId) {
      loadData(savedBuildingId);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen for building changes
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId || localStorage.getItem("selectedBuildingId");
      setCurrentBuildingId(buildingId);
      if (buildingId) {
        loadData(buildingId);
      }
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const loadData = async (buildingId: string | null) => {
    if (!buildingId) {
      setApartments([]);
      setFloors([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [roomsRes, floorsRes] = await Promise.all([
        api.getRooms(false, buildingId),
        api.getFloors(buildingId)
      ]);
      
      // Filter to get apartments (isApartment = true OR type contains "apartment")
      const apartmentsOnly = (roomsRes || []).filter((r: any) => 
        r.isApartment === true || 
        (r.type && r.type.toLowerCase().includes("apartment"))
      );
      setApartments(apartmentsOnly);
      setFloors(Array.isArray(floorsRes) ? floorsRes : []);
    } catch (err) {
      toast.error("Failed to load apartment data");
    } finally {
      setLoading(false);
    }
  };

  const loadApartmentRooms = async (apartmentId: string) => {
    try {
      const rooms = await api.getRooms(false, currentBuildingId || undefined);
      const childRooms = (rooms || []).filter((r: any) => 
        r.parentApartment && (r.parentApartment._id === apartmentId || r.parentApartment === apartmentId)
      );
      setApartmentRooms(childRooms);
    } catch (err) {
      toast.error("Failed to load apartment rooms");
      setApartmentRooms([]);
    }
  };

  const handleRowClick = (apartment: any) => {
    setSelectedApartment(apartment);
    setIsDetailModalOpen(true);
  };

  const handleViewRooms = async (apartment: any) => {
    setSelectedApartment(apartment);
    await loadApartmentRooms(apartment._id || apartment.id);
    setView("VIEW_ROOMS");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const itemId = itemToDelete._id || itemToDelete.id;
    if (!itemId) {
      toast.error("ID is missing. Cannot delete.");
      return;
    }
    try {
      await api.deleteRoom(itemId);
      toast.success(itemToDelete.isApartment ? "Apartment deleted successfully" : "Room deleted successfully");
      
      if (view === "VIEW_ROOMS" && selectedApartment) {
        await loadApartmentRooms(selectedApartment._id || selectedApartment.id);
      } else {
        loadData(currentBuildingId);
      }
      
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartmentForm.roomNumber || !apartmentForm.floorId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addRoom({
        roomNumber: apartmentForm.roomNumber,
        type: apartmentForm.type || "APARTMENT",
        capacity: apartmentForm.capacity,
        floorId: apartmentForm.floorId,
        buildingId: currentBuildingId,
        isApartment: true,
        payment: {
          amount: apartmentForm.paymentAmount,
          frequency: apartmentForm.paymentFrequency,
          currency: "USD"
        }
      });
      toast.success("Apartment created successfully");
      setView("LIST");
      setApartmentForm({
        roomNumber: "",
        type: "APARTMENT",
        capacity: 1,
        floorId: "",
        paymentAmount: 0,
        paymentFrequency: "MONTHLY"
      });
      loadData(currentBuildingId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create apartment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRoomToApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.roomNumber || !selectedApartment) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const apartmentId = selectedApartment._id || selectedApartment.id;
      const floorId = selectedApartment.floor?._id || selectedApartment.floor;
      
      await api.addRoom({
        roomNumber: roomForm.roomNumber,
        type: roomForm.type,
        floorId: floorId,
        buildingId: currentBuildingId,
        parentApartment: apartmentId,
        isApartment: false,
        payment: {
          amount: roomForm.paymentAmount,
          frequency: roomForm.paymentFrequency,
          currency: "USD"
        }
      });
      toast.success("Room added to apartment successfully");
      setView("VIEW_ROOMS");
      setRoomForm({
        roomNumber: "",
        type: "SINGLE",
        paymentAmount: 0,
        paymentFrequency: "MONTHLY"
      });
      await loadApartmentRooms(apartmentId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add room to apartment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredApartments = apartments.filter(a =>
    a.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const apartmentColumns = [
    {
      header: "APARTMENT",
      render: (apt: any) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <HomeModernIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="font-black text-[#1E3A4C] dark:text-white">{apt.roomNumber}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{apt.type}</div>
          </div>
        </div>
      )
    },
    {
      header: "FLOOR",
      render: (apt: any) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Level {apt.floor?.floorNumber || "N/A"}
        </span>
      )
    },
    {
      header: "CAPACITY",
      render: (apt: any) => (
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {apt.capacity || 0} rooms
        </span>
      )
    },
    {
      header: "PAYMENT",
      render: (apt: any) => (
        <div className="text-sm">
          <span className="font-bold text-[#1E3A4C] dark:text-white">
            ${apt.payment?.amount || 0}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            /{apt.payment?.frequency || "MONTHLY"}
          </span>
        </div>
      )
    },
    {
      header: "ACTIONS",
      render: (apt: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewRooms(apt);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          View Rooms <ChevronRightIcon className="h-3 w-3" />
        </button>
      )
    }
  ];

  const roomColumns = [
    {
      header: "ROOM",
      render: (room: any) => (
        <div>
          <div className="font-black text-[#1E3A4C] dark:text-white">{room.roomNumber}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{room.type}</div>
        </div>
      )
    },
    {
      header: "STATUS",
      render: (room: any) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
          room.status === "OCCUPIED" 
            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" 
            : "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        }`}>
          {room.status || "AVAILABLE"}
        </span>
      )
    },
    {
      header: "PAYMENT",
      render: (room: any) => (
        <div className="text-sm">
          <span className="font-bold text-[#1E3A4C] dark:text-white">
            ${room.payment?.amount || 0}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            /{room.payment?.frequency || "MONTHLY"}
          </span>
        </div>
      )
    }
  ];

  const apartmentDetailFields = [
    { label: "Apartment Number", key: "roomNumber" },
    { label: "Type", key: "type" },
    { label: "Capacity", key: "capacity", transform: (val: number) => `${val || 0} rooms` },
    { label: "Floor", key: "floor.floorNumber", transform: (val: number) => `Level ${val}` },
    { label: "Payment Amount", key: "payment.amount", transform: (val: number) => val ? `$${val}` : "N/A" },
    { label: "Payment Frequency", key: "payment.frequency" },
    { label: "Status", key: "status" }
  ];

  // If no building selected - show message to go to dashboard first
  if (!currentBuildingId) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide flex items-center justify-center">
            <div className="text-center bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-100 dark:border-gray-700">
              <BuildingOffice2Icon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white mb-2">No Building Selected</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Please select a building from the dashboard first.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Create Apartment Form
  if (view === "CREATE_APARTMENT") {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white">Create New Apartment</h2>
                  <button
                    onClick={() => setView("LIST")}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleCreateApartment} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Apartment Number *
                    </label>
                    <input
                      type="text"
                      value={apartmentForm.roomNumber}
                      onChange={(e) => setApartmentForm({ ...apartmentForm, roomNumber: e.target.value })}
                      placeholder="e.g., APT-101"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Floor *
                    </label>
                    <select
                      value={apartmentForm.floorId}
                      onChange={(e) => setApartmentForm({ ...apartmentForm, floorId: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Floor</option>
                      {floors.map((floor: any) => (
                        <option key={floor._id || floor.id} value={floor._id || floor.id}>
                          Level {floor.floorNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Capacity (Number of Rooms)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={apartmentForm.capacity}
                      onChange={(e) => setApartmentForm({ ...apartmentForm, capacity: parseInt(e.target.value) || 1 })}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Payment Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={apartmentForm.paymentAmount}
                        onChange={(e) => setApartmentForm({ ...apartmentForm, paymentAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Frequency
                      </label>
                      <select
                        value={apartmentForm.paymentFrequency}
                        onChange={(e) => setApartmentForm({ ...apartmentForm, paymentFrequency: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="YEARLY">Yearly</option>
                        <option value="ONE_TIME">One Time</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setView("LIST")}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-[#1E3A4C] dark:bg-blue-700 text-white hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "Creating..." : "Create Apartment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // View Apartment Rooms
  if (view === "VIEW_ROOMS" && selectedApartment) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
            <div className="flex justify-between items-center mb-8">
              <div>
                <button
                  onClick={() => { setView("LIST"); setSelectedApartment(null); }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 flex items-center gap-1"
                >
                  ← Back to Apartments
                </button>
                <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">
                  {selectedApartment.roomNumber} - Rooms
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage rooms inside this apartment (Capacity: {selectedApartment.capacity || 0} rooms)
                </p>
              </div>
              <button
                onClick={() => setView("ADD_ROOM")}
                className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
              >
                <PlusIcon className="h-5 w-5" /> Add Room
              </button>
            </div>

            {apartmentRooms.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-700">
                <HomeModernIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">No Rooms Yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  This apartment doesn't have any rooms yet. Add rooms to start managing tenants.
                </p>
                <button
                  onClick={() => setView("ADD_ROOM")}
                  className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
                >
                  Add First Room
                </button>
              </div>
            ) : (
              <ReusableTable
                data={apartmentRooms}
                columns={roomColumns}
                isLoading={loading}
                onRowClick={(room) => { setSelectedApartment(room); setIsDetailModalOpen(true); }}
                onDelete={handleDeleteClick}
                emptyMessage="No rooms in this apartment."
              />
            )}
          </div>
        </main>

        <DeleteConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }}
          onConfirm={handleDeleteConfirm}
          title="Delete Room"
          message="Are you sure you want to delete"
          itemName={itemToDelete?.roomNumber || "this room"}
        />
      </div>
    );
  }

  // Add Room to Apartment Form
  if (view === "ADD_ROOM" && selectedApartment) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white">Add Room to Apartment</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Adding room to: <span className="font-bold">{selectedApartment.roomNumber}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setView("VIEW_ROOMS")}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleAddRoomToApartment} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Room Number *
                    </label>
                    <input
                      type="text"
                      value={roomForm.roomNumber}
                      onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                      placeholder="e.g., Room 1 or R-101"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Room Type
                    </label>
                    <select
                      value={roomForm.type}
                      onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SINGLE">Single</option>
                      <option value="DOUBLE">Double</option>
                      <option value="MASTER">Master</option>
                      <option value="STUDIO">Studio</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Payment Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={roomForm.paymentAmount}
                        onChange={(e) => setRoomForm({ ...roomForm, paymentAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Frequency
                      </label>
                      <select
                        value={roomForm.paymentFrequency}
                        onChange={(e) => setRoomForm({ ...roomForm, paymentFrequency: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="YEARLY">Yearly</option>
                        <option value="ONE_TIME">One Time</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setView("VIEW_ROOMS")}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-[#1E3A4C] dark:bg-blue-700 text-white hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "Adding..." : "Add Room"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main Apartment List View
  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">Apartment Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create apartments and add rooms inside them</p>
            </div>
            <button
              onClick={() => setView("CREATE_APARTMENT")}
              className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
            >
              <PlusIcon className="h-5 w-5" /> Add Apartment
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search apartments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <ReusableTable
            data={filteredApartments}
            columns={apartmentColumns}
            isLoading={loading}
            onRowClick={handleRowClick}
            onDelete={handleDeleteClick}
            emptyMessage="No apartments created yet. Create your first apartment to manage rooms inside it."
          />

          <DetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            title="Apartment Details"
            data={selectedApartment}
            fields={apartmentDetailFields}
            onEdit={() => handleViewRooms(selectedApartment)}
            onDelete={handleDeleteClick}
          />

          <DeleteConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }}
            onConfirm={handleDeleteConfirm}
            title="Delete Apartment"
            message="Are you sure you want to delete"
            itemName={itemToDelete?.roomNumber || "this apartment"}
          />
        </div>
      </main>
    </div>
  );
}
