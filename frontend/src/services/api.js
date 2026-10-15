const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8001/api").replace(/\/$/, "");

function getAuthHeaders() {
  const token = localStorage.getItem("kec_token");
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

  const token = localStorage.getItem("kec_token");
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
      const detail = data.detail || data.message;
      const message = Array.isArray(detail)
        ? detail.map((item) => `${(item.loc || []).filter((part) => part !== "body").join(".")}: ${item.msg || "Invalid value"}`).join("; ")
        : typeof detail === "string" ? detail : `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (err) {
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
    request("/consolidate/upload", {
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
    request(`/exceptions/${exceptionId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, review_notes }),
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
