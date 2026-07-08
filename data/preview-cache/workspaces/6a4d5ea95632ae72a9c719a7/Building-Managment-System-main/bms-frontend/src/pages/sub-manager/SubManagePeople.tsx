import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { ReusableForm, personFormConfig } from "../../components/ReusableForm";
import { DetailModal } from "../../components/DetailModal";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { PlusIcon } from "@heroicons/react/24/outline";

type ViewMode = "LIST" | "CREATE" | "EDIT";

export function SubManagePeople() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("LIST");
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getPeople();
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
    const dataForEdit = {
      ...person,
      roomId: person.room?._id || person.room || ""
    };
    setEditingPerson(dataForEdit);
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
      const res = await api.deletePerson(personId);
      if (res?.isPending) {
        toast.success("Delete request sent to manager for approval");
      } else {
        toast.success("Person deleted successfully");
      }
      loadData();
      setDeleteConfirmOpen(false);
      setPersonToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete person");
    }
  };

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingPerson) {
        const personId = editingPerson._id || editingPerson.id;
        if (!personId) {
          toast.error("Person ID is missing. Cannot update.");
          return;
        }
        const res = await api.updatePerson(personId, formData);
        if (res?.isPending) {
          toast.success("Update request sent to manager for approval");
        } else {
          toast.success("Person updated successfully");
        }
      } else {
        await api.assignPerson(formData);
        toast.success("Person assigned successfully");
      }
      setView("LIST");
      setEditingPerson(null);
      loadData();
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
          <div className="font-bold text-gray-800">{person.name}</div>
          <div className="text-xs text-gray-400">{person.phone}</div>
        </div>
      )
    },
    {
      header: "TYPE",
      render: (person: any) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
          person.type === "TENANT" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
        }`}>
          {person.type}
        </span>
      )
    },
    {
      header: "ROOM",
      render: (person: any) => (
        <div className="text-sm">
          {person.room?.roomNumber ? `Room ${person.room.roomNumber}` : "Not Assigned"}
        </div>
      )
    },
    {
      header: "FLOOR",
      render: (person: any) => (
        <div className="text-sm text-gray-600">
          {person.room?.floor?.floorNumber ? `Level ${person.room.floor.floorNumber}` : "N/A"}
        </div>
      )
    }
  ];

  const personDetailFields = [
    { label: "Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Type", key: "type" },
    { label: "Room", key: "room.roomNumber", transform: (val: any) => val ? `Room ${val}` : "Not Assigned" },
    { label: "Floor", key: "room.floor.floorNumber", transform: (val: number) => val ? `Level ${val}` : "N/A" },
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
                onSubmit={handleFormSubmit}
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
              <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">People & Tenants</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage tenants and staff. Updates and deletions require manager approval.</p>
            </div>
            <button
              onClick={() => { setEditingPerson(null); setView("CREATE"); }}
              className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#2a4d63] dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95"
            >
              <PlusIcon className="h-5 w-5" /> Add Person
            </button>
          </div>

          <ReusableTable
            data={people}
            columns={peopleColumns}
            isLoading={loading}
            onRowClick={handleRowClick}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            emptyMessage="No people registered for this building yet."
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
            title="Request Person Deletion"
            message="This will send a deletion request to the manager for approval. Are you sure you want to delete"
            itemName={personToDelete?.name || "this person"}
          />
        </div>
      </main>
    </div>
  );
}
