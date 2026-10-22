
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "https://employeemanagement-wxmb.onrender.com";
const EMPLOYEE_API = `${API_BASE_URL}/api/employees`;

const EMPTY_FORM = {
  name: "",
  email: "",
  department: "",
  salary: "",
  status: "ACTIVE",
};

async function request(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to ${API_BASE_URL}. Make sure Spring Boot is running.`
    );
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Request failed with status ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? response.json()
    : null;
}

function formatSalary(salary) {
  const amount = Number(salary);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function normalizeStatus(status) {
  return String(status || "").toUpperCase();
}

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Audit report state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEmployee, setAuditEmployee] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  // Load employees from the backend
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request(EMPLOYEE_API);

      if (!Array.isArray(data)) {
        throw new Error("The API did not return an employee list.");
      }

      setEmployees(data);
    } catch (err) {
      setError(err.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Get unique departments
  const departments = useMemo(() => {
    return [
      ...new Set(
        employees
          .map((employee) => employee.department)
          .filter(Boolean)
      ),
    ].sort();
  }, [employees]);

  // Search and filter employees
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !term ||
        String(employee.name || "").toLowerCase().includes(term) ||
        String(employee.email || "").toLowerCase().includes(term) ||
        String(employee.id ?? "").includes(term);

      const matchesDepartment =
        departmentFilter === "ALL" ||
        employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        normalizeStatus(employee.status) === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, search, departmentFilter, statusFilter]);

  const activeCount = employees.filter(
    (employee) => normalizeStatus(employee.status) === "ACTIVE"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => normalizeStatus(employee.status) === "INACTIVE"
  ).length;

  // Open the create employee form
  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  // Open the edit employee form
  function openEditModal(employee) {
    setEditingId(employee.id);
    setForm({
      name: employee.name || "",
      email: employee.email || "",
      department: employee.department || "",
      salary: employee.salary ?? "",
      status: normalizeStatus(employee.status) || "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  // Handle form field changes
  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Create or update an employee
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const salary = Number(form.salary);

    if (!form.name.trim()) {
      setError("Employee name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Employee email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!form.department.trim()) {
      setError("Department is required.");
      return;
    }

    if (form.salary === "" || !Number.isFinite(salary) || salary < 0) {
      setError("Enter a valid, non-negative salary.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department.trim(),
      salary,
      status: form.status,
    };

    const isEditing = editingId !== null;
    const url = isEditing
      ? `${EMPLOYEE_API}/${editingId}`
      : EMPLOYEE_API;

    setSaving(true);

    try {
      await request(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      await loadEmployees();

      setNotice(
        isEditing
          ? "Employee updated successfully."
          : "Employee created successfully."
      );
    } catch (err) {
      setError(err.message || "Could not save employee.");
    } finally {
      setSaving(false);
    }
  }

  // Delete an employee
  async function handleDelete(employee) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.name}?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await request(`${EMPLOYEE_API}/${employee.id}`, {
        method: "DELETE",
      });

      await loadEmployees();
      setNotice(`${employee.name} was deleted successfully.`);
    } catch (err) {
      setError(err.message || "Could not delete employee.");
    }
  }

  // Fetch audit history for the selected employee
  async function handleViewAudit(employee) {
    setAuditEmployee(employee);
    setAuditLogs([]);
    setAuditError("");
    setAuditLoading(true);
    setAuditOpen(true);

    try {
      const data = await request(
        `${API_BASE_URL}/api/audit-logs/${employee.id}`
      );

      // Support common response formats
      const logs = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data?.logs)
            ? data.logs
            : Array.isArray(data?.auditLogs)
              ? data.auditLogs
              : [];

      setAuditLogs(logs);
    } catch (err) {
      setAuditError(err.message || "Failed to load audit history.");
    } finally {
      setAuditLoading(false);
    }
  }

  // Clear all filters
  function clearFilters() {
    setSearch("");
    setDepartmentFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <main className="app-shell">
      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">EM</div>
          <div>
            <h1>Employee Management</h1>
            <p>Manage your team in one place</p>
          </div>
        </div>

        <button className="button button-primary" onClick={openCreateModal}>
          <span aria-hidden="true">＋</span> Add Employee
        </button>
      </header>

      {/* Welcome section */}
      <section className="welcome">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Employee Directory</h2>
          <p className="welcome-text">
            View employee records, manage details, and track status.
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={loadEmployees}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </section>

      {/* Employee statistics */}
      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Total Employees</span>
          <strong>{employees.length}</strong>
          <span className="stat-description">All employee records</span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Active Employees</span>
          <strong className="active-number">{activeCount}</strong>
          <span className="stat-description">Currently active</span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Inactive Employees</span>
          <strong className="inactive-number">{inactiveCount}</strong>
          <span className="stat-description">Currently inactive</span>
        </article>
      </section>

      {/* General error message */}
      {error && (
        <div className="alert alert-error" role="alert">
          <strong>Error:</strong> {error}
          <button
            className="alert-close"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Success message */}
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
          <button
            className="alert-close"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Employee directory */}
      <section className="directory-card">
        <div className="section-heading">
          <div>
            <h3>All Employees</h3>
            <p>Search and filter employee records.</p>
          </div>

          <span className="result-count">
            {filteredEmployees.length} results
          </span>
        </div>

        {/* Search and filters */}
        <div className="filters">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search name, email, or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <button className="button button-secondary" onClick={clearFilters}>
            Clear
          </button>
        </div>

        {/* Employee table states */}
        {loading ? (
          <div className="state-message">
            <div className="spinner" />
            <p>Loading employees...</p>
          </div>
        ) : error && employees.length === 0 ? (
          <div className="state-message">
            <p>Employees could not be loaded.</p>
            <button className="button button-primary" onClick={loadEmployees}>
              Try Again
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="state-message">
            <div className="empty-icon">⌕</div>
            <h4>No employees found</h4>
            <p>Try another search or add a new employee.</p>

            {employees.length > 0 && (
              <button
                className="button button-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th className="actions-heading">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => {
                  const status = normalizeStatus(employee.status);

                  return (
                    <tr key={employee.id}>
                      <td className="id-cell">#{employee.id}</td>

                      <td>
                        <div className="employee-cell">
                          <div className="avatar">
                            {(employee.name || "?")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="employee-info">
                            <strong>{employee.name || "Unnamed"}</strong>
                            <span>{employee.email || "No email"}</span>
                          </div>
                        </div>
                      </td>

                      <td>{employee.department || "—"}</td>

                      <td className="salary-cell">
                        {formatSalary(employee.salary)}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            status === "ACTIVE"
                              ? "status-active"
                              : status === "INACTIVE"
                                ? "status-inactive"
                                : "status-unknown"
                          }`}
                        >
                          <span className="status-dot" />
                          {status || "UNKNOWN"}
                        </span>
                      </td>

                      <td>
                       
