import React, { useState } from 'react';
import { History } from 'lucide-react';
import { Button, Card } from './ui';
import { importLegacyPet } from '../api/client';
import { usePet } from '../context/PetContext';
import {
  clearLegacyData,
  dismissLegacyImport,
  isLegacyImportDismissed,
  readLegacyPetProfile,
} from '../utils/storage';

/** 舊版(localStorage)毛孩資料匯入提示,僅在有舊資料且未略過時顯示 */
export default function LegacyImportBanner() {
  const { refetch } = usePet();
  const [legacy, setLegacy] = useState(() =>
    isLegacyImportDismissed() ? null : readLegacyPetProfile(),
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  if (!legacy) return null;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const { name, weight, isNeutered, activityLevel } = legacy;
      await importLegacyPet({
        petProfile: { name, weight, isNeutered, activityLevel },
      });
      refetch();
      clearLegacyData();
      setLegacy(null);
    } catch (err) {
      setError(err?.message || '匯入失敗,請稍後再試');
      setImporting(false);
    }
  };

  const handleDismiss = () => {
    dismissLegacyImport();
    setLegacy(null);
  };

  return (
    <Card as="section" aria-labelledby="legacy-import-title" className="mb-4">
      <div className="flex items-start gap-3">
        <History
          size={22}
          className="mt-0.5 shrink-0 text-orange-500"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 id="legacy-import-title" className="font-semibold text-stone-900">
            發現舊版資料
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {legacy.name}・<span className="tabular-nums">{legacy.weight}</span>{' '}
            kg,要匯入到新版嗎?
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={handleDismiss} disabled={importing}>
          略過
        </Button>
        <Button onClick={handleImport} loading={importing}>
          匯入
        </Button>
      </div>
    </Card>
  );
}
