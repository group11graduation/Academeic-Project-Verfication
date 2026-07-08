import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  BuildingOfficeIcon, 
  MapPinIcon, 
  UserIcon, 
  IdentificationIcon,
  MagnifyingGlassIcon 
} from "@heroicons/react/24/outline";

export function BuildingsDirectory() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getAllBuildings();
        setBuildings(data);
      } catch (err) {
        toast.error("Failed to load building directory");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Search logic for both building name and manager name
  const filteredData = buildings.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.manager?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F0F5F9]">
      <Sidebar />
      
      <main className="flex-1 p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1E3A4C]">Building Assets</h1>
            <p className="text-sm text-gray-500">Comprehensive list of properties and assigned managers</p>
          </div>

          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search by building or manager..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1E3A4C] text-white/70 text-[11px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-8 py-5">Building Property</th>
                <th className="px-8 py-5">Global Location</th>
                <th className="px-8 py-4">Responsible Manager</th>
                <th className="px-8 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center text-gray-400 animate-pulse font-medium">Loading asset data...</td></tr>
              ) : filteredData.map((b) => (
                <tr key={b._id} className="hover:bg-blue-50/40 transition-all duration-200 group">
                  {/* Building Column */}
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <BuildingOfficeIcon className="h-6 w-6 text-[#1E3A4C]" />
                      </div>
                      <div>
                        <div className="font-black text-[#1E3A4C] text-md leading-none">{b.name}</div>
                        <div className="flex items-center gap-1 mt-2">
                           <IdentificationIcon className="h-3 w-3 text-gray-400" />
                           <span className="text-[10px] text-gray-400 font-mono tracking-tighter">REF-{b._id ? b._id.slice(-6).toUpperCase() : "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Location Column */}
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPinIcon className="h-4 w-4 text-orange-400 shrink-0" />
                      <span className="text-sm font-medium">{b.location}</span>
                    </div>
                  </td>

                  {/* Manager Column */}
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-gray-100 w-fit pr-4">
                      <div className="h-10 w-10 rounded-lg bg-[#1E3A4C] flex items-center justify-center text-white font-bold shadow-inner">
                        {b.manager?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-800 uppercase tracking-tight">
                          {b.manager?.name || "Vacant Position"}
                        </div>
                        <div className="text-[10px] text-blue-500 font-semibold italic">
                          {b.manager?.email || "No email assigned"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status Tag */}
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      b.manager ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {b.manager ? '● Managed' : '○ Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filteredData.length === 0 && (
            <div className="py-24 text-center">
              <div className="text-gray-300 text-5xl mb-4">📭</div>
              <h3 className="text-lg font-bold text-[#1E3A4C]">No matches found</h3>
              <p className="text-gray-400 text-sm">Try adjusting your search filters</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}