<div className="row-actions">
  <button
    type="button"
    className="action-button audit-button"
    onClick={() => handleViewAudit(employee)}
    aria-label={`View audit history for ${employee.name}`}
  >
    Audit Report
  </button>

  <button
    type="button"
    className="action-button edit-button"
    onClick={() => openEditModal(employee)}
    aria-label={`Edit ${employee.name}`}
  >
    Edit
  </button>

  <button
    type="button"
    className="action-button delete-button"
    onClick={() => handleDelete(employee)}
    aria-label={`Delete ${employee.name}`}
  >
    Delete
  </button>
</div>

                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>
      </section>

      {/* Add/Edit employee modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {editingId !== null ? "UPDATE RECORD" : "NEW RECORD"}
                </p>

                <h3 id="modal-title">
                  {editingId !== null ? "Edit Employee" : "Add Employee"}
                </h3>

                <p>Enter the employee's details below.</p>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Full Name *</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Rahul Sharma"
                    maxLength={100}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Email Address *</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="rahul@example.com"
                    maxLength={150}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Department *</span>
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleFormChange}
                    placeholder="e.g. Engineering"
                    maxLength={100}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Salary (₹) *</span>
                  <input
                    type="number"
                    name="salary"
                    value={form.salary}
                    onChange={handleFormChange}
                    placeholder="e.g. 35000"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label className="form-field full-width">
                  <span>Employee Status *</span>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              {error && (
                <div className="alert alert-error modal-error" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Create Employee"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Employee audit report modal */}
      {auditOpen && (
        <div
          className="modal-overlay"
          onMouseDown={() => setAuditOpen(false)}
        >
          <section
            className="modal audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">EMPLOYEE HISTORY</p>
                <h3 id="audit-title">Audit Report</h3>
                <p>
                  {auditEmployee?.name} · Employee ID #{auditEmployee?.id}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() => setAuditOpen(false)}
                aria-label="Close audit report"
              >
                ×
              </button>
            </div>

            {auditLoading ? (
              <div className="state-message">
                <div className="spinner" />
                <p>Loading audit history...</p>
              </div>
            ) : auditError ? (
              <div className="alert alert-error" role="alert">
                {auditError}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="state-message">
                <h4>No audit records found</h4>
                <p>No audit entries were returned for this employee.</p>
              </div>
            ) : (
              <div className="audit-records">
                {auditLogs.map((log, index) => (
                  <article
                    className="audit-record"
                    key={log.id ?? `${auditEmployee?.id}-${index}`}
                  >
                    <div className="audit-record-heading">
                      <strong>
                        {log.action ||
                          log.eventType ||
                          log.operation ||
                          "Audit event"}
                      </strong>

                      <span>
                        {log.changedAt ||
                          log.timestamp ||
                          log.createdAt ||
                          log.changeDate ||
                          "Timestamp unavailable"}
                      </span>
                    </div>

                    <dl className="audit-fields">
                      {Object.entries(log).map(([key, value]) => (
                        <div className="audit-field" key={key}>
                          <dt>
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (character) =>
                                character.toUpperCase()
                              )}
                          </dt>

                          <dd>
                            {value == null
                              ? "—"
                              : typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setAuditOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="app-footer">
        Employee Management System <span>•</span> React + Spring Boot
      </footer>
    </main>
  );
}
