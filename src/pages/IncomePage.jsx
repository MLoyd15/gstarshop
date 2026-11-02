import { useEffect, useState } from 'react';
import RecordManagementPage from './RecordManagementPage.jsx';
import '../styles/IncomePage.css';

export default function IncomePage(props) {
  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/records/bookings', { signal: controller.signal }).then((response) => response.json()).then(setBookings).catch(() => {});
    return () => controller.abort();
  }, []);
  const completedIncome = bookings.filter((booking) => booking.completion?.status === 'completed').map((booking) => ({
    id: `booking-income-${booking.id}`,
    name: `${booking.name || 'Booking'} (completed job)`,
    category: 'Completed booking',
    amount: booking.completion.revenueAmount ?? booking.amount,
    date: booking.completion.completionDate || booking.completion.completedAt || booking.updatedAt,
    createdAt: booking.updatedAt,
    booking
  }));
  return <RecordManagementPage {...props} records={[...props.records, ...completedIncome]} pageClass="income-page" />;
}
