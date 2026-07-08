import React, { useState, useEffect } from "react";
import { 
  CheckIcon, UserIcon, BuildingOfficeIcon, CurrencyDollarIcon, 
  QueueListIcon, PhotoIcon, PlusIcon, TrashIcon 
} from "@heroicons/react/24/outline";
import * as api from "../api/admin.api";

interface ManagerFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ManagerForm({ initialData, onSubmit, onCancel, isSubmitting }: ManagerFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [newSection, setNewSection] = useState("");
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        adminPerson: initialData.adminPerson?._id || initialData.adminPerson || null
      };
    }
    return {
      name: "",
      email: "",
      password: "",
      phone: "",
      paymentDetails: { amount: "", frequency: "MONTHLY" },
      sections: [] as string[],
      buildingLogo: "",
      role: "MANAGER",
      adminPerson: null
    };
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await api.getUsersForAdminPerson();
        setAvailableUsers(users || []);
      } catch (err) {
        console.error("Failed to load users for admin person", err);
      }
    };
    fetchUsers();
  }, []);

  const SYSTEM_COLOR = "#1E3A4C";

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData({ ...formData, buildingLogo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const addSection = () => {
    if (newSection && !formData.sections.includes(newSection)) {
      setFormData({ ...formData, sections: [...formData.sections, newSection] });
      setNewSection("");
    }
  };

  const steps = [
    { id: 1, name: "Profile", icon: UserIcon },
    { id: 2, name: "Config", icon: BuildingOfficeIcon },
    { id: 3, name: "Access", icon: QueueListIcon },
  ];

  return (
    /* Constrained max-width to 4xl for a centered, compact look */
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Standard Stepper */}
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 flex justify-between items-center px-8 md:px-16 border border-slate-100">
        {steps.map((step, idx) => {
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
                className="w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-300 shadow-sm"
              >
                {isCompleted ? <CheckIcon className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <div className="hidden lg:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Step 0{step.id}</p>
                <p className="text-sm font-bold" style={{ color: isActive || isCompleted ? SYSTEM_COLOR : "#94A3B8" }}>
                  {step.name}
                </p>
              </div>
              {idx < steps.length - 1 && <div className="w-16 h-0.5 bg-slate-100 mx-4 hidden md:block" />}
            </div>
          );
        })}
      </div>

      <form 
        onSubmit={(e) => { 
          e.preventDefault(); 
          if(currentStep === 3) {
            const submitData = {
              ...formData,
              adminPerson: formData.adminPerson || null
            };
            onSubmit(submitData);
          }
        }} 
        className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[550px] flex flex-col justify-between"
      >
        <div className="space-y-8">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-l-4 pl-4 mb-8" style={{ borderColor: SYSTEM_COLOR }}>
                <h3 className="text-xl font-bold text-slate-800">Personal Information</h3>
                <p className="text-slate-500 text-sm">Set up manager profile and secure login</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Full Name *</label>
                  <input required className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white outline-none focus:ring-4 focus:ring-slate-500/10 transition-all" 
                    value={formData.name} onChange={(e)=>setFormData({...formData, name:e.target.value})} placeholder="e.g. Rayaan" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Email Address *</label>
                  <input type="email" required className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white outline-none focus:ring-4 focus:ring-slate-500/10 transition-all" 
                    value={formData.email} onChange={(e)=>setFormData({...formData, email:e.target.value})} placeholder="name@email.com" />
                </div>
                {!initialData && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Password *</label>
                    <input type="password" required className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white outline-none focus:ring-4 focus:ring-slate-500/10 transition-all" 
                      value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} placeholder="••••••••" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Phone Number</label>
                  <input className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white outline-none focus:ring-4 focus:ring-slate-500/10 transition-all" 
                    value={formData.phone} onChange={(e)=>setFormData({...formData, phone:e.target.value})} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Damiin qof ka ah qofkaa</label>
                  <select className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white outline-none focus:ring-4 focus:ring-slate-500/10 transition-all" 
                    value={formData.adminPerson || ""} onChange={(e)=>setFormData({...formData, adminPerson: e.target.value || null})}>
                    <option value="">Select admin person (optional)</option>
                    {availableUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-l-4 pl-4 mb-8" style={{ borderColor: SYSTEM_COLOR }}>
                <h3 className="text-xl font-bold text-slate-800">System Configuration</h3>
                <p className="text-slate-500 text-sm">Financial settings and branding</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: SYSTEM_COLOR }}>
                  <CurrencyDollarIcon className="w-5 h-5" /> <span>Bailee Payment Details</span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Amount</label>
                    <input type="number" className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-slate-500/10" 
                      value={formData.paymentDetails.amount} onChange={(e)=>setFormData({...formData, paymentDetails: {...formData.paymentDetails, amount: e.target.value}})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
                    <select className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-slate-500/10" 
                      value={formData.paymentDetails.frequency} onChange={(e)=>setFormData({...formData, paymentDetails: {...formData.paymentDetails, frequency: e.target.value}})}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase ml-1">Building Logo</label>
                <div className="relative group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white transition-all cursor-pointer">
                  {formData.buildingLogo ? (
                    <img src={formData.buildingLogo} alt="Preview" className="h-full object-contain p-4" />
                  ) : (
                    <div className="text-center">
                      <PhotoIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Logo</p>
                    </div>
                  )}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-l-4 pl-4 mb-8" style={{ borderColor: SYSTEM_COLOR }}>
                <h3 className="text-xl font-bold text-slate-800">Permissions & Sections</h3>
                <p className="text-slate-500 text-sm">Assign specific building areas</p>
              </div>
              <div className="flex gap-3">
                <input className="flex-1 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-4 focus:ring-slate-500/10" 
                  placeholder="e.g. West Wing" value={newSection} onChange={(e)=>setNewSection(e.target.value)} />
                <button type="button" onClick={addSection} style={{ backgroundColor: SYSTEM_COLOR }}
                  className="px-6 text-white rounded-xl font-bold hover:opacity-90 transition-all">
                  <PlusIcon className="w-6 h-6"/>
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4">
                {formData.sections.map(s => (
                  <div key={s} className="bg-white p-3 px-4 rounded-xl flex items-center justify-between border border-slate-100 shadow-sm group hover:border-slate-300 transition-all">
                    <span className="font-bold text-slate-700 text-xs">{s}</span>
                    <TrashIcon className="w-4 h-4 text-slate-300 cursor-pointer hover:text-red-500" 
                      onClick={() => setFormData({...formData, sections: formData.sections.filter(x => x !== s)})} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COMPACT ACTIONS */}
        <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-slate-50">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase tracking-wider">
            Cancel
          </button>
          {currentStep > 1 && (
            <button type="button" onClick={() => setCurrentStep(c => c - 1)} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-xs uppercase tracking-wider">
              Back
            </button>
          )}
          <button type={currentStep === 3 ? "submit" : "button"} onClick={() => currentStep < 3 && setCurrentStep(c => c + 1)} disabled={isSubmitting}
            style={{ backgroundColor: SYSTEM_COLOR }} className="px-8 py-2.5 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 text-xs uppercase tracking-wider">
            {currentStep < 3 ? "Continue" : isSubmitting ? "Saving..." : "Register Manager"}
          </button>
        </div>
      </form>
    </div>
  );
}