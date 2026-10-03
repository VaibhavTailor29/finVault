import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Toast } from '../common/Toast';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useSettingsStore } from '../../store/useSettingsStore';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  title: string;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPath,
  onNavigate,
  title,
  children,
}) => {
  const { checkAndGenerateDueReminders } = useFinanceStore();
  const { reminderDaysBeforeDue } = useSettingsStore();

  useEffect(() => {
    checkAndGenerateDueReminders(reminderDaysBeforeDue);
  }, [checkAndGenerateDueReminders, reminderDaysBeforeDue]);
  return (
    <div className="flex h-screen h-dvh w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 font-sans transition-colors">
      {/* Sidebar for Desktop */}
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <Header currentTitle={title} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 pb-20 lg:pb-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav currentPath={currentPath} onNavigate={onNavigate} />

      {/* Toast Notification with Undo */}
      <Toast />
    </div>
  );
};
