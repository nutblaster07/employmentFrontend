# Employee Management React Frontend

Responsive React + Vite UI for the Spring Boot employee API.

## Features
- Fetches employees from `GET /api/employees`
- Search by name, email, department, or ID
- Filter by ACTIVE / INACTIVE status
- Filter by department
- Total / active / inactive summary cards
- Refresh, loading, and error states
- Responsive directory table

## Run on Windows
1. Extract the ZIP.
2. Open the folder in VS Code or terminal.
3. Run `npm install`
4. Optional: copy `.env.example` to `.env` and set `VITE_API_BASE_URL=http://localhost:8081`
5. Run `npm run dev`
6. Open the URL Vite prints, normally `http://localhost:5173`.

The backend must be running on port 8081 and provide `GET /api/employees` returning a JSON array with employee fields such as `id`, `name`, `email`, `department`, `salary`, and `status`.

If the browser reports CORS errors, configure Spring Boot to allow `http://localhost:5173` for the API. Search and filters are client-side. This starter UI is read-only: it displays status but does not change employee records. React calls the Spring Boot API; it does not connect directly to PostgreSQL.
