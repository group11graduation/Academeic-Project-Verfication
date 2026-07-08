import React, { useState, useEffect } from "react";
import { 
  CheckIcon, UserIcon, BuildingOfficeIcon, CurrencyDollarIcon, 
  QueueListIcon, PhotoIcon, PlusIcon, TrashIcon, MapPinIcon,
  UserCircleIcon, ShieldCheckIcon, Squares2X2Icon, KeyIcon, HomeIcon
} from "@heroicons/react/24/outline";
import * as api from "../api/admin.api";

interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number" | "select" | "textarea" | "file" | "multiselect";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  step?: number;
}

interface FormConfig {
  type: "manager" | "building" | "floor" | "room" | "subManager" | "person";
  title: string;
  steps: {
    id: number;
    name: string;
    icon: any;
    fields: FormField[];
  }[];
}

interface ReusableFormProps {
  config: FormConfig;
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const SYSTEM_COLOR = "#1E3A4C";

// Helper function moved outside component to avoid hoisting issues
const getDefaultFormData = (type: string) => {
  if (type === "manager") {
    return {
      name: "",
      email: "",
      password: "",
      phone: "",
      sections: [],
      buildingLogo: "",
      role: "MANAGER",
      adminPerson: null
    };
  } else if (type === "building") {
    return {
      name: "",
      location: "",
      managerId: "",
      approvalPolicy: "MANAGER_ONLY",
      brandingName: "",
      brandingLogo: "",
      floorLimit: "",
      allowedRoomTypes: [],
      paymentDetails: { amount: "", frequency: "MONTHLY" }
    };
  } else if (type === "floor") {
    return {
      floorNumber: ""
    };
  } else if (type === "room") {
    return {
      roomNumber: "",
      type: "",
      floorId: "",
      capacity: "",
      status: "AVAILABLE",
      payment: { amount: 0, frequency: "MONTHLY", currency: "USD" },
      parentApartment: null,
      isApartment: false,
      paymentTracking: "ROOM_LEVEL"
    };
  } else if (type === "subManager") {
    return {
      name: "",
      email: "",
      password: ""
    };
  } else if (type === "person") {
    return {
      name: "",
      phone: "",
      type: "TENANT",
      roomId: ""
    };
  }
  return {};
};

export function ReusableForm({ config, initialData, onSubmit, onCancel, isSubmitting }: ReusableFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>(() => {
    if (initialData) {
      const data = { ...initialData };
      if (data.adminPerson?._id) data.adminPerson = data.adminPerson._id;
      
      // Handle manager for buildings - extract ID if it's an object
      if (data.manager?._id) {
        data.managerId = data.manager._id;
        // Don't keep manager object, only managerId
        delete data.manager;
      } else if (data.managerId && typeof data.managerId === "string") {
        // Ensure managerId is a valid ObjectId string, not a display label
        if (data.managerId.includes("(")) {
          // This is a display label, not an ID - we'll need to find the actual ID
          // For now, clear it and let the user select again
          data.managerId = "";
        }
      }
      
      // Ensure paymentDetails structure exists
      if (!data.paymentDetails) {
        data.paymentDetails = { amount: "", frequency: "MONTHLY" };
      }
      // Ensure sections array exists
      if (!data.sections) {
        data.sections = [];
      }
      // Ensure allowedRoomTypes array exists
      if (!data.allowedRoomTypes) {
        data.allowedRoomTypes = [];
      }
      // Handle floor for rooms - extract ID if it's an object
      if (data.floor?._id) {
        data.floorId = data.floor._id;
        delete data.floor;
      }
      // Ensure payment structure exists for rooms
      if (!data.payment) {
        data.payment = { amount: 0, frequency: "MONTHLY", currency: "USD" };
      }
      // Handle apartment fields
      if (data.parentApartment?._id) {
        data.parentApartment = data.parentApartment._id;
      }
      if (!data.paymentTracking) {
        data.paymentTracking = "ROOM_LEVEL";
      }
      // Handle person room field - convert room object to roomId
      if (data.room?._id) {
        data.roomId = data.room._id;
        delete data.room;
      } else if (data.room && typeof data.room === "string") {
        data.roomId = data.room;
        delete data.room;
      }
      return data;
    }
    return getDefaultFormData(config.type);
  });

  const [availableAdminPersons, setAvailableAdminPersons] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [allowedRoomTypes, setAllowedRoomTypes] = useState<string[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [newSection, setNewSection] = useState("");
  const [newRoomType, setNewRoomType] = useState("");
  const [showAdminPersonForm, setShowAdminPersonForm] = useState(false);
  const [newAdminPerson, setNewAdminPerson] = useState({ name: "", email: "", phone: "" });
  
  // Predefined room types
  const predefinedRoomTypes = [
    "Office",
    "Apartment",
    "Salon",
    "Gym",
    "Studio",
    "1BR",
    "2BR",
    "3BR",
    "4BR",
    "Penthouse",
    "Retail",
    "Warehouse",
    "Restaurant",
    "Hotel Room",
    "Conference Room",
    "Storage"
  ];

  useEffect(() => {
    if (config.type === "manager") {
      fetchAdminPersons();
    } else if (config.type === "building") {
      fetchManagers();
    } else if (config.type === "room") {
      fetchFloors();
      fetchBuildingInfo();
      fetchApartments();
    } else if (config.type === "person") {
      fetchAvailableRooms();
    }
  }, [config.type]);

  const fetchAdminPersons = async () => {
    try {
      const adminPersons = await api.getAdminPersons();
      setAvailableAdminPersons(adminPersons || []);
    } catch (err) {
      console.error("Failed to load admin persons", err);
    }
  };

  const handleCreateAdminPerson = async () => {
    try {
      if (!newAdminPerson.name || !newAdminPerson.email || !newAdminPerson.phone) {
        alert("Please fill all fields");
        return;
      }
      const created = await api.createAdminPerson(newAdminPerson);
      setAvailableAdminPersons([...availableAdminPersons, created]);
      setFormData({ ...formData, adminPerson: created._id });
      setShowAdminPersonForm(false);
      setNewAdminPerson({ name: "", email: "", phone: "" });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create admin person");
    }
  };

  const fetchManagers = async () => {
    try {
      const managers = await api.getAllManagers();
      setManagers(managers || []);
    } catch (err) {
      console.error("Failed to load managers", err);
    }
  };

  const fetchFloors = async () => {
    try {
      const managerApi = await import("../api/manager.api");
      // Get the selected building ID to fetch floors for the correct building
      const selectedBuildingId = localStorage.getItem("selectedBuildingId") || undefined;
      const floorsList = await managerApi.getFloors(selectedBuildingId);
      setFloors(floorsList || []);
    } catch (err) {
      console.error("Failed to load floors", err);
    }
  };

  const fetchBuildingInfo = async () => {
    try {
      const reportsApi = await import("../api/reports.api");
      // Get the selected building ID to fetch building info for the correct building
      const selectedBuildingId = localStorage.getItem("selectedBuildingId") || undefined;
      const report = await reportsApi.getManagerReport(selectedBuildingId);
      console.log("Building report data:", report); // Debug log
      if (report?.allowedRoomTypes && Array.isArray(report.allowedRoomTypes)) {
        setAllowedRoomTypes(report.allowedRoomTypes);
        console.log("Allowed room types loaded:", report.allowedRoomTypes); // Debug log
      } else {
        console.warn("No allowedRoomTypes found in report or not an array:", report?.allowedRoomTypes);
        setAllowedRoomTypes([]);
      }
    } catch (err) {
      console.error("Failed to load building info", err);
      setAllowedRoomTypes([]);
    }
  };

  const fetchApartments = async () => {
    try {
      const managerApi = await import("../api/manager.api");
      // Get the selected building ID to fetch rooms for the correct building
      const selectedBuildingId = localStorage.getItem("selectedBuildingId") || undefined;
      const rooms = await managerApi.getRooms(false, selectedBuildingId);
      // Filter only apartments (rooms with isApartment = true or type includes "apartment")
      const apartmentRooms = (rooms || []).filter((r: any) => 
        r.isApartment || (r.type && r.type.toLowerCase().includes("apartment"))
      );
      setApartments(apartmentRooms);
    } catch (err) {
      console.error("Failed to load apartments", err);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const managerApi = await import("../api/manager.api");
      // Get the selected building ID to fetch rooms for the correct building
      const selectedBuildingId = localStorage.getItem("selectedBuildingId") || undefined;
      // Get only available rooms (status = AVAILABLE)
      const rooms = await managerApi.getRooms(true, selectedBuildingId);
      console.log("Fetched available rooms:", rooms);
      setAvailableRooms(rooms || []);
    } catch (err) {
      console.error("Failed to load available rooms", err);
      setAvailableRooms([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, [field]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const addToArray = (field: string, value: string, setter: (v: string) => void) => {
    if (value && !formData[field]?.includes(value)) {
      setFormData({ ...formData, [field]: [...(formData[field] || []), value] });
      setter("");
    }
  };

  const removeFromArray = (field: string, value: string) => {
    setFormData({ ...formData, [field]: formData[field].filter((x: string) => x !== value) });
  };

  const updateNestedField = (path: string[], value: any) => {
    const newData = { ...formData };
    let current: any = newData;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setFormData(newData);
  };

  const renderField = (field: FormField) => {
    const value = field.name.includes(".") 
      ? field.name.split(".").reduce((obj: any, key) => obj?.[key], formData)
      : formData[field.name];

    switch (field.type) {
      case "select":
        const options = field.options || (field.name === "adminPerson" ? availableAdminPersons.map(u => ({ value: u._id, label: `${u.name} (${u.email})` })) : []);
        if (field.name === "managerId") {
          // Ensure managerId is a valid ID, not a display label
          let currentValue = formData.managerId || "";
          if (currentValue && typeof currentValue === "string" && currentValue.includes("(")) {
            // This is a display label, find the actual ID
            const manager = managers.find(m => `${m.name} (${m.email})` === currentValue);
            if (manager) {
              currentValue = manager._id;
              // Update formData to use the ID
              setFormData({ ...formData, managerId: manager._id });
            } else {
              currentValue = "";
            }
          }
          
          return (
            <select
              required={field.required}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all"
              value={currentValue}
              onChange={(e) => {
                const selectedId = e.target.value;
                setFormData({ ...formData, managerId: selectedId });
              }}
            >
              <option value="">Select Manager</option>
              {managers.map((m) => (
                <option key={m._id || m.id} value={m._id || m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          );
        }
        if (field.name === "floorId") {
          return (
            <select
              required={field.required}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all"
              value={formData.floorId || ""}
              onChange={(e) => setFormData({ ...formData, floorId: e.target.value })}
            >
              <option value="">Select Floor</option>
              {floors.map((f) => (
                <option key={f._id} value={f._id}>Level {f.floorNumber} - {f.building?.name || ""}</option>
              ))}
            </select>
          );
        }
        if (field.name === "parentApartment") {
          return (
            <select
              key={field.name}
              required={field.required}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all"
              value={formData.parentApartment || ""}
              onChange={(e) => setFormData({ ...formData, parentApartment: e.target.value || null })}
            >
              <option value="">None (Standalone Room)</option>
              {apartments.map((apt) => (
                <option key={apt._id} value={apt._id}>
                  {apt.roomNumber} - {apt.type}
                </option>
              ))}
            </select>
          );
        }
        if (field.name === "roomId" && config.type === "person") {
          return (
            <div>
              <select
                key={field.name}
                required={field.required && formData.type !== "STAFF"}
                disabled={formData.type === "STAFF"}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                value={formData.roomId || ""}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
              >
                <option value="">Select Available Room</option>
                {availableRooms.length === 0 ? (
                  <option value="" disabled>No available rooms found</option>
                ) : (
                  availableRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      Room {room.roomNumber} - {room.type} (Floor {room.floor?.floorNumber || "N/A"})
                    </option>
                  ))
                )}
              </select>
              {formData.type === "STAFF" && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Staff members do not require room assignment</p>
              )}
              {availableRooms.length === 0 && formData.type !== "STAFF" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">No available rooms. All rooms are currently occupied or unavailable.</p>
              )}
            </div>
          );
        }
        if (field.name === "type" && config.type === "room") {
          // Room type select - ONLY use allowed types from building (admin-defined)
          // No fallback to predefined types - only show what admin has configured
          const roomTypeOptions = allowedRoomTypes.map(t => ({ value: t, label: t }));
          const isApartmentType = formData.type?.toLowerCase().includes("apartment") || false;
          
          return (
            <div>
              <select
                key={field.name}
                required={field.required}
                disabled={roomTypeOptions.length === 0}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                value={formData.type || ""}
                onChange={(e) => {
                  const selectedType = e.target.value;
                  const isApartment = selectedType.toLowerCase().includes("apartment");
                  setFormData({ 
                    ...formData, 
                    type: selectedType,
                    isApartment: isApartment,
                    // If apartment, set default capacity to 1 if not set
                    capacity: isApartment && !formData.capacity ? 1 : formData.capacity
                  });
                }}
              >
                <option value="">
                  {roomTypeOptions.length === 0 
                    ? "No room types configured by admin" 
                    : "Select Room Type"}
                </option>
                {roomTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {roomTypeOptions.length === 0 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                  Please contact admin to configure allowed room types for this building.
                </p>
              )}
              {isApartmentType && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-bold">
                  💡 Apartment Type: Use "capacity" field to specify how many rooms this apartment can have
                </p>
              )}
            </div>
          );
        }
        if (field.name === "adminPerson") {
          return (
            <div className="space-y-3">
              <select
                required={field.required}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all"
                value={value || ""}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value || null })}
              >
                <option value="">{field.placeholder || "Select..."}</option>
                {options.map((opt, idx) => (
                  <option key={opt.value || `opt-${idx}`} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAdminPersonForm(!showAdminPersonForm)}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-gray-600 transition-all"
              >
                + Register New Admin Person
              </button>
              {showAdminPersonForm && (
                <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl border border-slate-200 dark:border-gray-600 space-y-3">
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    value={newAdminPerson.name}
                    onChange={(e) => setNewAdminPerson({ ...newAdminPerson, name: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    value={newAdminPerson.email}
                    onChange={(e) => setNewAdminPerson({ ...newAdminPerson, email: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    value={newAdminPerson.phone}
                    onChange={(e) => setNewAdminPerson({ ...newAdminPerson, phone: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateAdminPerson}
                      style={{ backgroundColor: SYSTEM_COLOR }}
                      className="flex-1 px-4 py-2 text-white rounded-lg font-bold text-xs hover:opacity-90"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminPersonForm(false);
                        setNewAdminPerson({ name: "", email: "", phone: "" });
                      }}
                      className="px-4 py-2 bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300 rounded-lg font-bold text-xs hover:bg-slate-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }
        return (
          <select
            required={field.required}
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all"
            value={value || ""}
            onChange={(e) => {
              if (field.name.includes(".")) {
                updateNestedField(field.name.split("."), e.target.value);
              } else {
                setFormData({ ...formData, [field.name]: e.target.value || null });
              }
            }}
          >
            <option value="">{field.placeholder || "Select..."}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case "file":
        return (
          <div className="relative group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 dark:border-gray-600 rounded-2xl bg-slate-50/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 transition-all cursor-pointer">
            {value ? (
              <img src={value} alt="Preview" className="h-full object-contain p-4" />
            ) : (
              <div className="text-center">
                <PhotoIcon className="w-8 h-8 text-slate-300 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest">Upload {field.label}</p>
              </div>
            )}
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, field.name)}
            />
          </div>
        );

      case "multiselect":
        const arrayField = field.name;
        const isRoomTypes = arrayField === "allowedRoomTypes";
        
        // Handle room types with predefined options
        if (isRoomTypes) {
          const selectedTypes = Array.isArray(formData[arrayField]) ? formData[arrayField] : [];
          
          return (
            <div className="space-y-4">
              {/* Predefined Room Types */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3 block">
                  Select from Common Types
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {predefinedRoomTypes.map((type) => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            removeFromArray(arrayField, type);
                          } else {
                            addToArray(arrayField, type, setNewRoomType);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300"
                            : "bg-white dark:bg-gray-700 border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:border-slate-300 dark:hover:border-gray-500"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Room Type Input */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                  Add Custom Room Type (Optional)
                </label>
                <div className="flex gap-3">
                  <input
                    className="flex-1 p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 text-sm dark:text-gray-200 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    placeholder="e.g. Co-working Space, Medical Suite"
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newRoomType && !selectedTypes.includes(newRoomType)) {
                          addToArray(arrayField, newRoomType, setNewRoomType);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newRoomType && !selectedTypes.includes(newRoomType)) {
                        addToArray(arrayField, newRoomType, setNewRoomType);
                      }
                    }}
                    style={{ backgroundColor: SYSTEM_COLOR }}
                    className="px-6 text-white rounded-xl font-bold hover:opacity-90 transition-all"
                  >
                    <PlusIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Selected Types Display */}
              {selectedTypes.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Selected Room Types ({selectedTypes.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTypes.map((item: string) => (
                      <div
                        key={item}
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-blue-200"
                      >
                        <span className="font-bold text-xs">{item}</span>
                        <button
                          type="button"
                          onClick={() => removeFromArray(arrayField, item)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // Regular multiselect for sections
        return (
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                className="flex-1 p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 text-sm dark:text-gray-200 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                placeholder={field.placeholder}
                value={arrayField === "sections" ? newSection : newRoomType}
                onChange={(e) => arrayField === "sections" ? setNewSection(e.target.value) : setNewRoomType(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addToArray(arrayField, arrayField === "sections" ? newSection : newRoomType, arrayField === "sections" ? setNewSection : setNewRoomType);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addToArray(arrayField, arrayField === "sections" ? newSection : newRoomType, arrayField === "sections" ? setNewSection : setNewRoomType)}
                style={{ backgroundColor: SYSTEM_COLOR }}
                className="px-6 text-white rounded-xl font-bold hover:opacity-90 transition-all"
              >
                <PlusIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(formData[arrayField] || []).map((item: string) => (
                <div key={item} className="bg-white dark:bg-gray-700 p-3 px-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-gray-600 shadow-sm group hover:border-slate-300 dark:hover:border-gray-500 transition-all">
                  <span className="font-bold text-slate-700 dark:text-gray-200 text-xs">{item}</span>
                  <TrashIcon
                    className="w-4 h-4 text-slate-300 dark:text-gray-500 cursor-pointer hover:text-red-500 dark:hover:text-red-400"
                    onClick={() => removeFromArray(arrayField, item)}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case "textarea":
        return (
          <textarea
            required={field.required}
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-sm dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all min-h-[100px] placeholder:text-slate-400 dark:placeholder:text-gray-500"
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => {
              if (field.name.includes(".")) {
                updateNestedField(field.name.split("."), e.target.value);
              } else {
                setFormData({ ...formData, [field.name]: e.target.value });
              }
            }}
          />
        );

      case "number":
        return (
          <input
            type="number"
            required={field.required}
            step={field.step}
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 text-xs dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500"
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => {
              if (field.name.includes(".")) {
                updateNestedField(field.name.split("."), e.target.value);
              } else {
                setFormData({ ...formData, [field.name]: e.target.value });
              }
            }}
          />
        );

      default:
        const isNumberField = field.name === "floorLimit" || (field.type as string) === "number";
        // Password is only required when creating (not editing)
        const isPasswordField = field.type === "password";
        const isPasswordRequired = isPasswordField ? (field.required && !initialData) : field.required;
        return (
          <input
            key={field.name}
            type={field.type}
            required={isPasswordRequired}
            step={field.step}
            className={`w-full p-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 ${isNumberField ? "text-xs" : "text-sm"} dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 outline-none focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500`}
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => {
              if (field.name.includes(".")) {
                updateNestedField(field.name.split("."), e.target.value);
              } else {
                setFormData({ ...formData, [field.name]: e.target.value });
              }
            }}
          />
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === config.steps.length) {
      const submitData = { ...formData };
      if (submitData.adminPerson === "" || submitData.adminPerson === null) submitData.adminPerson = null;
      
      // Handle managerId for buildings - backend expects managerId, not manager
      if (config.type === "building") {
        // Ensure managerId is a valid ObjectId string, not a display label
        if (submitData.managerId && typeof submitData.managerId === "string") {
          // If it looks like a display label (contains parentheses), try to extract ID from managers
          if (submitData.managerId.includes("(")) {
            const manager = managers.find(m => `${m.name} (${m.email})` === submitData.managerId);
            if (manager) {
              submitData.managerId = manager._id;
            } else {
              // If we can't find it, it's invalid - remove it
              delete submitData.managerId;
            }
          }
        } else if (submitData.manager?._id) {
          // If manager is an object, extract the ID
          submitData.managerId = submitData.manager._id;
        }
        // Remove manager object if it exists (backend only needs managerId)
        delete submitData.manager;
      }
      
      // Ensure password is only sent when creating (not editing)
      if (initialData && !submitData.password) {
        delete submitData.password;
      }
      
      // For sub-manager: password is only required when creating
      if (config.type === "subManager" && initialData && !submitData.password) {
        delete submitData.password;
      }
      
      // Ensure paymentDetails structure is correct (for buildings)
      if (config.type === "building") {
        if (submitData.paymentDetails && (!submitData.paymentDetails.amount || submitData.paymentDetails.amount === "")) {
          // Don't delete, just set to empty - backend will handle it
          submitData.paymentDetails = { amount: "", frequency: submitData.paymentDetails.frequency || "MONTHLY" };
        }
      } else if (config.type === "manager") {
        // Remove paymentDetails from manager submissions (moved to building)
        delete submitData.paymentDetails;
      }
      
      // Ensure allowedRoomTypes is an array
      if (!Array.isArray(submitData.allowedRoomTypes)) {
        submitData.allowedRoomTypes = [];
      }
      
      // Handle floor data - convert floorNumber to number
      if (config.type === "floor" && submitData.floorNumber) {
        submitData.floorNumber = parseInt(submitData.floorNumber, 10);
      }
      
      // Handle room data - ensure payment structure is correct
      if (config.type === "room") {
        if (submitData.payment && (!submitData.payment.amount || submitData.payment.amount === "")) {
          submitData.payment = { amount: 0, frequency: "MONTHLY", currency: "USD" };
        }
        // Ensure floorId is used, not floor
        if (submitData.floor) {
          submitData.floorId = submitData.floor._id || submitData.floor;
          delete submitData.floor;
        }
        // Handle apartment structure
        if (submitData.type && submitData.type.toLowerCase().includes("apartment")) {
          submitData.isApartment = true;
        }
        // Ensure parentApartment is null if empty string
        if (submitData.parentApartment === "" || submitData.parentApartment === null) {
          submitData.parentApartment = null;
        }
        // Default paymentTracking
        if (!submitData.paymentTracking) {
          submitData.paymentTracking = "ROOM_LEVEL";
        }
      }
      
      // Handle person data - convert roomId to room for backend
      if (config.type === "person") {
        if (submitData.roomId) {
          submitData.room = submitData.roomId; // Backend expects 'room'
          delete submitData.roomId;
        }
        // If type is STAFF, remove room assignment
        if (submitData.type === "STAFF") {
          delete submitData.room;
        }
      }
      
      // Handle person data - convert roomId to room for backend
      if (config.type === "person") {
        if (submitData.roomId) {
          submitData.room = submitData.roomId; // Backend expects 'room'
          delete submitData.roomId;
        }
        // If type is STAFF, remove room assignment
        if (submitData.type === "STAFF") {
          delete submitData.room;
        }
      }
      
      onSubmit(submitData);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stepper */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm mb-6 flex justify-between items-center px-8 md:px-16 border border-slate-100 dark:border-gray-700">
        {config.steps.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-4">
              <div
                style={{
                  backgroundColor: isCompleted ? SYSTEM_COLOR : isActive ? "#F1F5F9" : "transparent",
                  borderColor: isCompleted || isActive ? SYSTEM_COLOR : "#E2E8F0",
                  color: isCompleted ? "white" : isActive ? SYSTEM_COLOR : "#94A3B8"
                }}
                className="w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-300 shadow-sm dark:border-gray-600"
              >
                {isCompleted ? <CheckIcon className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <div className="hidden lg:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-400">Step 0{step.id}</p>
                <p className="text-sm font-bold dark:text-gray-300" style={{ color: isActive || isCompleted ? SYSTEM_COLOR : "#94A3B8" }}>
                  {step.name}
                </p>
              </div>
              {idx < config.steps.length - 1 && <div className="w-16 h-0.5 bg-slate-100 dark:bg-gray-700 mx-4 hidden md:block" />}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-gray-900/50 border border-slate-100 dark:border-gray-700 min-h-[550px] flex flex-col justify-between"
      >
        <div className="space-y-8">
          {config.steps.map((step) => (
            currentStep === step.id && (
              <div key={step.id} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="border-l-4 pl-4 mb-8 dark:border-blue-500" style={{ borderColor: SYSTEM_COLOR }}>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{step.name}</h3>
                  <p className="text-slate-500 dark:text-gray-400 text-sm">
                    {config.type === "manager" && step.id === 1 && "Set up manager profile and secure login"}
                    {config.type === "manager" && step.id === 2 && "Financial settings and branding"}
                    {config.type === "manager" && step.id === 3 && "Assign specific building areas"}
                    {config.type === "building" && step.id === 1 && "Property information and assignment"}
                    {config.type === "building" && step.id === 2 && "Branding and visual identity"}
                    {config.type === "building" && step.id === 3 && "Operational structure and limits"}
                    {!config.type && config.title}
                  </p>
                </div>
                {config.type === "manager" && step.id === 2 && step.fields.some(f => f.name.includes("paymentDetails")) ? (
                  <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-slate-200 dark:border-gray-600 space-y-6">
                      <div className="flex items-center gap-2 font-bold text-sm dark:text-blue-400" style={{ color: SYSTEM_COLOR }}>
                        <CurrencyDollarIcon className="w-5 h-5" /> <span>Bailee Payment Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {step.fields.filter(f => f.name.includes("paymentDetails")).map((field) => (
                          <div key={field.name} className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">
                              {field.label}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                    {step.fields.filter(f => !f.name.includes("paymentDetails")).map((field) => (
                      <div
                        key={field.name}
                        className={field.type === "file" ? "space-y-2" : "space-y-2"}
                      >
                        <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide ml-1">
                          {field.label} {field.required && "*"}
                        </label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {step.fields.map((field) => {
                      // Hide password field when editing
                      if (field.name === "password" && initialData) {
                        return null;
                      }
                      return (
                        <div
                          key={field.name}
                          className={field.type === "file" || field.type === "multiselect" || field.type === "textarea" ? "md:col-span-2 space-y-2" : "space-y-2"}
                        >
                          <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide ml-1">
                            {field.label} {field.required && "*"}
                          </label>
                          {renderField(field)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-slate-50 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors text-xs uppercase tracking-wider"
          >
            Cancel
          </button>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep(c => c - 1)}
              className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600 transition-all text-xs uppercase tracking-wider"
            >
              Back
            </button>
          )}
          <button
            type={currentStep === config.steps.length ? "submit" : "button"}
            onClick={(e) => {
              if (currentStep < config.steps.length) {
                e.preventDefault();
                e.stopPropagation();
                setCurrentStep(c => c + 1);
              }
            }}
            disabled={isSubmitting}
            style={{ backgroundColor: SYSTEM_COLOR }}
            className="px-8 py-2.5 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 text-xs uppercase tracking-wider"
          >
            {currentStep < config.steps.length ? "Continue" : isSubmitting ? "Saving..." : initialData ? (config.type === "manager" ? "Update Manager" : "Update Building") : (config.type === "manager" ? "Register Manager" : "Register Building")}
          </button>
        </div>
      </form>
    </div>
  );
}

// Predefined configs
export const managerFormConfig: FormConfig = {
  type: "manager",
  title: "Manager Registration",
  steps: [
    {
      id: 1,
      name: "Profile",
      icon: UserIcon,
      fields: [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "e.g. Rayaan" },
        { name: "email", label: "Email Address", type: "email", required: true, placeholder: "name@email.com" },
        { name: "password", label: "Password", type: "password", required: false, placeholder: "Leave empty to keep current password" },
        { name: "phone", label: "Phone Number", type: "text", placeholder: "+1 (555) 000-0000" },
        { name: "adminPerson", label: "Damiin qof ka ah qofkaa", type: "select", placeholder: "Select admin person (optional)" }
      ]
    },
    {
      id: 2,
      name: "Config",
      icon: BuildingOfficeIcon,
      fields: [
        { name: "buildingLogo", label: "Manager Image", type: "file" }
      ]
    },
    {
      id: 3,
      name: "Access",
      icon: QueueListIcon,
      fields: [
        { name: "sections", label: "Sections", type: "multiselect", placeholder: "e.g. West Wing" }
      ]
    }
  ]
};

export const buildingFormConfig: FormConfig = {
  type: "building",
  title: "Building Registration",
  steps: [
    {
      id: 1,
      name: "Property Details",
      icon: BuildingOfficeIcon,
      fields: [
        { name: "name", label: "Building Name", type: "text", required: true, placeholder: "e.g. Sky Tower" },
        { name: "location", label: "Location", type: "text", required: true, placeholder: "e.g. Downtown, City" },
        { name: "managerId", label: "Manager", type: "select", required: true, placeholder: "Select Manager" },
        { name: "approvalPolicy", label: "Approval Policy", type: "select", options: [
          { value: "MANAGER_ONLY", label: "Manager Only" },
          { value: "MANAGER_AND_SUB", label: "Manager & Sub-Manager" },
          { value: "BOTH", label: "Both (Manager & Admin - One approval needed)" }
        ] }
      ]
    },
    {
      id: 2,
      name: "Branding",
      icon: PhotoIcon,
      fields: [
        { name: "brandingName", label: "Branding Name", type: "text", placeholder: "e.g. Sky Properties" },
        { name: "brandingLogo", label: "Branding Logo", type: "file" }
      ]
    },
    {
      id: 3,
      name: "Payment Details",
      icon: CurrencyDollarIcon,
      fields: [
        { name: "paymentDetails.amount", label: "Payment Amount", type: "number", placeholder: "e.g. 5000" },
        { name: "paymentDetails.frequency", label: "Payment Frequency", type: "select", options: [
          { value: "MONTHLY", label: "Monthly" },
          { value: "QUARTERLY", label: "Quarterly" },
          { value: "YEARLY", label: "Yearly" }
        ] }
      ]
    },
    {
      id: 4,
      name: "Room Types & Structure",
      icon: QueueListIcon,
      fields: [
        { name: "floorLimit", label: "Floor Limit", type: "number", placeholder: "0" },
        { name: "allowedRoomTypes", label: "Allowed Room Types", type: "multiselect", placeholder: "Select or add custom room types" }
      ]
    }
  ]
};

// Floor Form Configuration
export const floorFormConfig: FormConfig = {
  type: "floor",
  title: "Floor Management",
  steps: [
    {
      id: 1,
      name: "Floor Details",
      icon: Squares2X2Icon,
      fields: [
        { name: "floorNumber", label: "Floor Number", type: "number", required: true, placeholder: "e.g. 1, 2, 3..." }
      ]
    }
  ]
};

// Sub-Manager Form Configuration
export const subManagerFormConfig: FormConfig = {
  type: "subManager",
  title: "Sub-Manager Management",
  steps: [
    {
      id: 1,
      name: "Profile",
      icon: UserIcon,
      fields: [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "e.g. John Doe" },
        { name: "email", label: "Email Address", type: "email", required: true, placeholder: "name@email.com" },
        { name: "password", label: "Password", type: "password", required: false, placeholder: "Leave empty to keep current password" },
        { name: "buildingLogo", label: "Profile Image (Optional)", type: "file" }
      ]
    }
  ]
};

// Person Form Configuration
export const personFormConfig: FormConfig = {
  type: "person",
  title: "People & Tenant Management",
  steps: [
    {
      id: 1,
      name: "Personal Information",
      icon: UserIcon,
      fields: [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "e.g. John Doe" },
        { name: "phone", label: "Phone Number", type: "text", required: true, placeholder: "+1 (555) 000-0000" },
        { name: "type", label: "Person Type", type: "select", required: true, options: [
          { value: "TENANT", label: "Tenant" },
          { value: "STAFF", label: "Staff (No room required)" }
        ] }
      ]
    },
    {
      id: 2,
      name: "Room Assignment",
      icon: HomeIcon,
      fields: [
        { name: "roomId", label: "Assign Room", type: "select", required: false, placeholder: "Select Available Room" }
      ]
    }
  ]
};

// Room Form Configuration
export const roomFormConfig: FormConfig = {
  type: "room",
  title: "Room Management",
  steps: [
    {
      id: 1,
      name: "Room Details",
      icon: KeyIcon,
      fields: [
        { name: "roomNumber", label: "Room Number", type: "text", required: true, placeholder: "e.g. 101, 201, A1" },
        { name: "type", label: "Room Type", type: "select", required: true, placeholder: "Select Room Type" },
        { name: "floorId", label: "Floor", type: "select", required: true, placeholder: "Select Floor" },
        { name: "capacity", label: "Capacity", type: "number", placeholder: "For apartments: number of rooms | For regular rooms: number of people" },
        { name: "status", label: "Status", type: "select", options: [
          { value: "AVAILABLE", label: "Available" },
          { value: "OCCUPIED", label: "Occupied" },
          { value: "MAINTENANCE", label: "Maintenance" },
          { value: "UNAVAILABLE", label: "Unavailable" }
        ] }
      ]
    },
    {
      id: 2,
      name: "Apartment Structure",
      icon: BuildingOfficeIcon,
      fields: [
        { name: "parentApartment", label: "Parent Apartment (if this is a room within an apartment)", type: "select", placeholder: "Select parent apartment (optional)" },
        { name: "paymentTracking", label: "Payment Tracking Method", type: "select", options: [
          { value: "ROOM_LEVEL", label: "Room Level - Each room has its own payment" },
          { value: "APARTMENT_LEVEL", label: "Apartment Level - Payment tracked at apartment level" }
        ] }
      ]
    },
    {
      id: 3,
      name: "Payment Information",
      icon: CurrencyDollarIcon,
      fields: [
        { name: "payment.amount", label: "Payment Amount", type: "number", placeholder: "0" },
        { name: "payment.frequency", label: "Payment Frequency", type: "select", options: [
          { value: "MONTHLY", label: "Monthly" },
          { value: "QUARTERLY", label: "Quarterly" },
          { value: "YEARLY", label: "Yearly" },
          { value: "ONE_TIME", label: "One Time" }
        ] },
        { name: "payment.currency", label: "Currency", type: "select", options: [
          { value: "USD", label: "USD" },
          { value: "EUR", label: "EUR" },
          { value: "GBP", label: "GBP" }
        ] }
      ]
    }
  ]
};
