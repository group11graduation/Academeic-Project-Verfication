import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, personFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { UserPlusIcon } from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function ManagePeople() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const data = await api.getPeople(buildingId || undefined);
      setPeople(data || []);
    } catch (err: any) {
      toast.error("Failed to load people");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (person: any) => {
    setSelectedPerson(person);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (person: any) => {
    setEditingPerson(person);
    setView("EDIT");
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (person: any) => {
    setPersonToDelete(person);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!personToDelete) return;
    const personId = personToDelete._id || personToDelete.id;
    if (!personId) {
      toast.error("Person ID is missing. Cannot delete.");
      return;
    }
    try {
      await api.deletePerson(personId);
      toast.success("Person removed successfully");
      loadData(selectedBuildingId);
      setDeleteConfirmOpen(false);
      setPersonToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete person");
    }
  };

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      // Get selected building ID from localStorage
      const currentBuildingId = localStorage.getItem("selectedBuildingId");
      
      if (editingPerson) {
        const personId = editingPerson._id || editingPerson.id;
        if (!personId) {
          toast.error("Person ID is missing. Cannot update.");
          return;
        }
        await api.updatePerson(personId, formData);
        toast.success("Person updated successfully");
      } else {
        // Validate room assignment for tenants
        if (formData.type !== "STAFF" && !formData.room && !formData.roomId) {
          toast.error("Please select a room for tenants");
          setIsSubmitting(false);
          return;
        }
        // Include buildingId in form data when assigning person
        await api.assignPerson({ ...formData, buildingId: currentBuildingId });
        toast.success("Person assigned successfully");
      }
      setView("LIST");
      setEditingPerson(null);
      loadData(selectedBuildingId || currentBuildingId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const peopleColumns = [
    {
      header: "NAME & CONTACT",
      render: (person: any) => (
        <div>
          <div className="font-bold text-gray-800 dark:text-gray-200">{person.name}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{person.phone}</div>
        </div>
      )
    },
    {
      header: "TYPE",
      render: (person: any) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
          person.type === "TENANT" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        }`}>
          {person.type}
        </span>
      )
    },
    {
      header: "ROOM ASSIGNMENT",
      render: (person: any) => (
        <div className="text-sm">
          {person.room ? (
            <span className="font-bold text-[#1E3A4C] dark:text-white">Room {person.room.roomNumber || person.room}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 italic">No Room</span>
          )}
        </div>
      )
    }
  ];

  const personDetailFields = [
    { label: "Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Type", key: "type" },
    { label: "Room", key: "room.roomNumber", transform: (val: string) => val ? `Room ${val}` : "No Room Assigned" },
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
              config={personFormConfig}
              initialData={editingPerson}
              onSubmit={handleSubmit}
              onCancel={() => { setView("LIST"); setEditingPerson(null); }}
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
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">People Assignments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage tenants and staff assignments</p>
          </div>
          <button
            onClick={() => { setEditingPerson(null); setView("CREATE"); }}
            className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-opacity-90 dark:hover:bg-blue-600 shadow-lg transition-all active:scale-95"
          >
            <UserPlusIcon className="h-5 w-5" /> Add Person
          </button>
        </div>

        <ReusableTable
          data={people}
          columns={peopleColumns}
          isLoading={loading}
          onRowClick={handleRowClick}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          emptyMessage="No people assigned yet. Add your first tenant or staff member."
        />

        <DetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Person Details"
          data={selectedPerson}
          fields={personDetailFields}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />

        <DeleteConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => { setDeleteConfirmOpen(false); setPersonToDelete(null); }}
          onConfirm={handleDeleteConfirm}
          title="Delete Person"
          message="Are you sure you want to delete"
          itemName={personToDelete?.name || "this person"}
        />
        </div>
      </main>
    </div>
  );
}
