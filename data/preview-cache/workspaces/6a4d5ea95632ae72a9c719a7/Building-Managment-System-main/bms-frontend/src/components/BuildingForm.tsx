import React, { useState, useEffect, useRef } from "react";
import * as api from "../api/admin.api";
import { toast } from "sonner";
import { 
  CheckIcon, PhotoIcon, BuildingOfficeIcon, 
  HomeIcon, PlusIcon, TrashIcon, MapPinIcon,
  UserCircleIcon
} from "@heroicons/react/24/outline";

export function BuildingForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [managers, setManagers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newType, setNewType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({ 
    name: "", 
    location: "", 
    managerId: "", 
    approvalPolicy: "MANAGER_ONLY",
    brandingName: "", 
    brandingLogo: "", 
    floorLimit: "", 
    allowedRoomTypes: [] as string[],
  });

  useEffect(() => { loadManagers(); }, []);

  const loadManagers = async () => {
    try {
      const res = await api.getAllManagers();
      // Ensure the response is an array before setting
      setManagers(Array.isArray(res) ? res : []);
    } catch (err) { 
      toast.error("Failed to sync managers list"); 
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, brandingLogo: reader.result as string });
      toast.success("Logo uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    // PRE-SUBMISSION VALIDATION: Check if managerId is a valid Hex string (24 chars)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(formData.managerId);
    
    if (!formData.managerId || !isValidObjectId) {
      toast.error("Invalid Manager selection. Please select a manager from the list.");
      setCurrentStep(1); // Take user back to fix the error
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createBuilding(formData);
      toast.success("Property Registered Successfully");
      onSuccess();
    } catch (e: any) {
      console.error("Submission Error:", e);
      toast.error(e.response?.data?.message || "Failed to create building");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, name: "Property Details", icon: BuildingOfficeIcon },
    { id: 2, name: "Branding", icon: PhotoIcon },
    { id: 3, name: "Operational Structure", icon: HomeIcon },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      
      {/* STEPPER HEADER */}
      <div className="bg-white rounded-[2rem] p-6 mb-6 shadow-sm border border-slate-100 flex justify-center items-center gap-12">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${
              currentStep >= step.id ? 'border-[#1E3A4C] bg-white shadow-md' : 'border-slate-100 bg-slate-50 opacity-40'
            }`}>
              <step.icon className={`w-6 h-6 ${currentStep >= step.id ? 'text-[#1E3A4C]' : 'text-slate-400'}`} />
            </div>
            <div className={`hidden sm:block ${currentStep >= step.id ? 'opacity-100' : 'opacity-30'}`}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 0{step.id}</p>
              <p className="text-sm font-black text-[#1E3A4C]">{step.name}</p>
            </div>
            {idx < steps.length - 1 && <div className="w-12 h-px bg-slate-100" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-50 flex flex-col min-h-[500px]">
        <div className="flex-1">
          
          {/* STEP 1: PROPERTY IDENTITY */}
          {currentStep === 1 && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="border-l-4 border-[#1E3A4C] pl-6">
                <h3 className="text-2xl font-black text-slate-800">Property Identity</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Core Registration & Personnel</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Building Name *</label>
                  <input 
                    className="w-full p-4 rounded-xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-slate-100 transition-all outline-none" 
                    placeholder="e.g. Skyline Towers" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Manager Assignment *</label>
                  <div className="relative">
                    <select 
                      className="w-full p-4 rounded-xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-slate-100 outline-none appearance-none cursor-pointer"
                      value={formData.managerId} 
                      onChange={e => setFormData({...formData, managerId: e.target.value})}
                    >
                      <option value="">Select Portfolio Manager</option>
                      {managers.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <UserCircleIcon className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Physical Location *</label>
                  <input 
                    className="w-full p-4 rounded-xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-slate-100 outline-none" 
                    placeholder="Full street address" 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BRANDING */}
          {currentStep === 2 && (
             <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="border-l-4 border-[#1E3A4C] pl-6">
                    <h3 className="text-2xl font-black text-slate-800">Visual Branding</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Tenant-facing appearance</p>
                </div>
                <div className="space-y-6 pt-4">
                   <input 
                     className="w-full p-4 rounded-xl bg-slate-50 border-none text-base font-bold outline-none" 
                     placeholder="Branding Display Name" 
                     value={formData.brandingName} 
                     onChange={e => setFormData({...formData, brandingName: e.target.value})} 
                   />
                   
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleLogoUpload} 
                      className="hidden" 
                      accept="image/*" 
                   />

                   <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 bg-slate-50 rounded-[1.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all overflow-hidden"
                   >
                      {formData.brandingLogo ? (
                        <img src={formData.brandingLogo} alt="Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <>
                          <PhotoIcon className="w-10 h-10 text-slate-300 mb-2" />
                          <p className="font-black text-slate-400 uppercase text-[9px] tracking-[0.2em]">Upload Property Logo</p>
                        </>
                      )}
                   </div>
                </div>
             </div>
          )}

          {/* STEP 3: OPERATIONAL STRUCTURE */}
          {currentStep === 3 && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="border-l-4 border-[#1E3A4C] pl-6">
                <h3 className="text-2xl font-black text-slate-800">Operational Structure</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Capacity & Unit categorization</p>
              </div>
              <div className="flex flex-col md:flex-row gap-8 pt-4">
                  <div className="md:w-1/3 p-6 bg-slate-50 rounded-2xl">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Floor Limit</label>
                      <input 
                        type="number" 
                        className="w-full bg-transparent text-4xl font-black outline-none" 
                        placeholder="0" 
                        value={formData.floorLimit} 
                        onChange={e => setFormData({...formData, floorLimit: e.target.value})} 
                      />
                  </div>
                  <div className="flex-1 space-y-4">
                      <div className="flex gap-2">
                        <input 
                            className="flex-1 p-4 rounded-xl bg-slate-50 border-none text-base font-bold outline-none" 
                            placeholder="Add Unit Type (e.g. Studio)" 
                            value={newType} 
                            onChange={e => setNewType(e.target.value)} 
                        />
                        <button 
                            type="button" 
                            onClick={() => { if(newType){ setFormData({...formData, allowedRoomTypes: [...formData.allowedRoomTypes, newType]}); setNewType(""); } }}
                            className="bg-[#1E3A4C] text-white px-6 rounded-xl shadow-md hover:scale-105 transition-transform"
                        >
                            <PlusIcon className="w-6 h-6 stroke-[3]" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {formData.allowedRoomTypes.map(t => (
                              <span key={t} className="bg-white border border-slate-100 px-4 py-2 rounded-lg font-bold text-slate-600 text-xs shadow-sm flex items-center gap-2">
                                  {t} 
                                  <TrashIcon 
                                    className="w-3.5 h-3.5 text-red-300 cursor-pointer" 
                                    onClick={() => setFormData({...formData, allowedRoomTypes: formData.allowedRoomTypes.filter(x => x !== t)})} 
                                  />
                              </span>
                          ))}
                      </div>
                  </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="mt-12 pt-8 border-t border-slate-50 flex justify-between items-center">
          <button 
            type="button" 
            onClick={onCancel} 
            className="text-slate-400 font-black uppercase text-[9px] tracking-widest hover:text-red-500 transition-colors"
          >
            Discard
          </button>
          
          <div className="flex gap-4">
            {currentStep > 1 && (
              <button 
                type="button" 
                onClick={() => setCurrentStep(c => c - 1)} 
                className="px-8 py-3 rounded-xl font-black text-slate-500 bg-slate-50 uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all"
              >
                Previous
              </button>
            )}

            <button 
              type="button"
              disabled={isSubmitting}
              onClick={currentStep === 3 ? handleRegister : () => setCurrentStep(c => c + 1)}
              className="px-10 py-3 bg-[#1E3A4C] text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              {currentStep < 3 ? "Continue" : isSubmitting ? "Processing..." : "Register Building"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}