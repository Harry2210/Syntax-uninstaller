import React, { useState } from 'react';
import { EyeOff, AlertTriangle, ShieldCheck, Play, HardDrive, Info } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface EvidenceRemoverPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const EvidenceRemoverPage: React.FC<EvidenceRemoverPageProps> = ({ onLogNotification }) => {
  const [selectedDrive, setSelectedDrive] = useState('C:');
  const [wipeMethod, setWipeMethod] = useState<'single' | 'dod'>('single');
  const [isWiping, setIsWiping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStartWipe = async () => {
    setShowConfirm(false);
    setIsWiping(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsWiping(false);
    onLogNotification(
      'Evidence Sanitization Complete',
      `Free space sanitization completed for drive ${selectedDrive} using ${wipeMethod === 'dod' ? 'DoD 5220.22-M 3-pass' : 'Pseudorandom 1-pass'}.`,
      'success'
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-danger/15 text-danger rounded-2xl">
            <EyeOff className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Free Space Evidence Sanitizer</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Permanently overwrite unallocated disk space so previously deleted files cannot be restored by undelete software.
            </p>
          </div>
        </div>

        <button
          disabled={isWiping}
          onClick={() => setShowConfirm(true)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-danger hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isWiping ? 'Wiping Free Clusters...' : 'Sanitize Free Space'}</span>
        </button>
      </div>

      {/* Storage and SSD Hardware Notice */}
      <div className="p-4 bg-surface rounded-2xl border border-border flex items-start space-x-3 text-xs leading-relaxed">
        <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-text-primary">Modern SSD & Hardware Wear-Leveling Transparency:</span>
          <p className="text-text-secondary">
            Modern Solid State Drives (SSDs) utilize internal flash controllers with wear-leveling and TRIM commands that redirect logical block writes. Overwrite patterns will sanitize visible free sectors, while operating systems with BitLocker encryption enabled naturally maintain data secrecy at rest.
          </p>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
          Sanitization Parameters
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-text-muted mb-1 font-medium">Select Drive Volume</label>
            <select
              value={selectedDrive}
              onChange={(e) => setSelectedDrive(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="C:">Local Disk (C:) — NTFS</option>
              <option value="D:">Secondary Storage (D:) — NTFS</option>
            </select>
          </div>

          <div>
            <label className="block text-text-muted mb-1 font-medium">Sanitization Standard</label>
            <select
              value={wipeMethod}
              onChange={(e) => setWipeMethod(e.target.value as any)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="single">Single Pass Overwrite (Pseudorandom 0x00 / 0xFF) — Fastest</option>
              <option value="dod">DoD 5220.22-M 3-Pass Overwrite — Thorough</option>
            </select>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showConfirm}
        title={`Sanitize Drive ${selectedDrive} Free Space`}
        message="This operation will allocate and fill free disk space with overwrite patterns to render previously deleted records irrecoverable. Existing files will not be touched."
        confirmText="Start Free Space Wipe"
        cancelText="Cancel"
        isDangerous={false}
        onConfirm={handleStartWipe}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
