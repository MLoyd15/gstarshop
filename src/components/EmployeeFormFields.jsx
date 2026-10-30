import React, { useState } from 'react';
import '../styles/EmployeeForm.css';

const PAY_OPTIONS = [
  {
    type: 'monthly',
    title: 'Monthly salary',
    description: 'A fixed amount every month.'
  },
  {
    type: 'daily',
    title: 'Daily rate',
    description: 'Pay = days worked × rate.'
  },
  {
    type: 'hourly',
    title: 'Hourly rate',
    description: 'Pay = hours worked × rate.'
  }
];

export default function EmployeeFormFields({ record }) {
  const [salaryType, setSalaryType] = useState(record?.salaryType || 'hourly');

  const originalSalaryType = record ? (record.salaryType || 'hourly') : null;
  const isPayBasisChanged = Boolean(record && originalSalaryType && salaryType !== originalSalaryType);

  const hasExtras = Boolean(
    (record?.allowances && Number(record.allowances) !== 0) ||
    (record?.bonus && Number(record.bonus) !== 0) ||
    (record?.commission && Number(record.commission) !== 0) ||
    (record?.regularDeductions && Number(record.regularDeductions) !== 0)
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultEffectiveDate = record
    ? (record.effectiveDate ? String(record.effectiveDate).slice(0, 10) : '')
    : todayStr;

  const rateLabel =
    salaryType === 'monthly'
      ? 'Monthly salary (₱)'
      : salaryType === 'daily'
      ? 'Daily rate (₱)'
      : 'Hourly rate (₱)';

  return (
    <div className="employee-form">
      {/* 1. Who they are */}
      <div>
        <div className="employee-form-section-title">Who they are</div>
        <div className="employee-form-grid">
          <label className="employee-form-field">
            <span>Employee ID *</span>
            <input
              className="input"
              type="text"
              name="employeeId"
              placeholder="e.g. EMP-001"
              defaultValue={record?.employeeId || ''}
              required
            />
          </label>

          <label className="employee-form-field">
            <span>Full name *</span>
            <input
              className="input"
              type="text"
              name="name"
              placeholder="Full name"
              defaultValue={record?.name || ''}
              required
            />
          </label>

          <label className="employee-form-field">
            <span>Position</span>
            <input
              className="input"
              type="text"
              name="position"
              placeholder="Position or title"
              defaultValue={record?.position || ''}
            />
          </label>

          <label className="employee-form-field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              name="email"
              placeholder="name@company.com"
              defaultValue={record?.email || ''}
            />
          </label>

          <label className="employee-form-field">
            <span>Phone</span>
            <input
              className="input"
              type="tel"
              name="phone"
              placeholder="Phone number"
              defaultValue={record?.phone || ''}
            />
          </label>

          <label className="employee-form-field">
            <span>Status</span>
            <select
              className="select"
              name="status"
              defaultValue={record?.status || 'Active'}
            >
              <option value="Active">Active</option>
              <option value="On leave">On leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      {/* 2. How are they paid? */}
      <div>
        <div className="employee-form-section-title">How are they paid?</div>
        <div className="employee-pay-cards" role="radiogroup" aria-label="Pay basis">
          {PAY_OPTIONS.map((opt) => (
            <label
              key={opt.type}
              className={`employee-pay-card ${salaryType === opt.type ? 'selected' : ''}`}
            >
              <div className="employee-pay-card-header">
                <input
                  type="radio"
                  name="salaryType"
                  value={opt.type}
                  checked={salaryType === opt.type}
                  onChange={() => setSalaryType(opt.type)}
                />
                <span className="employee-pay-card-title">{opt.title}</span>
              </div>
              <span className="employee-pay-card-desc">{opt.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Basis change notice when editing */}
      {isPayBasisChanged && (
        <div className="employee-basis-notice" role="note">
          Existing payroll runs won't change. The new pay basis applies to future runs only.
        </div>
      )}

      {/* 3. Rate */}
      <div className="employee-rate-container">
        <label className="employee-form-field">
          <span>{rateLabel} *</span>
          <div className="input-with-prefix">
            <span className="input-prefix" aria-hidden="true">₱</span>
            <input
              className="input"
              type="number"
              name="salary"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={record?.salary ?? ''}
              required
            />
          </div>
        </label>
        {salaryType !== 'monthly' && (
          <span className="employee-rate-hint">
            You'll record days or hours on their monthly sheet.
          </span>
        )}
      </div>

      {/* 4. Optional extras */}
      <details className="employee-form-details" defaultOpen={hasExtras}>
        <summary>Optional extras: added or deducted every pay run</summary>
        <div className="employee-extras-grid" style={{ marginTop: '12px' }}>
          <label className="employee-form-field">
            <span>Regular allowances</span>
            <div className="input-with-prefix">
              <span className="input-prefix" aria-hidden="true">₱</span>
              <input
                className="input"
                type="number"
                name="allowances"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={record?.allowances ?? ''}
              />
            </div>
          </label>

          <label className="employee-form-field">
            <span>Regular bonus</span>
            <div className="input-with-prefix">
              <span className="input-prefix" aria-hidden="true">₱</span>
              <input
                className="input"
                type="number"
                name="bonus"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={record?.bonus ?? ''}
              />
            </div>
          </label>

          <label className="employee-form-field">
            <span>Regular commission</span>
            <div className="input-with-prefix">
              <span className="input-prefix" aria-hidden="true">₱</span>
              <input
                className="input"
                type="number"
                name="commission"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={record?.commission ?? ''}
              />
            </div>
          </label>

          <label className="employee-form-field">
            <span>Regular deductions</span>
            <div className="input-with-prefix">
              <span className="input-prefix" aria-hidden="true">₱</span>
              <input
                className="input"
                type="number"
                name="regularDeductions"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={record?.regularDeductions ?? ''}
              />
            </div>
          </label>
        </div>
      </details>

      {/* 5. Advanced */}
      <details className="employee-form-details">
        <summary>Advanced</summary>
        <div style={{ marginTop: '12px' }}>
          <label className="employee-form-field">
            <span>Rate effective date</span>
            <input
              className="input"
              type="date"
              name="effectiveDate"
              defaultValue={defaultEffectiveDate}
            />
          </label>
        </div>
      </details>
    </div>
  );
}

