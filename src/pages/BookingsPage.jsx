import RecordManagementPage from './RecordManagementPage.jsx';
import '../styles/BookingsPage.css';

export default function BookingsPage(props) {
  return <RecordManagementPage {...props} pageClass="bookings-page" />;
}