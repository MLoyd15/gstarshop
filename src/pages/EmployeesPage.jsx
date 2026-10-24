import { useMemo, useState } from 'react';
import '../styles/EmployeesPage.css';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

export default function EmployeesPage({ employees = [], loading, search, setSearch, onCreate, onEdit, onDelete, onSelect }) {
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name');
  const listed = useMemo(() => employees
    .filter((employee) => status === 'all' || String(employee.status || 'Active').toLowerCase() === status)
    .slice().sort((a, b) => sort === 'name'
      ? String(a.name || '').localeCompare(String(b.name || ''))
      : new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)), [employees, sort, status]);
  const activeCount = employees.filter((employee) => !['inactive','terminated'].includes(String(employee.status || 'active').toLowerCase())).length;
  return <section className="employees-page">
    <header className="employees-welcome"><div><span className="t-eyebrow">PAYROLL SYSTEM</span><h1 className="t-page-title">Employees</h1><p>Keep employee details, hourly rates, and monthly work sheets together.</p></div><button className="employees-primary" onClick={onCreate}>＋ Add employee</button></header>
    <div className="employees-summary"><article><span>All employees</span><strong>{employees.length}</strong></article><article><span>Active employees</span><strong>{activeCount}</strong></article><article><span>Payroll basis</span><strong>Hourly</strong><small>New employees default to hourly pay</small></article></div>
    <section className="employees-panel"><header className="employees-toolbar"><div><h2>Employee directory</h2><p>{listed.length} {listed.length === 1 ? 'employee' : 'employees'} · Click a name to open the monthly sheet.</p></div><div className="employees-filters"><label><span className="sr-only">Search employees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees…" /></label><select aria-label="Filter employee status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="on leave">On leave</option><option value="inactive">Inactive</option></select><select aria-label="Sort employees" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="latest">Recently updated</option></select></div></header>
      {loading ? <div className="employees-empty">Loading employees…</div> : !listed.length ? <div className="employees-empty"><strong>{employees.length ? 'No matching employees' : 'No employees yet'}</strong><p>{employees.length ? 'Change the search or status filter.' : 'Add an employee to start tracking hours and payroll advances.'}</p>{!employees.length && <button className="employees-primary" onClick={onCreate}>＋ Add employee</button>}</div> : <div className="employee-cards">{listed.map((employee) => <article className="employee-card" key={employee.id}>
        <header className="employee-card-heading"><div className="employee-avatar">{String(employee.name || '?').trim().split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div><div className="employee-card-name"><button onClick={() => onSelect(employee)}>{employee.name || 'Unnamed employee'}</button><span>{employee.position || 'Employee'} · ID {employee.employeeId || '—'}</span></div><span className={`employee-state ${String(employee.status || 'Active').toLowerCase().replace(/\s+/g,'-')}`}>{employee.status || 'Active'}</span></header>
        <div className="employee-pay-highlight"><span>{employee.salaryType === 'hourly' ? 'Hourly rate' : employee.salaryType === 'daily' ? 'Daily rate' : 'Monthly rate'}</span><strong>{money(employee.salary ?? employee.baseRate)}</strong><small>per {employee.salaryType === 'hourly' ? 'hour' : employee.salaryType === 'daily' ? 'day' : 'month'}</small></div>
        <div className="employee-contact"><span>{employee.email || 'No email added'}</span><span>{employee.phone || 'No phone added'}</span></div>
        <div className="employee-extras">{[['Allowances',employee.allowances],['Bonus',employee.bonus],['Commission',employee.commission],['Regular deductions',employee.regularDeductions]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}</div>
        <footer className="employee-card-actions"><button className="employee-sheet-action" onClick={() => onSelect(employee)}>Open monthly sheet</button><button onClick={() => onEdit(employee)}>Edit</button><button className="employee-delete-action" onClick={() => onDelete(employee)}>Delete</button></footer>
      </article>)}</div>}
    </section>
  </section>;
}
