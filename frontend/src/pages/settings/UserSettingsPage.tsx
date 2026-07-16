import { Bell, Package, User } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import SettingsBentoTile from '../../components/settings/SettingsBentoTile';

export default function UserSettingsPage() {
  return (
    <PageContainer>
      <div className="mb-10 sm:mb-12">
        <PageHeader
          title="Settings"
          subtitle="Manage your account and how DigiDesk notifies you"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsBentoTile
          to="/settings/account"
          icon={User}
          title="Account"
          description="Name, email, and password for your DigiDesk login."
        />
        <SettingsBentoTile
          to="/settings/notifications"
          icon={Bell}
          title="Notifications"
          description="Choose which email and in-app alerts you want to receive."
        />
        <SettingsBentoTile
          to="/my-assets"
          icon={Package}
          title="My Assets"
          description="View assigned gear, request loans, and report problems."
        />
      </div>
    </PageContainer>
  );
}
