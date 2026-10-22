# Financial Overview and Payroll Roadmap

## Audit status

The existing baseline test suite passed before changes (15/15). The audit below is based on the current source; database contents and production accounting practice have not been verified.

| Area | Confirmed source of truth and current behavior | Confirmed gap or limitation |
| --- | --- | --- |
| Sales / income | `BusinessRecord` entries with resource `income`; the dashboard sums each `data.amount` and charts entries by `data.date` (falling back to record creation). | These are generic records, not a verified invoice or recognized-sales ledger. There are no invoice/charge records or customer payment allocations, so revenue recognition, cash collection, and customer balances cannot be reliably separated. |
| Operating expenses | `BusinessRecord` entries with resource `expenses`; payroll payment recording maintains one linked expense with cumulative paid amount. | Other expenses are generic and can overlap with material costs or other resources. There is no documented expense recognition policy, category aggregation, or reliable previous-period comparison. |
| Purchases / inventory | Purchase orders store ordered subtotal, receipts, and `paidAmount`; receipts add inventory and supplier price history. Completed bookings record job use/waste movements and material cost using average cost at completion. | Supplier payments do not currently create finance records. The dashboard also subtracts completed-job material costs from generic expenses, so manually recorded material expenses can be double-counted. |
| Bookings | A booking becomes completed only after actual used/waste quantities are recorded; its completion stores material costs and stock movement references. | Booking amounts are not authoritative sales charges; the dashboard correctly does not treat booking totals as revenue. No customer invoice/payment records exist. |
| Dashboard | `/api/dashboard` now calculates selected-month generic income, ordinary expense categories, completed-job material costs, payroll payments by payment date, selected payroll obligations, previous-month comparison, and a six-month series. The main and G4 compact dashboards share the endpoint. | Profit remains unavailable because income recognition and overlap between generic expenses and job material costs are unverified. Customer receivables lack invoice/payment allocations. Supplier payment dates are not stored. The endpoint performs a selected-resource query and server-side calculation, not a MongoDB aggregation pipeline. |
| Payroll calculation | `calculatePayroll` uses monthly/daily/hourly base pay, configured allowances/bonus/commission/other earnings, and deductions. Hourly sheets calculate regular and configured overtime rates; advances are carried and applied against earned pay. | Daily-rate employees are explicitly skipped by payroll generation. No statutory rules are implemented or verified. Hourly overtime rates and other payroll rules are business-configured; legal compliance has not been established. |
| Payroll lifecycle | Runs are generated as `draft`, editable/deletable only as drafts, then `finalized`, and can be partially/fully paid or reversed before any payment. Employee sheets lock once a run exists. Payslips print values from the run record and an employee snapshot. | There are no separate Reviewed and Approved states or approval actor/history. Finalize is the current approval/lock action. A payment was previously written to the payroll run and linked expense in separate non-transactional writes, leaving a concurrency and partial-write risk. |
| Payroll payment records | Successful payments are embedded in the payroll run and linked to a payroll expense. The UI supplies a payment ID and the endpoint previously treated a repeated ID as idempotent. | The old read/check/write sequence was not safe under simultaneous requests, and a request without an ID received a new server-generated ID on each retry. No route-level concurrency integration test exists yet. |

## Current phase

- [x] Run existing tests before changes (15/15 passed).
- [x] Make payroll payment posting transactional across the run and its linked expense.
- [x] Require a stable payment ID; treat an identical retry as idempotent and reject reuse of an ID for a different payment.
- [x] Add unit tests for retry idempotency, changed-payload conflict, balance limits, and final paid status.
- [x] Add the new selected-month dashboard with separate income, expenses, material costs, payroll payments, category detail, payroll obligations, and previous-month comparison.
- [x] Show unsupported profit, receivables, and supplier payment timing as explicit data limitations instead of estimated numbers.
- [x] Add dashboard tests for empty periods, month boundaries, reversed records, payroll payment deduplication, and cost separation.
- [x] Re-run tests and production build after this phase.

No database schema migration was introduced. The transaction uses the existing payroll payment array and expense record. It relies on MongoDB transaction support, which the booking and purchase routes already use.

## Confirmed issues to address next

1. Document and implement a finance policy before calculating profit: define income recognition, expense recognition, purchase treatment, material COGS, and payroll expense recognition so the same costs are not subtracted twice.
2. Decide on the smallest customer charge/payment model only after confirming the existing live data and business workflow; there is no current invoice/payment allocation schema.
3. Add dated supplier payment history only after confirming how legacy cumulative `paidAmount` values should be treated; the current schema cannot reconstruct past payment dates.
4. Complete payroll lifecycle/audit history and missing daily-pay workflow only after confirming intended policy and transition rules. Keep current pay formulas unchanged until official applicable requirements are checked.
5. Add route-level MongoDB transaction integration tests, including simultaneous payment requests and rollback when expense recording fails.

## Items requiring verification

- Whether generic income entries are intended to mean sales recognized, cash collected, or either depending on entry.
- Whether any operators record material purchases or completed-job costs manually in expenses.
- Whether purchase orders are used as obligations, cash disbursements, or both in the business's books.
- Whether partial customer payments, invoice due dates, or other receivables exist outside this repository.
- The applicable jurisdiction and current official payroll rules, including minimum pay, overtime, statutory deductions, and required payslip fields.
- Production MongoDB replica-set/transaction configuration and live legacy payroll/expense records, including any payroll accrual expenses.

## Planned implementation order

1. Confirm the accounting policy and inspect representative data without modifying history.
2. Build a tested server calculation layer for period summaries and clearly label unsupported revenue/receivable metrics.
3. Add the financial overview to the existing dashboard and route to supporting lists.
4. Extend payroll states/history around the existing draft/finalize/payment model, then address daily-pay support only after rule confirmation.
5. Improve payroll summaries and print layout using immutable run snapshots.
6. Verify finance/payroll integration, transaction failure behavior, month boundaries, reversals, and dashboard/report parity.
