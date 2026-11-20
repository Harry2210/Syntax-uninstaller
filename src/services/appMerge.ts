import { InstalledApp, WindowsApp } from '../types';

/**
 * Presents a Windows Store / MSIX package as a regular installed application.
 *
 * Claude, WhatsApp and other modern installers ship as MSIX packages, which
 * never appear in the classic `Uninstall` registry keys. Users expect to find
 * them in the same list, so the Uninstaller merges both inventories.
 */
export function windowsAppToInstalledApp(app: WindowsApp): InstalledApp {
  return {
    id: `msix:${app.package_full_name}`,
    name: app.name,
    publisher: app.publisher || 'Windows Store Package',
    version: app.version,
    install_date: '',
    install_location: app.install_location,
    estimated_size_kb: 0,
    uninstall_string: '',
    quiet_uninstall_string: '',
    display_icon: app.display_icon || '',
    registry_source: 'Windows App (MSIX)',
    architecture: 'x64',
    is_system_component: false,
    health_score: 100,
    health_notes: ['Windows Store / MSIX package — removed through the AppX deployment service'],
    package_full_name: app.package_full_name,
  };
}
