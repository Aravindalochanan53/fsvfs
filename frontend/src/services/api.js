const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

function getAuthHeaders() {
  const token = sessionStorage.getItem("kec_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = options.isFormData ? {} : getAuthHeaders();
  
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const token = sessionStorage.getItem("kec_token");
  if (options.isFormData && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        window.dispatchEvent(new Event('kec-session-expired'));
      }
      const detail = data.detail || data.message;
      let message;
      if (response.status === 404) {
        message = typeof detail === "string" ? detail : `Endpoint not found (404): ${endpoint}. Please verify the backend service is running.`;
      } else if (response.status === 401) {
        message = typeof detail === "string" ? detail : "Invalid credentials or your session has expired.";
      } else if (response.status === 403) {
        message = typeof detail === "string" ? detail : "Access denied (403): You do not have permission for this action.";
      } else if (Array.isArray(detail)) {
        message = detail.map((item) => `${(item.loc || []).filter((part) => part !== "body").join(".")}: ${item.msg || "Invalid value"}`).join("; ");
      } else if (typeof detail === "string") {
        message = detail;
      } else {
        message = `Request failed with HTTP status ${response.status}`;
      }
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    if (err.name === "TypeError" && (err.message.includes("fetch") || err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
      const netErr = new Error(`Cannot connect to backend server at ${API_BASE}. Please ensure the FastAPI backend is running.`);
      netErr.status = 0;
      console.error(`Network connection error on ${endpoint}:`, netErr);
      throw netErr;
    }
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  studentLogin: (roll_number, password) =>
    request("/auth/student/login", {
      method: "POST",
      body: JSON.stringify({ roll_number, password }),
    }),

  studentSignup: (data) =>
    request("/auth/student/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  facultyLogin: (roll_number, password) =>
    request("/auth/faculty/login", {
      method: "POST",
      body: JSON.stringify({ roll_number, password }),
    }),

  facultySignup: (data) =>
    request("/auth/faculty/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMe: () => request("/auth/me"),
  getRegistrationWorkplaces: () => request("/auth/workplaces"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Strict Tamper-Resistant Attendance
  getTodayAttendance: () => request("/attendance/today"),

  checkIn: (lat, lng, accuracy = null, device_info = null) =>
    request("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ lat, lng, accuracy_m: accuracy, device_info }),
    }),

  checkOut: (lat, lng, accuracy = null, work_summary = "", device_info = null) =>
    request("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({ lat, lng, accuracy_m: accuracy, work_summary, device_info }),
    }),

  getAttendanceHistory: (studentId = null, limit = 15) => {
    const q = studentId ? `?student_id=${studentId}&limit=${limit}` : `?limit=${limit}`;
    return request(`/attendance/history${q}`);
  },

  getAttendanceStats: (studentId = null) => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return request(`/attendance/stats${q}`);
  },

  getFacultyAlerts: () => request("/attendance/alerts"),

  correctAttendance: (attendance_id, new_status, new_working_hours, reason) =>
    request("/attendance/correct", {
      method: "POST",
      body: JSON.stringify({ attendance_id, new_status, new_working_hours, reason }),
    }),

  getAttendanceAuditLogs: (studentId = null) => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return request(`/attendance/audit-logs${q}`);
  },

  // Departments
  getDepartments: () => request("/departments"),

  getDepartmentRoster: (code) => request(`/departments/${code}`),

  // Students
  getStudents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.append("q", params.q);
    if (params.department) query.append("department", params.department);
    if (params.semester) query.append("semester", params.semester);
    return request(`/students?${query.toString()}`);
  },

  getStudentDetail: (id) => request(`/students/${id}`),

  // Full 20-Section Internship Reports Workflow
  getMyReport: () => request("/reports/my"),

  saveReportDraft: (sections_data, change_summary = "Saved report draft") =>
    request("/reports/draft", {
      method: "POST",
      body: JSON.stringify({ sections_data, change_summary }),
    }),

  submitFinalReport: (sections_data, grant_attendance_exception = false) =>
    request("/reports/submit", {
      method: "POST",
      body: JSON.stringify({ sections_data, grant_attendance_exception }),
    }),

  getReportVersions: (studentId = null) => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return request(`/reports/versions${q}`);
  },

  getFacultyReviewList: () => request("/reports/review-list"),

  reviewReport: (report_id, decision, feedback, unlocked_sections = []) =>
    request("/reports/review", {
      method: "POST",
      body: JSON.stringify({ report_id, decision, feedback, unlocked_sections }),
    }),

  getReportById: (reportId) => request(`/reports/by-id/${reportId}`),

  getReportByReg: (regNo) => request(`/reports/by-reg/${regNo}`),

  // Consolidate
  getConsolidateSummary: () => request("/consolidate/summary"),

  uploadDocument: (formData) =>
    request("/documents/upload", {
      method: "POST",
      isFormData: true,
      body: formData,
    }),

  // Exceptions Workflow
  createException: (data) =>
    request("/exceptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyExceptions: () => request("/exceptions/mine"),

  getPendingExceptions: () => request("/exceptions/pending"),

  reviewException: (exceptionId, status, review_notes = "") =>
    request(`/exceptions/${exceptionId}/review?${new URLSearchParams({ status, review_notes })}`, {
      method: "PATCH",
    }),

  getLowAttendanceWatchlist: (threshold = 75.0) =>
    request(`/exceptions/department-watchlist?threshold=${threshold}`),

  // Report Section Comments
  addReportComment: (reportId, section_key, comment) =>
    request(`/reports/${reportId}/comments`, {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, section_key, comment }),
    }),

  getReportComments: (reportId) => request(`/reports/${reportId}/comments`),

  // Dashboards
  getStudentDashboard: () => request("/dashboard/student"),
  getFacultyDashboard: () => request("/dashboard/faculty"),
};

export default api;
