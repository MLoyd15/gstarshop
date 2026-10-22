import '../../../styles/PayrollPage.css';
import MockFrame from '../MockFrame.jsx';
import Callout from '../Callout.jsx';
import { payRun, php } from '../mockData.js';

function PayRunPreview() {
  return (
    <MockFrame variant="guide-mock-payroll">
      <section className="payroll-page">
        <header className="payroll-heading">
          <div><div className="payroll-eyebrow">PAYROLL SYSTEM</div><h1>Pay runs</h1><p>Prepare, review, finalize, and track employee payments.</p></div>
          <div className="payroll-heading-actions"><label>Pay period<input type="month" value={payRun.period} readOnly /></label><Callout n={1}><button className="payroll-primary" type="button">＋ Generate payroll</button></Callout></div>
        </header>
        <div className="payroll-summary">
          <article><span>Gross earnings</span><strong>{php(payRun.grossPay)}</strong></article>
          <article><span>Net payroll</span><strong>{php(payRun.netPay)}</strong></article>
          <article><span>Outstanding</span><strong>{php(payRun.balance)}</strong></article>
        </div>
        <div className="payroll-panel">
          <div className="payroll-toolbar"><div><h2>Payroll records</h2><p>1 employee record for {payRun.period}</p></div></div>
          <div className="payroll-table-wrap"><table><thead><tr><th>Employee</th><th>Gross</th><th>Net pay</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody><tr><td><strong>{payRun.employee}</strong><small>{payRun.employeeId}</small></td><td>{php(payRun.grossPay)}</td><td><strong>{php(payRun.netPay)}</strong></td><td><span className={`payroll-status ${payRun.status}`}>{payRun.status}</span></td><td><Callout n={2}><button type="button">Finalize</button></Callout></td></tr></tbody>
          </table></div>
        </div>
        <div className="guide-mock-payrun-next"><span>After the run is finalized</span><Callout n={3}><button type="button">Record payment</button></Callout></div>
      </section>
    </MockFrame>
  );
}

export default PayRunPreview;
