# Monthly absence deduction rate

- **Intent:** Let payroll users choose the amount charged for each absent day from the employee monthly sheet, and keep that amount as the employee default for future months.
- **Goals:** Provide a clear control in the monthly attendance view; recalculate the current absence deduction immediately; persist the rate on the employee record so later sheets use it.
- **Non-goals:** Change attendance marking, working-day divisor rules, or other deduction types.
- **Constraints:** Existing monthly payroll derives `perDayDeduction` from monthly salary divided by working days and computes absence deduction from absent days. The employee sheet is loaded and saved through `/api/payroll/employees/:employeeId/sheet`.
- **Approaches:** (1) Make the per-day rate editable inline on every monthly sheet; (2) add a “Set absence rate” control in the monthly sheet that updates the employee default. Chosen: approach 2, as requested, so the control is explicit and the saved default carries forward.
- **Implementation calls:** Store the configured rate on the employee record, use the salary-derived rate when no custom value exists, validate the saved value as a non-negative money amount, and calculate current/future absence deductions from the configured rate times absent days.
