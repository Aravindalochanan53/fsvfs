# Kongu Engineering College — Verified Internship & Academic Attendance Portal

An enterprise-grade, full-stack modernization of the Kongu Engineering College (KEC) Internship Management & Academic Attendance Portal. Built with **FastAPI** (Python 3.13 + SQLAlchemy + Microsoft SQL Server / SQLite) on the backend and **React + Vite** with modern responsive CSS, interactive Chart.js visualizations, and Lucide icons on the frontend.

For Vercel, follow [the deployment guide](backend/DEPLOYMENT.md). The local MSSQL
`kongu_db` must first be migrated to a reachable SQL Server/Azure SQL instance;
Vercel cannot access a laptop's localhost database. Private uploads use connected
Vercel Blob storage in cloud deployments.

Legacy PHP reference files remain in the local cleanup backup. Private data and
backups are excluded from Git and deployment bundles.

---

## 🏛️ System Architecture

```
kongu/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/
│   │   │   ├── auth.py             # JWT authentication, session tracking, zero-auto-attendance login
│   │   │   ├── attendance.py       # Strict attendance, immutable check-in lock, Haversine verification, corrections
│   │   │   ├── exceptions.py       # Attendance exception filing and faculty approval workflow
│   │   │   ├── reports.py          # 21-chapter internship report, revision history, comments, PDF export
│   │   │   ├── students.py         # Student records and department-scoped profiles
│   │   │   ├── faculty.py          # Faculty directory and department management
│   │   │   ├── companies.py        # Company geofence polygons/coordinates management
│   │   │   ├── departments.py      # Department explorer & branch statistics
│   │   │   ├── documents.py        # Secure UUID document uploads (magic byte validation)
│   │   │   ├── consolidate.py      # Consolidated reports and department exports
│   │   │   └── dashboard.py        # Real-time metrics for student, faculty, and admin
│   │   ├── core/
│   │   │   ├── config.py           # Settings, database configuration, security thresholds
│   │   │   └── security.py         # Passwords, JWT generation, cryptographic validation
│   │   ├── db/
│   │   │   └── session.py          # SQLAlchemy session maker, MSSQL/SQLite dialect handling
│   │   ├── models/
│   │   │   └── models.py           # Database models, audit logs, exceptions, policies, constraints
│   │   └── schemas/
│   │       └── schemas.py          # Pydantic schemas for requests, responses, and validation
│   ├── alembic/                    # Database migrations
│   │   ├── versions/
│   │   │   ├── 001_initial.py
│   │   │   └── 428d4ff4f1bf_add_audit_logs_and_policies.py
│   │   └── env.py                  # Alembic environment with MSSQL URL escaping
│   ├── tests/                      # Automated test suite (36 unit & RBAC tests)
│   ├── test_strict_suite.py        # Strict attendance & report workflow verification suite (15 tests)
│   └── seed_data.py                # Database seeder with KEC students, faculty, and companies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Institutional header with live countdown and user roles
│   │   │   ├── ProtectedRoute.jsx  # Role-based route guard
│   │   │   └── NotificationBanner.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Authentication state, login/logout, role dispatch
│   │   ├── pages/
│   │   │   ├── AttendanceTracker.jsx # Geofenced check-in/out, countdown, exception filing modal
│   │   │   ├── StudentHome.jsx     # Live KPIs, attendance percentage, hours, report status
│   │   │   ├── FacultyHome.jsx     # Department alerts, live roster, exception reviews, low-attendance watchlist
│   │   │   ├── ReportBuilder.jsx   # 21-chapter report builder, live completion %, comments, PDF preview
│   │   │   ├── StudentReportDetail.jsx # Faculty detailed student inspection & Chart.js charts
│   │   │   ├── DepartmentExplorer.jsx  # Dynamic department explorer replacing legacy PHP files
│   │   │   ├── ConsolidateDashboard.jsx# Real-time metrics and document upload center
│   │   │   └── LoginPage.jsx       # Institutional emerald login with student/faculty switch
│   │   ├── services/
│   │   │   └── api.js              # Centralized API service with JWT authorization
│   │   └── App.jsx
│   └── index.html
```

