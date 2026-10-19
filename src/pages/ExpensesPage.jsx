import RecordManagementPage from './RecordManagementPage.jsx';
import '../styles/ExpensesPage.css';

export default function ExpensesPage(props) {
  return <RecordManagementPage {...props} pageClass="expenses-page" />;
}