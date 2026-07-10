import Auth from '~/components/auth';
import SubscribeDashboard from '~/components/subscribe-dashboard';

export default function Dashboard() {
  return (
    <Auth to="/dashboard">
      <SubscribeDashboard />
    </Auth>
  );
}