---

## 🗄️ Database Architecture (Microsoft SQL Server / SQLite)

- **Primary Database**: Microsoft SQL Server 2022 (`localhost\MSSQL`)
- **Database Name**: `kongu_db`
- **Driver**: `ODBC Driver 17 for SQL Server` / `ODBC Driver 18 for SQL Server`
- **Alembic Migrations**: Fully configured with URL interpolation escaping (`%` -> `%%`) for ODBC connection strings.
- **SQLite Fallback**: Set `DB_ENGINE=sqlite` for portable test environments.

---

## 🔒 Strict Attendance Business Rules

### 1. Check-in Rules & Immutability
- **Single Check-In Per Date**: A student can check in only once per calendar date. Duplicate check-in attempts return HTTP `400 Bad Request` with the original check-in timestamp.
- **Zero Auto-Attendance**: Logging in **never** generates an attendance record.
- **Server-Side Geofence Validation**: The backend validates coordinates against the assigned company's geofence center using the **Haversine formula**. Client-supplied distances are never trusted.
- **Initial Status**: Successful check-in sets the record to `Checked In / Pending Completion` (`CHECKED_IN_PENDING`). **This does not count as Present.**
- **Immutable Server Timestamp**: Check-in time, coordinates, and device metadata are permanently locked upon submission.
- **Audit-Logged Corrections**: Only authorized faculty or administrators can modify an attendance record via `/attendance/correct`, requiring a mandatory justification and creating an immutable entry in `attendance_audit_logs`.

### 2. Minimum Duration & Checkout Hierarchy
- **Minimum Duration Requirement**: Minimum 3.0 hours (admin-configurable, default 3.0 hours) between check-in and checkout before an attendance record is eligible for Present status.
- **Live Student Countdown**: The student UI shows a prominent real-time countdown banner:
  > *"Eligible for Verified Checkout in: 2h 45m (You can check out at 12:00 PM)"*
- **Daily Work Summary**: Mandatory text summary describing tasks completed during the internship shift.
- **Checkout Location Re-Verification**: GPS coordinates are re-verified using Haversine at checkout.
- **Status Determination Hierarchy**:
  - `>= 3.0 Hours` + `Inside Geofence (In & Out)` + `Work Summary` $\rightarrow$ **`Present / Verified`**
  - `1.5 to 3.0 Hours` $\rightarrow$ **`Half Day`** (does not count toward verified present %)
  - `< 1.5 Hours` $\rightarrow$ **`Incomplete`**
  - `Outside Geofence` $\rightarrow$ **`Location Exception / Pending Faculty Approval`**
- **Verified Attendance Metric**: Attendance percentage strictly counts **only** `Present / Verified` records:
  $$\text{Verified Attendance \%} = \frac{\text{Present / Verified Days}}{\text{Total Working Days}} \times 100$$

### 3. Anti-Fraud & Exception Handling
- **Anti-Fraud Detection**: Detects low GPS accuracy (>150m), mocked location provider flags, and impossible travel speed (>120 km/h between locations).
- **Attendance Exception Workflow**: Students submit exceptions with reason and document evidence (`attendance_exceptions`).
- **Faculty Approval Queue**: Department faculty review pending exceptions with one-click Approve / Reject actions.
- **Database Constraints**: `UniqueConstraint("student_id", "attendance_date", name="uq_student_attendance_date")` guarantees no duplicate records at the database level.

---

## 📑 21-Chapter Formal Internship Report Module

The report builder is a college-ready academic documentation workflow structured across 5 parts and 21 formal sections:

