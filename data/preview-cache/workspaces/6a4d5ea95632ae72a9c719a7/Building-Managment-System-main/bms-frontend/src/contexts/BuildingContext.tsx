import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Building {
  _id?: string;
  id?: string;
  name: string;
  logo?: string;
  [key: string]: any;
}

interface BuildingInfo {
  name: string;
  logo?: string;
  [key: string]: any;
}

interface BuildingContextType {
  selectedBuildingId: string | null;
  setSelectedBuildingId: (id: string | null) => void;
  buildings: Building[];
  setBuildings: (buildings: Building[]) => void;
  buildingInfo: BuildingInfo | null;
  setBuildingInfo: (info: BuildingInfo | null) => void;
}

const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [selectedBuildingId, setSelectedBuildingIdState] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem("selectedBuildingId");
  });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingInfo, setBuildingInfo] = useState<BuildingInfo | null>(null);

  // Sync selectedBuildingId to localStorage
  const setSelectedBuildingId = (id: string | null) => {
    setSelectedBuildingIdState(id);
    if (id) {
      localStorage.setItem("selectedBuildingId", id);
    } else {
      localStorage.removeItem("selectedBuildingId");
    }
  };

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedBuildingId") {
        setSelectedBuildingIdState(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Listen for buildingChanged events
  useEffect(() => {
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId;
      if (buildingId) {
        setSelectedBuildingIdState(buildingId);
      }
    };

    window.addEventListener("buildingChanged", handleBuildingChange);
    return () => window.removeEventListener("buildingChanged", handleBuildingChange);
  }, []);

  return (
    <BuildingContext.Provider
      value={{
        selectedBuildingId,
        setSelectedBuildingId,
        buildings,
        setBuildings,
        buildingInfo,
        setBuildingInfo
      }}
    >
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuilding(): BuildingContextType {
  const context = useContext(BuildingContext);
  if (context === undefined) {
    throw new Error("useBuilding must be used within a BuildingProvider");
  }
  return context;
}
