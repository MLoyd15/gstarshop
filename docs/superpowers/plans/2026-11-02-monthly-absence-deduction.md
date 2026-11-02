# Monthly absence deduction rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure an employee’s per-absent-day deduction from the monthly sheet and use it for current and future absence calculations.

**Architecture:** Store optional `absenceDeductionPerDay` on the employee record. Return it with the employee sheet payload, let the monthly sheet edit and submit it, validate and persist it server-side, and make the shared monthly calculator accept an optional per-day override while preserving salary-derived defaults.

**Tech Stack:** React, Express, Mongoose, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-02-monthly-absence-deduction-design.md`

## Global Constraints

- Preserve the salary-derived rate for employees without a custom value.
- Apply the chosen per-day rate to absent days and persist it as the employee default.
- Validate saved money amounts as non-negative.

## Review Focus

- Existing employees without the property retain the old salary/working-day calculation (test calculator fallback).
- Custom rate is multiplied by current absent-day count (test calculator override).
- Invalid negative or malformed values are rejected by the API (test validation).
- The rate is carried back in GET and PUT sheet responses (route coverage where practical).
- Non-monthly payroll behavior remains unchanged (existing tests).

---

### Task 1: Payroll calculation and validation

**Files:**
- Modify: `server/services/payroll.js`
- Test: `server/services/payroll.test.js`

**Interfaces:** `calculateMonthlyPay` accepts optional `perDayDeduction`; absence deduction is rounded from `absentDays * perDayDeduction`. Omitted override uses salary divided by working days.

- [ ] Add a test for a custom per-day amount and unchanged fallback behavior.
- [ ] Run `node --test server/services/payroll.test.js` and confirm the new override case fails first.
- [ ] Implement optional rate validation and calculation.
- [ ] Run `node --test server/services/payroll.test.js` and confirm all tests pass.

### Task 2: Persist employee default in sheet API

**Files:**
- Modify: `server/routes/payroll.js`
- Test: `server/routes/routes.test.js` or payroll route tests if present

**Interfaces:** GET sheet returns `absenceDeductionPerDay` from employee data or calculated fallback; PUT accepts optional `absenceDeductionPerDay`, validates it, saves it on the employee, and uses it in the monthly sheet calculation.

- [ ] Add/update route coverage for save, return, and invalid input.
- [ ] Implement persistence and use `monthly.perDayDeduction` consistently for current sheet snapshot totals.
- [ ] Run the focused route tests.

### Task 3: Monthly sheet control

**Files:**
- Modify: `src/pages/EmployeeMonthlySheet.jsx`
- Modify: `src/styles/EmployeeMonthlySheet.css`

- [ ] Initialize editable rate from GET sheet response and send it in monthly PUT payload.
- [ ] Add a “Set absence rate” control near monthly attendance/summary; show the current rate and update the live absence deduction estimate when changed.
- [ ] Keep the control disabled when the sheet is locked or saving.
- [ ] Run the project build and relevant payroll tests.
