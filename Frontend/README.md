# ProjectVerify — Frontend Documentation

> **A comprehensive React frontend for an Academic Project Verification & Management System.**
> This document explains every folder, file, service, API connection, and data contract used by this frontend so that another developer can connect it to their own backend.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Getting Started](#getting-started)
3. [Environment & Configuration](#environment--configuration)
4. [Project File Structure](#project-file-structure)
5. [Application Architecture Overview](#application-architecture-overview)
6. [Entry Point & Bootstrapping](#entry-point--bootstrapping)
7. [Routing System](#routing-system)
8. [Authentication System](#authentication-system)
9. [Service Layer — API Connections](#service-layer--api-connections)
10. [Feature Modules](#feature-modules)
11. [Shared Components & Layouts](#shared-components--layouts)
12. [Data Models & Expected Shapes](#data-models--expected-shapes)
13. [File Upload Conventions](#file-upload-conventions)
14. [How to Connect Your Own Backend](#how-to-connect-your-own-backend)
15. [Common Patterns & Conventions](#common-patterns--conventions)

---

## Tech Stack

| Technology         | Version   | Purpose                            |
| ------------------ | --------- | ---------------------------------- |
| React              | 19.x      | UI library (functional components) |
| Vite               | 7.x       | Dev server & bundler               |
| React Router DOM   | 7.x       | Client-side routing                |
| Axios              | 1.x       | HTTP client for all API calls      |
| TailwindCSS        | 4.x       | Utility-first CSS framework        |
| Lucide React       | 0.576+    | Icon library                       |
| TypeScript         | 5.x       | Type checking (optional, partial)  |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# → Opens at http://localhost:5173

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

> **Important:** The frontend expects the backend API to be running at `http://localhost:5000`. See [Environment & Configuration](#environment--configuration) to change this.

---

## Environment & Configuration

### API Base URL

The backend URL is **hardcoded** in each service file as:

```
http://localhost:5000
```

There is **no `.env` file** currently. If you want to connect to a different backend, you must update the `API_URL` constant at the top of every service file in `src/services/`. Here is the complete list:

| Service File               | Current API_URL                                    |
| -------------------------- | -------------------------------------------------- |
| `studentService.js`        | `http://localhost:5000/api/student`                 |
| `teacherService.js`        | `http://localhost:5000/api/teacher/`                |
| `adminDashboardService.js` | `http://localhost:5000/api/admin/dashboard/`        |
| `adminClassService.js`     | `http://localhost:5000/api/admin/classes/`           |
| `adminStudentService.js`   | `http://localhost:5000/api/admin/students`           |
| `adminTeacherService.js`   | `http://localhost:5000/api/admin/teachers`           |
| `adminAdminService.js`     | `http://localhost:5000/api/admin/admins`             |
| `adminSubjectService.js`   | `http://localhost:5000/api/admin/subjects/`          |
| `adminUserService.js`      | `http://localhost:5000/api/auth/users`               |
| `authContext.jsx`          | `http://localhost:5000/api/auth/login` & `/api/auth/me` |

Additionally, some page components make direct `axios` calls to `http://localhost:5000` (e.g., file uploads, project submission). Search the codebase for `localhost:5000` to find all occurrences.

### Vite Configuration (`vite.config.js`)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),       // React with SWC compiler
    tailwindcss(), // TailwindCSS v4 Vite plugin
  ],
})
```

---

## Project File Structure

```
Frontend/
├── index.html                          # HTML entry point
├── package.json                        # Dependencies & scripts
├── vite.config.js                      # Vite configuration
├── tsconfig.json                       # TypeScript config (optional)
│
├── public/                             # Static assets
│
└── src/
    ├── main.jsx                        # React DOM render entry
    ├── App.jsx                         # Root component (AuthProvider + Router)
    ├── style.css                       # Legacy styles
    │
    ├── app/                            # Application shell
    │   ├── providers/                  # (empty — reserved for future providers)
    │   └── routes/                     # All route definitions
    │       ├── AppRoutes.jsx           # Master route tree
    │       ├── AdminRoutes.jsx         # /admin/* routes
    │       ├── TeacherRoutes.jsx       # /teacher/* routes
    │       └── StudentRoutes.jsx       # /student/* routes
    │
    ├── context/                        # React Contexts
    │   └── authContext.jsx             # Authentication state & API
    │
    ├── services/                       # API service layer (ALL backend calls)
    │   ├── studentService.js           # Student API calls
    │   ├── teacherService.js           # Teacher API calls
    │   ├── adminDashboardService.js    # Admin dashboard stats
    │   ├── adminClassService.js        # Admin class CRUD
    │   ├── adminStudentService.js      # Admin student CRUD
    │   ├── adminTeacherService.js      # Admin teacher CRUD
    │   ├── adminAdminService.js        # Admin administrator CRUD
    │   ├── adminSubjectService.js      # Admin subject CRUD
    │   └── adminUserService.js         # User role queries
    │
    ├── shared/                         # Shared across all features
    │   ├── components/                 # Shared UI components
    │   ├── constants/                  # App-wide constants
    │   ├── hooks/                      # Custom React hooks
    │   ├── layouts/                    # Layout wrappers
    │   │   └── DashboardLayout.jsx     # Teacher/Admin dashboard shell (sidebar + nav)
    │   └── utils/                      # Utility functions
    │
    ├── styles/
    │   └── global.css                  # Global CSS + TailwindCSS imports
    │
    └── features/                       # Feature-based modules
        ├── Auth/                       # Authentication feature
        │   ├── components/
        │   ├── pages/
        │   │   └── LoginPage.jsx       # Login form
        │   └── services/
        │
        ├── admin/                      # Admin panel feature
        │   ├── components/
        │   ├── layouts/
        │   │   └── AdminLayout.jsx     # Admin sidebar + content layout
        │   ├── pages/
        │   │   ├── AdminDashboard.jsx      # /admin
        │   │   ├── AdminAdmins.jsx         # /admin/admins
        │   │   ├── AdminTeachers.jsx       # /admin/teachers
        │   │   ├── AdminAddTeacher.jsx     # /admin/teachers/new
        │   │   ├── AdminEditTeacher.jsx    # /admin/teachers/:id/edit
        │   │   ├── AdminTeacherProfile.jsx # /admin/teachers/:id
        │   │   ├── AdminStudents.jsx       # /admin/students
        │   │   ├── AdminAddStudent.jsx     # /admin/students/new
        │   │   ├── AdminStudentDetail.jsx  # /admin/students/:id
        │   │   ├── AdminClasses.jsx        # /admin/classes
        │   │   ├── AdminAddClass.jsx       # /admin/classes/new
        │   │   ├── AdminClassDetail.jsx    # /admin/classes/:id
        │   │   └── AdminSubjects.jsx       # /admin/subjects
        │   └── services/
        │
        ├── teacher/                    # Teacher panel feature
        │   ├── components/
        │   │   └── ClassCard.jsx           # Reusable class card component
        │   ├── pages/
        │   │   ├── TeacherDashboard.jsx    # /teacher
        │   │   ├── ManageClasses.jsx       # /teacher/classes
        │   │   ├── ClassDetail.jsx         # /teacher/classes/:id
        │   │   ├── StudentList.jsx         # /teacher/classes/:id/students
        │   │   ├── GroupConfiguration.jsx  # /teacher/classes/:id/groups
        │   │   ├── GroupManagement.jsx     # /teacher/classes/:id/groups/manage
        │   │   ├── ProjectsOverview.jsx    # /teacher/group-management
        │   │   ├── GroupDetailPage.jsx     # /teacher/groups/:id
        │   │   ├── Assignments.jsx         # /teacher/assignments
        │   │   └── AssignmentDetail.jsx    # /teacher/assignments/:id
        │   └── services/
        │
        └── student/                    # Student portal feature
            ├── components/
            │   └── StudentHeader.jsx       # Shared student navigation header
            ├── layouts/
            │   └── StudentLayout.jsx       # (reserved student layout wrapper)
            ├── pages/
            │   ├── LandingPage.jsx             # / (public home page)
            │   ├── StudentAbout.jsx            # /about
            │   ├── StudentGallery.jsx          # /gallery
            │   ├── StudentProjectDetail.jsx    # /gallery/:id
            │   ├── StudentMyProject.jsx        # /student (my projects dashboard)
            │   ├── StudentMyProjectDetail.jsx  # /student/project/:id
            │   ├── StudentAssignments.jsx      # /assignments
            │   ├── StudentAssignmentDetail.jsx # /assignments/:id
            │   └── StudentProfile.jsx          # /student/profile
            ├── routes/
            │   └── StudentRoutes.jsx           # (duplicate — used internally)
            └── services/
```

---

## Application Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      main.jsx                            │
│            (React DOM root render)                       │
│                       │                                  │
│                    App.jsx                               │
│             ┌────────┴────────┐                          │
│        AuthProvider      BrowserRouter                   │
│         (Context)         (Router)                       │
│             │                 │                          │
│         useAuth()       AppRoutes.jsx                    │
│                              │                           │
│         ┌────────────────────┼────────────────┐          │
│    Public Routes      Protected Routes   Protected       │
│    (/,/about,        (/admin/*,          (/student/*)    │
│     /gallery,         /teacher/*)                        │
│     /assignments)                                        │
│                              │                           │
│                      DashboardLayout                     │
│                     (Sidebar + Content)                   │
│                              │                           │
│                       Feature Pages                      │
│                              │                           │
│                    Service Layer (axios)                  │
│                              │                           │
│                   Backend API (port 5000)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Entry Point & Bootstrapping

### `main.jsx` — The Root

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'        // <-- TailwindCSS is loaded here

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
```

### `App.jsx` — The Shell

```jsx
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './app/routes/AppRoutes';
import { AuthProvider } from './context/authContext';

function App() {
    return (
        <AuthProvider>    {/* ← Wraps everything with auth state */}
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}
```

**Key points:**
- `AuthProvider` wraps the entire app, so every component can call `useAuth()` to get the current user, token, login/logout functions.
- `BrowserRouter` provides client-side routing.

---

## Routing System

### `AppRoutes.jsx` — Master Route Tree

This file defines every route in the application. Here is the full route map:

#### Public Routes (no auth required)

| Path               | Component                | Description                       |
| ------------------ | ------------------------ | --------------------------------- |
| `/`                | `LandingPage`            | Public home page                  |
| `/about`           | `StudentAbout`           | About page                        |
| `/gallery`         | `StudentGallery`         | Project gallery (public browse)   |
| `/gallery/:id`     | `StudentProjectDetail`   | Single project detail in gallery  |
| `/assignments`     | `StudentAssignments`     | Student assignments list          |
| `/assignments/:id` | `StudentAssignmentDetail`| Single assignment detail          |
| `/login`           | `LoginPage`              | Login form (redirects if already logged in) |

#### Protected: Student Routes (`/student/*`)

Requires `user.role === 'student'`. Defined in `StudentRoutes.jsx`:

| Path                    | Component               | Description                     |
| ----------------------- | ----------------------- | ------------------------------- |
| `/student`              | `StudentMyProject`      | Student's project dashboard     |
| `/student/profile`      | `StudentProfile`        | Student profile page            |
| `/student/project`      | `StudentMyProjectDetail`| Project detail (no ID)          |
| `/student/project/:id`  | `StudentMyProjectDetail`| Project detail with submission  |

#### Protected: Admin Routes (`/admin/*`)

Requires `user.role === 'admin'` (or `user.roles` includes `'admin'`). Wrapped in `AdminLayout`. Defined in `AdminRoutes.jsx`:

| Path                          | Component            | Description                  |
| ----------------------------- | -------------------- | ---------------------------- |
| `/admin`                      | `AdminDashboard`     | Dashboard with stats         |
| `/admin/admins`               | `AdminAdmins`        | Manage admin accounts        |
| `/admin/teachers`             | `AdminTeachers`      | List all teachers            |
| `/admin/teachers/new`         | `AdminAddTeacher`    | Create new teacher           |
| `/admin/teachers/:id`         | `AdminTeacherProfile`| View teacher profile         |
| `/admin/teachers/:id/edit`    | `AdminEditTeacher`   | Edit teacher                 |
| `/admin/students`             | `AdminStudents`      | List all students            |
| `/admin/students/new`         | `AdminAddStudent`    | Register new student         |
| `/admin/students/:id`         | `AdminStudentDetail` | View student detail          |
| `/admin/classes`              | `AdminClasses`       | List all classes             |
| `/admin/classes/new`          | `AdminAddClass`      | Create new class             |
| `/admin/classes/:id`          | `AdminClassDetail`   | View class detail            |
| `/admin/subjects`             | `AdminSubjects`      | Manage subjects              |

#### Protected: Teacher Routes (`/teacher/*`)

Requires `user.role === 'teacher'`. Wrapped in `DashboardLayout` (sidebar navigation). Defined in `TeacherRoutes.jsx`:

| Path                                  | Component            | Description                      |
| ------------------------------------- | -------------------- | -------------------------------- |
| `/teacher`                            | `TeacherDashboard`   | Dashboard with stats             |
| `/teacher/classes`                    | `ManageClasses`      | List assigned classes            |
| `/teacher/classes/:id`                | `ClassDetail`        | View class detail                |
| `/teacher/classes/:id/students`       | `StudentList`        | Students in a class              |
| `/teacher/classes/:id/groups`         | `GroupConfiguration` | Configure groups                 |
| `/teacher/classes/:id/groups/manage`  | `GroupManagement`    | Manage existing groups           |
| `/teacher/group-management`           | `ProjectsOverview`   | All student projects overview    |
| `/teacher/groups/:id`                 | `GroupDetailPage`     | Single group detail + documents  |
| `/teacher/assignments`                | `Assignments`        | All assignments                  |
| `/teacher/assignments/:id`            | `AssignmentDetail`   | Single assignment detail         |

### Route Protection Logic

```jsx
// From AppRoutes.jsx — how routes are protected:

// Admin: checks user.roles array OR user.role
<Route path="/admin/*" 
  element={(user?.roles || (user?.role ? [user.role] : [])).includes('admin') 
    ? <AdminRoutes /> 
    : <Navigate to="/" replace />} 
/>

// Teacher: same pattern
<Route path="/teacher/*"
  element={(user?.roles || (user?.role ? [user.role] : [])).includes('teacher')
    ? <DashboardLayout><TeacherRoutes /></DashboardLayout>
    : <Navigate to="/" replace />}
/>

// Student: simple role check
<Route path="/student/*"
  element={user?.role === 'student' 
    ? <StudentRoutes /> 
    : <Navigate to="/" replace />}
/>
```

---

## Authentication System

### File: `src/context/authContext.jsx`

The auth system uses React Context + `localStorage` for JWT persistence.

### How It Works

1. **On App Load:**
   - Reads token from `localStorage.getItem('token')`
   - Calls `GET /api/auth/me` with the token to verify it
   - If valid → sets `user` state with the response
   - If 401 → clears token, user becomes `null`

2. **On Login:**
   - Sends `POST /api/auth/login` with `{ identifier, passcode }`
   - Receives `{ success, token, user }` from backend
   - Stores token in `localStorage`
   - Sets user state

3. **On Logout:**
   - Removes token from `localStorage`
   - Clears user state
   - Removes `Authorization` header from axios defaults

### Auth API Contract

#### `POST /api/auth/login`

**Request Body:**
```json
{
    "identifier": "teacher@gmail.com",
    "passcode": "123456"
}
```

> **Note:** The field names are `identifier` and `passcode`, NOT `email` and `password`.

**Success Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "_id": "60f7c...",
        "name": "Mohamed Dahir",
        "email": "teacher@gmail.com",
        "role": "teacher",
        "roles": ["teacher"],
        "photo": "default-teacher.jpg"
    }
}
```

**Error Response:**
```json
{
    "success": false,
    "message": "Invalid credentials"
}
```

#### `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Success Response:**
```json
{
    "success": true,
    "data": {
        "_id": "60f7c...",
        "name": "Mohamed Dahir",
        "email": "teacher@gmail.com",
        "role": "teacher",
        "roles": ["teacher"]
    }
}
```

### The `useAuth()` Hook

Every component can call this hook to access:

```jsx
const { user, token, loading, login, logout } = useAuth();
```

| Property  | Type       | Description                               |
| --------- | ---------- | ----------------------------------------- |
| `user`    | `Object|null` | Current logged-in user object          |
| `token`   | `String|null` | JWT token string                       |
| `loading` | `Boolean`  | `true` while checking auth on app load    |
| `login`   | `Function` | `login(identifier, passcode)` → `Promise` |
| `logout`  | `Function` | Clears everything, redirects to `/`       |

### User Object Shape

```json
{
    "_id": "ObjectId string",
    "name": "Full Name",
    "email": "user@gmail.com",
    "role": "student | teacher | admin",
    "roles": ["teacher", "admin"],
    "photo": "filename.jpg or URL"
}
```

> **Important:** Some users have a `roles` array (e.g., a teacher who is also an admin). The routing logic checks both `user.role` AND `user.roles`.

---

## Service Layer — API Connections

Every backend API call goes through a service file in `src/services/`. All services follow the same pattern:

```js
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/...';

// Helper to attach JWT token
const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const someFunction = async () => {
    const response = await axios.get(API_URL + '/endpoint', getAuthHeaders());
    return response.data;
};
```

### All responses from the backend follow this shape:

```json
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}
```

Or on error:

```json
{
    "success": false,
    "message": "Error description"
}
```

---

### 1. `studentService.js`

**Base URL:** `http://localhost:5000/api/student`

| Method | Function              | Endpoint               | Auth | Description                   |
| ------ | --------------------- | ---------------------- | ---- | ----------------------------- |
| GET    | `getDashboard()`      | `/dashboard`           | ✅   | Student dashboard data        |
| GET    | `getProjectDetails(id)` | `/projects/:id`      | ✅   | Single project detail         |

**Dashboard Response Shape:**
```json
{
    "success": true,
    "data": {
        "student": {
            "_id": "...",
            "name": "Amin Rage",
            "studentId": "IT221-001",
            "classId": "IT221",
            "userId": "..."
        },
        "class": {
            "_id": "...",
            "code": "IT221",
            "title": "Information Technology",
            "semester": "Semester 1"
        },
        "groups": [
            {
                "_id": "...",
                "classCode": "IT221",
                "assignmentNumber": 1,
                "type": "group",
                "title": "New Group Project",
                "status": "DRAFT",
                "similarity": 0,
                "similarityLevel": "Low",
                "documentUrl": null,
                "originalFileName": null,
                "members": [
                    {
                        "_id": "...",
                        "name": "Amin Rage",
                        "photo": "default-student.jpg",
                        "studentId": "IT221-001"
                    }
                ]
            }
        ]
    }
}
```

#### Direct Axios Calls (not in service file)

Some student pages make direct `axios` calls:

**Submit Project Proposal:**
```
POST /api/student/projects/:id/submit
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: FormData with field "proposalFile"
```

**Submit Assignment:**
```
POST /api/teacher/assignments/:id/submit
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: FormData with field "submissionFile"
```

---

### 2. `teacherService.js`

**Base URL:** `http://localhost:5000/api/teacher/`

| Method | Function                       | Endpoint                             | Auth | Description                     |
| ------ | ------------------------------ | ------------------------------------ | ---- | ------------------------------- |
| GET    | `getDashboardStats()`          | `/dashboard/stats`                   | ✅   | Teacher dashboard statistics    |
| GET    | `getMyClasses()`               | `/classes`                           | ✅   | List assigned classes           |
| GET    | `getMySubjects()`              | `/subjects`                          | ✅   | List assigned subjects          |
| GET    | `getClassDetails(classId)`     | `/classes/:classId`                  | ✅   | Single class detail             |
| GET    | `getClassStudents(classId)`    | `/classes/:classId/students`         | ✅   | Students in a class             |
| GET    | `getGroups(classId)`           | `/classes/:classId/groups`           | ✅   | Groups for a class              |
| POST   | `generateGroups(classId, cfg)` | `/classes/:classId/groups/generate`  | ✅   | Auto-generate student groups    |
| GET    | `getAllGroups()`                | `/groups`                            | ✅   | All groups across all classes   |
| GET    | `getGroupDetails(id)`          | `/groups/:id`                        | ✅   | Single group detail             |
| POST   | `createAssignment(formData)`   | `/assignments`                       | ✅   | Create assignment (multipart)   |
| GET    | `getMyAssignments()`           | `/assignments`                       | ✅   | List all created assignments    |
| GET    | `getAssignmentById(id)`        | `/assignments/:id`                   | ✅   | Single assignment detail        |
| DELETE | `deleteAssignment(id)`         | `/assignments/:id`                   | ✅   | Delete an assignment            |
| POST   | `submitAssignment(id, form)`   | `/assignments/:id/submit`            | ✅   | Student submits assignment      |

**Dashboard Stats Response:**
```json
{
    "success": true,
    "data": {
        "totalStudents": 45,
        "totalClasses": 3,
        "totalGroups": 15,
        "totalAssignments": 8,
        "recentActivity": [...]
    }
}
```

**Group Detail Response (`/groups/:id`):**
```json
{
    "success": true,
    "data": {
        "_id": "...",
        "classCode": "IT221",
        "assignmentNumber": 1,
        "type": "group",
        "title": "New Group Project",
        "status": "SUBMITTED",
        "similarity": 0,
        "similarityLevel": "Low",
        "documentUrl": "/uploads/assignments/proposalFile-1711318942000.pdf",
        "originalFileName": "my_project.pdf",
        "members": [
            {
                "_id": "...",
                "name": "Amin Rage",
                "photo": "default-student.jpg",
                "studentId": "IT221-001"
            }
        ]
    }
}
```

> **Important:** The `documentUrl` field is relative (e.g., `/uploads/assignments/file.pdf`). The frontend prepends `http://localhost:5000` to form the full URL. Static files must be served at this path.

---

### 3. `adminDashboardService.js`

**Base URL:** `http://localhost:5000/api/admin/dashboard/`

| Method | Function     | Endpoint  | Auth | Description           |
| ------ | ------------ | --------- | ---- | --------------------- |
| GET    | `getStats()` | `/stats`  | ✅   | Admin dashboard stats |

---

### 4. `adminClassService.js`

**Base URL:** `http://localhost:5000/api/admin/classes/`

| Method | Function                  | Endpoint                    | Auth | Description              |
| ------ | ------------------------- | --------------------------- | ---- | ------------------------ |
| GET    | `getClasses()`            | `/`                         | ✅   | List all classes         |
| GET    | `getClass(code)`          | `/:code`                    | ✅   | Get class by code        |
| POST   | `createClass(data)`       | `/`                         | ✅   | Create new class         |
| POST   | `generateAccounts(code)`  | `/:code/generate-accounts`  | ✅   | Generate student accounts|

**Class Object Shape:**
```json
{
    "_id": "...",
    "code": "IT221",
    "title": "Information Technology",
    "semester": "Semester 1",
    "studentCount": 25,
    "teacher": "Teacher Name"
}
```

---

### 5. `adminStudentService.js`

**Base URL:** `http://localhost:5000/api/admin/students`

| Method | Function                   | Endpoint             | Auth   | Description                |
| ------ | -------------------------- | -------------------- | ------ | -------------------------- |
| GET    | `getStudents()`            | `/`                  | ❌*    | List all students          |
| GET    | `getStudent(id)`           | `/:id`               | ❌*    | Get student by ID          |
| POST   | `registerStudent(data)`    | `/`                  | ❌*    | Register a student         |
| PUT    | `updateStudent(id, data)`  | `/:id`               | ❌*    | Update student             |
| DELETE | `deleteStudent(id)`        | `/:id`               | ❌*    | Delete student             |
| PATCH  | `generatePasscode(id)`     | `/:id/passcode`      | ❌*    | Generate new passcode      |
| POST   | `uploadProfileImage(file)` | `/api/upload` (POST) | ❌*    | Upload profile image       |

> ⚠️ **Note:** `adminStudentService.js` does NOT send auth headers on most calls. This may be intentional or a bug. If your backend requires auth, you must add `getAuthHeaders()` to each call.

**Student Object Shape:**
```json
{
    "_id": "...",
    "name": "Amin Rage",
    "email": "amin@gmail.com",
    "studentId": "IT221-001",
    "classId": "IT221",
    "phone": "0612345678",
    "photo": "default-student.jpg",
    "userId": "..."
}
```

---

### 6. `adminTeacherService.js`

**Base URL:** `http://localhost:5000/api/admin/teachers`

| Method | Function                   | Endpoint              | Auth | Description                 |
| ------ | -------------------------- | --------------------- | ---- | --------------------------- |
| GET    | `getTeachers()`            | `/`                   | ✅   | List all teachers           |
| GET    | `getTeacher(id)`           | `/:id`                | ✅   | Get teacher by ID           |
| POST   | `registerTeacher(data)`    | `/`                   | ✅   | Register a teacher          |
| PUT    | `updateTeacher(id, data)`  | `/:id`                | ✅   | Update teacher              |
| DELETE | `deleteTeacher(id)`        | `/:id`                | ✅   | Delete teacher              |
| PATCH  | `generatePasscode(id)`     | `/:id/passcode`       | ✅   | Generate new passcode       |
| POST   | `uploadProfileImage(file)` | `/api/upload` (POST)  | ✅   | Upload profile image        |
| PATCH  | `assignClasses(id, codes)` | `/:id/classes`        | ✅   | Assign classes to teacher   |
| PATCH  | `toggleAdmin(id)`          | `/:id/toggle-admin`   | ✅   | Toggle admin role           |

**Assign Classes body:** `{ classes: ["IT221", "CS421"] }`

---

### 7. `adminAdminService.js`

**Base URL:** `http://localhost:5000/api/admin/admins`

| Method | Function              | Endpoint           | Auth | Description            |
| ------ | --------------------- | ------------------ | ---- | ---------------------- |
| GET    | `getAdmins()`         | `/`                | ✅   | List all admins        |
| POST   | `createAdmin(data)`   | `/`                | ✅   | Create new admin       |
| PUT    | `updateAdmin(id)`     | `/:id`             | ✅   | Update admin           |
| DELETE | `deleteAdmin(id)`     | `/:id`             | ✅   | Delete admin           |
| PATCH  | `resetPasscode(id)`   | `/:id/passcode`    | ✅   | Reset passcode         |

---

### 8. `adminSubjectService.js`

**Base URL:** `http://localhost:5000/api/admin/subjects/`

| Method | Function                 | Endpoint | Auth | Description           |
| ------ | ------------------------ | -------- | ---- | --------------------- |
| GET    | `getSubjects()`          | `/`      | ✅   | List all subjects     |
| GET    | `getSubject(id)`         | `/:id`   | ✅   | Get subject by ID     |
| POST   | `createSubject(data)`    | `/`      | ✅   | Create new subject    |
| PUT    | `updateSubject(id,data)` | `/:id`   | ✅   | Update subject        |
| DELETE | `deleteSubject(id)`      | `/:id`   | ✅   | Delete subject        |

**Subject Object Shape:**
```json
{
    "_id": "...",
    "name": "Web Development",
    "code": "WEB101",
    "teacher": "ObjectId",
    "classes": ["IT221", "CS421"]
}
```

---

### 9. `adminUserService.js`

**Base URL:** `http://localhost:5000/api/auth/users`

| Method | Function                 | Endpoint      | Auth | Description              |
| ------ | ------------------------ | ------------- | ---- | ------------------------ |
| GET    | `getUsersByRole(role)`   | `?role=<role>`| ✅   | Get users filtered by role |

---

## Feature Modules

### Auth Feature (`features/Auth/`)

- **`LoginPage.jsx`**: A single login form that sends `identifier` + `passcode` to the backend.
- Uses `useAuth().login()` from context.
- On success, redirects based on role: `student → /`, `teacher → /teacher`, `admin → /admin`.

### Admin Feature (`features/admin/`)

The admin panel manages the entire system:
- **Dashboard**: Shows stats (student count, teacher count, class count)
- **Teachers**: Full CRUD — create, view profile, edit, delete, assign classes, toggle admin
- **Students**: Full CRUD — register, view detail, update, delete, generate passcodes
- **Classes**: Create classes, view class details, generate student accounts for a class
- **Subjects**: CRUD for academic subjects — assign teachers and classes to subjects
- **Admins**: Manage admin accounts
- **Layout**: `AdminLayout.jsx` provides sidebar navigation

### Teacher Feature (`features/teacher/`)

The teacher panel manages classes, groups, and assignments:
- **Dashboard**: Overview statistics
- **Classes**: View assigned classes, see students per class
- **Groups**: Configure group assignments, view group details with document viewer
- **Assignments**: Create assignments (with file upload), view submissions, track status
- **Layout**: Uses `DashboardLayout.jsx` from `shared/layouts/`

### Student Feature (`features/student/`)

The student portal for viewing projects and submitting work:
- **Landing Page**: Public home page with project showcase
- **Gallery**: Browse all projects publicly
- **My Projects**: Student's own group projects with submission capability
- **Assignments**: View assigned homework, submit files, track submission status
- **Profile**: View/edit student profile
- **Header**: `StudentHeader.jsx` — shared navigation bar across all student pages

---

## Shared Components & Layouts

### `DashboardLayout.jsx` (`shared/layouts/`)

Used for the **Teacher** panel. Provides:
- Sidebar navigation with icons (Dashboard, Classes, Group Management, Assignments)
- Top bar with user profile image and logout button
- Responsive design — sidebar collapses on mobile
- Wraps the teacher route content in a flex layout

### `StudentHeader.jsx` (`features/student/components/`)

Used across ALL student pages (Landing, Gallery, Assignments, etc). Provides:
- Fixed top navigation bar
- Links: HOME, GALLERY, MY PROJECTS, ASSIGNMENTS, ABOUT
- Active link highlighting with blue underline
- Profile avatar + logout button (when logged in)
- Login button (when not logged in)
- Navigation items are defined as an array:
```js
const navItems = [
    { label: 'HOME', path: '/' },
    { label: 'GALLERY', path: '/gallery' },
    { label: 'MY PROJECTS', path: '/student', end: true },
    { label: 'ASSIGNMENTS', path: '/assignments' },
    { label: 'ABOUT', path: '/about' },
];
```

---

## Data Models & Expected Shapes

### User (from `GET /api/auth/me`)
```json
{
    "_id": "string",
    "name": "string",
    "email": "string",
    "role": "student | teacher | admin",
    "roles": ["string"],
    "photo": "string (filename or URL)"
}
```

### Student
```json
{
    "_id": "string",
    "name": "string",
    "email": "string",
    "studentId": "string (e.g., 'IT221-001')",
    "classId": "string (e.g., 'IT221')",
    "phone": "string",
    "photo": "string",
    "userId": "string (reference to User)"
}
```

### Teacher
```json
{
    "_id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "photo": "string",
    "assignedClasses": ["string (class codes)"],
    "userId": "string"
}
```

### Class
```json
{
    "_id": "string",
    "code": "string (e.g., 'IT221')",
    "title": "string",
    "semester": "string",
    "studentCount": "number"
}
```

### Subject
```json
{
    "_id": "string",
    "name": "string",
    "code": "string",
    "teacher": "string (ObjectId)",
    "classes": ["string (class codes)"]
}
```

### ProjectAssignment (Group/Individual Project)
```json
{
    "_id": "string",
    "classCode": "string",
    "assignmentNumber": "number",
    "type": "individual | group",
    "title": "string",
    "status": "DRAFT | SUBMITTED | PENDING REVIEW",
    "similarity": "number (0-100)",
    "similarityLevel": "Low | Med | High",
    "documentUrl": "string | null (e.g., '/uploads/assignments/file.pdf')",
    "originalFileName": "string | null",
    "members": [
        {
            "_id": "string",
            "name": "string",
            "photo": "string",
            "studentId": "string"
        }
    ],
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
}
```

### Assignment (Teacher Homework)
```json
{
    "_id": "string",
    "title": "string",
    "description": "string",
    "subject": {
        "_id": "string",
        "name": "string",
        "classes": ["string"]
    },
    "teacher": {
        "_id": "string",
        "name": "string"
    },
    "deadline": "ISO date string",
    "files": [
        {
            "filename": "string",
            "originalName": "string",
            "path": "string"
        }
    ],
    "submissions": [
        {
            "student": "ObjectId",
            "files": [
                {
                    "filename": "string",
                    "originalName": "string",
                    "path": "string"
                }
            ],
            "submittedAt": "ISO date"
        }
    ],
    "createdAt": "ISO date"
}
```

---

## File Upload Conventions

The frontend uses `FormData` + `multipart/form-data` for all file uploads. Here are all upload endpoints:

### 1. Profile Image Upload
```
POST http://localhost:5000/api/upload
Content-Type: multipart/form-data
Field name: "image"
Response: URL string (plain text, NOT JSON)
```

### 2. Assignment Creation (teacher creates homework)
```
POST http://localhost:5000/api/teacher/assignments
Content-Type: multipart/form-data
Authorization: Bearer <token>
Field name: "files" (can be multiple)
Other fields: title, description, subjectId, deadline
```

### 3. Assignment Submission (student submits homework)
```
POST http://localhost:5000/api/teacher/assignments/:id/submit
Content-Type: multipart/form-data
Authorization: Bearer <token>
Field name: "submissionFile"
```

### 4. Project Proposal Submission (student submits project document)
```
POST http://localhost:5000/api/student/projects/:id/submit
Content-Type: multipart/form-data
Authorization: Bearer <token>
Field name: "proposalFile"
```

### 5. Document Upload (generic)
```
POST http://localhost:5000/api/upload/document
Content-Type: multipart/form-data
Field name: "artifact"
Response: URL string
```

### Static File Access

All uploaded files are accessible at:
```
http://localhost:5000/uploads/<filename>
http://localhost:5000/uploads/assignments/<filename>
```

The backend must serve static files from a `public/uploads/` directory. For example:
```js
// Backend: express static middleware
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
```

Photo URLs in the frontend are resolved like this:
```jsx
// If the photo starts with 'http', use as-is; otherwise prepend the backend URL
const photoUrl = photo.startsWith('http') 
    ? photo 
    : `http://localhost:5000/uploads/${photo}`;
```

---

## How to Connect Your Own Backend

If you want to use this frontend with your own backend, follow these steps:

### Step 1: Update All API URLs

Search the entire `src/` directory for `localhost:5000` and replace with your backend URL. Key locations:

1. **`src/services/*.js`** — Every service file has a `API_URL` constant
2. **`src/context/authContext.jsx`** — Login and auth-check URLs
3. **Page-level direct calls** — Some pages call `axios` directly:
   - `StudentMyProjectDetail.jsx` (project submission)
   - `StudentAssignmentDetail.jsx` (assignment submission)
   - `StudentProjectDetail.jsx` (project detail & submission)
   - `GroupDetailPage.jsx` (document download URLs)

> 💡 **Tip:** Use Find & Replace across the project: replace `http://localhost:5000` with your backend URL.

### Step 2: Implement These Backend API Endpoints

Your backend must implement all the endpoints listed in the [Service Layer](#service-layer--api-connections) section above. Here is the minimum set of routes:

```
# Authentication
POST   /api/auth/login              → { success, token, user }
GET    /api/auth/me                 → { success, data: user }

# Student
GET    /api/student/dashboard       → { success, data: { student, class, groups } }
GET    /api/student/projects/:id    → { success, data: project }
POST   /api/student/projects/:id/submit  → multipart, field: "proposalFile"
GET    /api/student/assignments     → { success, data: [assignments] }
GET    /api/student/assignments/:id → { success, data: assignment }

# Teacher
GET    /api/teacher/dashboard/stats → { success, data: stats }
GET    /api/teacher/classes         → { success, data: [classes] }
GET    /api/teacher/subjects        → { success, data: [subjects] }
GET    /api/teacher/classes/:id     → { success, data: class }
GET    /api/teacher/classes/:id/students → { success, data: [students] }
GET    /api/teacher/classes/:id/groups   → { success, data: [groups] }
POST   /api/teacher/classes/:id/groups/generate → { success, data: [groups] }
GET    /api/teacher/groups          → { success, data: [grouped by class] }
GET    /api/teacher/groups/:id      → { success, data: group }
POST   /api/teacher/assignments     → multipart, fields: files, title, etc.
GET    /api/teacher/assignments     → { success, data: [assignments] }
GET    /api/teacher/assignments/:id → { success, data: assignment }
DELETE /api/teacher/assignments/:id → { success }
POST   /api/teacher/assignments/:id/submit → multipart, field: "submissionFile"

# Admin
GET    /api/admin/dashboard/stats   → { success, data: stats }
GET    /api/admin/classes           → { success, data: [classes] }
GET    /api/admin/classes/:code     → { success, data: class }
POST   /api/admin/classes           → { success, data: class }
POST   /api/admin/classes/:code/generate-accounts → { success }
GET    /api/admin/students          → { success, data: [students] }
GET    /api/admin/students/:id      → { success, data: student }
POST   /api/admin/students          → { success, data: student }
PUT    /api/admin/students/:id      → { success, data: student }
DELETE /api/admin/students/:id      → { success }
PATCH  /api/admin/students/:id/passcode → { success }
GET    /api/admin/teachers          → { success, data: [teachers] }
GET    /api/admin/teachers/:id      → { success, data: teacher }
POST   /api/admin/teachers          → { success, data: teacher }
PUT    /api/admin/teachers/:id      → { success, data: teacher }
DELETE /api/admin/teachers/:id      → { success }
PATCH  /api/admin/teachers/:id/passcode → { success }
PATCH  /api/admin/teachers/:id/classes  → body: { classes: [] }
PATCH  /api/admin/teachers/:id/toggle-admin → { success }
GET    /api/admin/admins            → { success, data: [admins] }
POST   /api/admin/admins            → { success, data: admin }
PUT    /api/admin/admins/:id        → { success, data: admin }
DELETE /api/admin/admins/:id        → { success }
PATCH  /api/admin/admins/:id/passcode → { success }
GET    /api/admin/subjects          → { success, data: [subjects] }
GET    /api/admin/subjects/:id      → { success, data: subject }
POST   /api/admin/subjects          → { success, data: subject }
PUT    /api/admin/subjects/:id      → { success, data: subject }
DELETE /api/admin/subjects/:id      → { success }

# File Upload
POST   /api/upload                  → returns URL string (profile images)
POST   /api/upload/document         → returns URL string (documents)

# User Queries
GET    /api/auth/users?role=<role>  → { success, data: [users] }
```

### Step 3: Serve Static Files

Your backend must serve uploaded files at:
```
GET /uploads/<filename>             → file download
GET /uploads/assignments/<filename> → file download
```

### Step 4: JWT Authentication

Your backend must:
1. Issue JWT tokens on `/api/auth/login`
2. Accept `Authorization: Bearer <token>` header on protected routes
3. Respond with `{ success: true, data: user }` on `/api/auth/me`
4. Return `401` status if token is invalid/expired

### Step 5: Response Format

**All** your API responses MUST follow this format:
```json
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}
```

The frontend checks `response.data.success` everywhere.

---

## Common Patterns & Conventions

### 1. Token Management
- Stored in `localStorage` under key `token`
- Attached to requests as `Authorization: Bearer <token>`
- Most services read it via `localStorage.getItem('token')`
- `authContext.jsx` also sets it as a default axios header

### 2. Loading States
- Most pages use `const [loading, setLoading] = useState(true)`
- Show a `<Loader2>` spinner (from lucide-react) while loading
- Set loading to `false` in the `finally` block

### 3. Error Handling
- Services return `error.response?.data` on failure
- Pages show `alert()` for errors (simple approach)
- Some pages show inline error states

### 4. Photo Resolution
```jsx
// Pattern used everywhere for user/student photos:
{member.photo && member.photo !== 'default-student.jpg' ? (
    <img src={member.photo.startsWith('http') 
        ? member.photo 
        : `http://localhost:5000/uploads/${member.photo}`} 
    />
) : (
    <span>{member.name[0]}</span>  // Fallback: first letter of name
)}
```

### 5. UI Framework
- **TailwindCSS v4** — all styling is utility-class based
- **Lucide React** — all icons come from this library
- **No component library** — all UI is custom-built
- **Dark mode** — partially supported via `dark:` prefix on some teacher/admin pages

### 6. Navigation
```jsx
// Programmatic navigation:
const navigate = useNavigate();
navigate('/teacher/groups/123');

// Link-based navigation:
<Link to={`/student/project/${group._id}`}>View</Link>
```

---

## Quick Reference: What Calls What

```
LoginPage.jsx
  └─ authContext.login() → POST /api/auth/login

StudentMyProject.jsx
  └─ studentService.getDashboard() → GET /api/student/dashboard

StudentMyProjectDetail.jsx
  └─ studentService.getProjectDetails(id) → GET /api/student/projects/:id
  └─ axios.post(projects/:id/submit) → POST /api/student/projects/:id/submit

StudentAssignments.jsx
  └─ axios.get(student/assignments) → GET /api/student/assignments

StudentAssignmentDetail.jsx
  └─ axios.get(student/assignments/:id) → GET /api/student/assignments/:id
  └─ teacherService.submitAssignment() → POST /api/teacher/assignments/:id/submit

TeacherDashboard.jsx
  └─ teacherService.getDashboardStats() → GET /api/teacher/dashboard/stats
  └─ teacherService.getMyClasses() → GET /api/teacher/classes

ManageClasses.jsx
  └─ teacherService.getMyClasses() → GET /api/teacher/classes

ClassDetail.jsx
  └─ teacherService.getClassDetails(id) → GET /api/teacher/classes/:id
  └─ teacherService.getClassStudents(id) → GET /api/teacher/classes/:id/students

ProjectsOverview.jsx
  └─ teacherService.getAllGroups() → GET /api/teacher/groups

GroupDetailPage.jsx
  └─ teacherService.getGroupDetails(id) → GET /api/teacher/groups/:id

Assignments.jsx
  └─ teacherService.getMyAssignments() → GET /api/teacher/assignments
  └─ teacherService.createAssignment() → POST /api/teacher/assignments
  └─ teacherService.getMySubjects() → GET /api/teacher/subjects

AssignmentDetail.jsx
  └─ teacherService.getAssignmentById(id) → GET /api/teacher/assignments/:id

AdminDashboard.jsx
  └─ adminDashboardService.getStats() → GET /api/admin/dashboard/stats

AdminTeachers.jsx
  └─ adminTeacherService.getTeachers() → GET /api/admin/teachers

AdminStudents.jsx
  └─ adminStudentService.getStudents() → GET /api/admin/students

AdminClasses.jsx
  └─ adminClassService.getClasses() → GET /api/admin/classes

AdminSubjects.jsx
  └─ adminSubjectService.getSubjects() → GET /api/admin/subjects
```

---

## License

This frontend is part of the **ProjectVerify** Graduation Project.

---

*Last updated: March 25, 2026*
