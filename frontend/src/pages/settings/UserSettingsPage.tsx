import { Bell, Building2, Package, User } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import SettingsBentoTile from '../../components/settings/SettingsBentoTile';
import { usePermissions } from '../../hooks/usePermissions';

export default function UserSettingsPage() {
  const { canAccessSettings } = usePermissions();

  return (
    <PageContainer>
      <div className="mb-10 sm:mb-12">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, preferences, assets, and organization"
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
        {canAccessSettings && (
          <SettingsBentoTile
            to="/admin/settings"
            icon={Building2}
            title="Organization"
            description="Configure DigiDesk, ticket rules, notifications, email, and ITAM."
          />
        )}
      </div>
    </PageContainer>
  );
}
