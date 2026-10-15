# UI/UX Audit

- The portal uses an emerald institutional palette defined in `frontend/src/index.css`.
- Attendance geofence UI previously read fields that the backend does not return. It now reads the nested `company` object and uses the server-configured radius.
- Student navigation and dashboard shortcuts no longer expose the faculty-only Consolidated Dashboard.
- Remaining work: progressively replace page-level inline layout styles with shared responsive layout classes and add frontend interaction tests.
