import RecordManagementPage from './RecordManagementPage.jsx';
import '../styles/IncomePage.css';

export default function IncomePage(props) {
  return <><div className="income-accounting-note">Use this page for non-booking income only. Booking sales are recorded when a job is completed, and customer payments are tracked on the booking.</div><RecordManagementPage {...props} pageClass="income-page" /></>;
}
