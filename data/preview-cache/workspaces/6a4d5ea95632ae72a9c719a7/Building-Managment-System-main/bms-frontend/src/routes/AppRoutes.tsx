import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBasedRedirect } from "@/components/RoleBasedRedirect";

import {Login} from "@/pages/Login";
import {Dashboard} from "@/pages/Admin/Dashboard";
// import {Buildings} from "@/pages/Buildings";

import {Users} from "@/pages/Users";
import {Maintenance} from "@/pages/Admin/Maintenance";
import { ManageBuildings } from "@/pages/Admin/BMP";
import { ManageManagers } from "@/pages/Admin/MMP";
import { BuildingsDirectory } from "@/pages/Admin/BuildingsDirectory";
import { ManageTeam } from "@/pages/Manager/sub-managers";
import { ManageFloors } from "@/pages/Manager/Floors";
import { ManageRooms } from "@/pages/Manager/Rooms";
import { ManagePeople } from "@/pages/Manager/peaple";
import { ReportsPage } from "@/pages/Manager/Reports";
import { ManagerDashboard } from "@/pages/Manager/ManagerDashboard";
import { ManageApartments } from "@/pages/Manager/Apartments";
import { ProfilePage } from "@/pages/Manager/Profile";
import { AdminReports } from "@/pages/Admin/AdminReports";
import { SubManagePeople } from "@/pages/sub-manager/SubManagePeople";
import { SubManageFloors } from "@/pages/sub-manager/SubFloorManager";
import { SubManageRooms } from "@/pages/sub-manager/SubManageRooms";
import { BuildingOverview } from "@/pages/Admin/BuildingOverview";
import { Payments } from "@/pages/Admin/Payments";
import { ApprovalsPage } from "@/pages/Manager/ApprovalsPage";
import { ManagerPaymentTracking } from "@/pages/Manager/PaymentTracking";
import { BuildingApprovals } from "@/pages/Admin/BuildingApprovals";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleBasedRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


         <Route
        path="/create-building"
        element={
          <ProtectedRoute>
            <ManageBuildings/>
          </ProtectedRoute>
        }
      />


         <Route
        path="/create-manager"
        element={
          <ProtectedRoute>
            <ManageManagers />
          </ProtectedRoute>
        }
      />


     <Route
        path="/build-overview"
        element={
          <ProtectedRoute>
            <BuildingOverview />
          </ProtectedRoute>
        }
      />

      <Route
        path="/building-overview"
        element={
          <ProtectedRoute>
            <BuildingOverview />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        }
      />

       <Route
        path="/team"
        element={
          <ProtectedRoute>
            <ManageTeam />
          </ProtectedRoute>
        }
      />


          <Route
        path="/manage-floors"
        element={
          <ProtectedRoute>
            <ManageFloors />
          </ProtectedRoute>
        }
      />



          <Route
        path="/manage-rooms"
        element={
          <ProtectedRoute>
            <ManageRooms />
          </ProtectedRoute>
        }
      />

          <Route
        path="/manage-apartments"
        element={
          <ProtectedRoute>
            <ManageApartments />
          </ProtectedRoute>
        }
      />


          <Route
        path="/manage-people"
        element={
          <ProtectedRoute>
            <ManagePeople />
          </ProtectedRoute>
        }
      />


         <Route
        path="/report"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />



         <Route
        path="/manDash"
        element={
          <ProtectedRoute>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />


           <Route
        path="/adminReport"
        element={
          <ProtectedRoute>
            <AdminReports />
          </ProtectedRoute>
        }
      />


          <Route
        path="/subP"
        element={
          <ProtectedRoute>
            <SubManagePeople />
          </ProtectedRoute>
        }
      />


          <Route
        path="/subF"
        element={
          <ProtectedRoute>
            <SubManageFloors />
          </ProtectedRoute>
        }
      />

          <Route
        path="/subR"
        element={
          <ProtectedRoute>
            <SubManageRooms />
          </ProtectedRoute>
        }
      />
      {/* <Route path="/buildings" element={<ProtectedRoute><Buildings /></ProtectedRoute>} /> */}
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/manager-payments" element={<ProtectedRoute><ManagerPaymentTracking /></ProtectedRoute>} />
      <Route path="/building-approvals" element={<ProtectedRoute><BuildingApprovals /></ProtectedRoute>} />
    </Routes>
  );
}