1. **Preliminary Pages**: Cover Page, Bonafide Certificate, Student Declaration, Formal Acknowledgement, Abstract & Executive Summary, Table of Contents
2. **Organization & Schedule**: Company Profile & Business Domain, Workplace & Industrial Mentors, Internship Objectives, Duration & Weekly Work Timeline
3. **Technical Architecture**: Technologies, Frameworks & Tools, Problem Statement / Project Scope, System Methodology & Design
4. **Development & Evidence**: Development & Work Completed, Screenshots & Diagrammatic Evidence, Challenges Encountered & Solutions, Skills Acquired & Learning Outcomes
5. **Closure & Verification**: Conclusion & Industrial Impact, Future Scope & Enhancements, References & Documentation Links, Appendix: Offer Letter & Verified Attendance Summary

### Report Rules & Governance
- **Section-wise Completion Tracking**: Real-time progress bar. 100% completion of all 21 sections is required before final submission.
- **75% Verified Attendance Gate**: Final submission checks verified attendance percentage against the academic 75% threshold.
- **Draft Saving & Revision History**: Automatic versioning with timestamps and change summaries in `report_version_history`.
- **Submission Lock**: On final submit, the report is permanently locked for student edits.
- **Faculty Evaluation**: Faculty can evaluate reports with:
  - `Approved` $\rightarrow$ Permanently certified.
  - `Changes Requested` $\rightarrow$ Unlocks only the designated sections for student revision with section-specific comments.
  - `Rejected` $\rightarrow$ Requires resubmission.
- **Section-Specific Faculty Comments**: Faculty can leave targeted feedback per section via `/reports/{id}/comments`.
- **Printable PDF Export**: Produces an official Kongu Engineering College formal report with college crest, academic headers, attendance verification table, and signature blocks.

---

## 🛡️ Department-Restricted Access Control (RBAC)

- **Student**: Can only access their own profile, mark check-in/out, file exceptions, and edit their own internship report.
- **Faculty Coordinator**: Department-isolated. Can only view students, rosters, live alerts, low-attendance watchlists (<75%), and reports within their assigned department (e.g., Computer Science and Engineering). Attempts to view or approve students from other departments return HTTP `403 Forbidden`.
- **Head of Department (HOD) / Admin**: Campus-wide access to all 15 departments, geofence policies, audit logs, and consolidated college reports.

---

## 👥 Demo Accounts

| Role | User ID / Roll No | Password | Department / Details |
| :--- | :--- | :--- | :--- |
| **Student** | `21CSR001` | `password123` | Aarav Krishnan (CSE) — Assigned to Infosys Limited |
| **Student** | `21ITR045` | `password123` | Priya Dharshini (IT) — Assigned to Zoho Corporation |
| **Faculty** | `KECFAC101` | `password123` | Dr. S. Radhakrishnan — CSE Faculty Coordinator |
| **Faculty** | `KECFAC201` | `password123` | Dr. M. Kavitha — IT Faculty Coordinator |
| **Admin** | `KECADMIN01` | `password123` | Dr. Admin — College Internship Coordinator / Admin |

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Microsoft SQL Server 2019/2022 (or SQLite)
- ODBC Driver 17 or 18 for SQL Server

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate   # On Windows

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python -m alembic upgrade head

# Seed initial data (optional if db is empty)
python seed_data.py

# Start backend server
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Access the application at `http://localhost:5173`.

---

## 🧪 Testing & Validation

The codebase includes two automated test suites:

### 1. Unit & RBAC Test Suite (36 Tests)
Covers attendance locking, login zero-attendance, Haversine verification, role-based authorization, department isolation, and document upload security:
```bash
cd backend
python -m pytest tests/
```

### 2. Strict Attendance & Report Workflow Suite (15 Tests)
Validates the end-to-end business rules:
```bash
cd backend
python test_strict_suite.py
```
Test results verify:
1. Student & Faculty authentication without side effects.
2. Daily check-in lock (HTTP 400 with existing timestamp).
3. Verified attendance statistics calculation (only `Present / Verified` counted).
4. Faculty department alerts filtering.
5. Faculty correction workflow with immutable audit log generation.
6. Report draft saving and revision history tracking.
7. Faculty report review with selective section unlocking.
"# fsvfs" 
