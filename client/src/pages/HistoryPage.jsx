import React from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

/** 紀錄(建置中,後續任務實作) */
export default function HistoryPage() {
  return (
    <>
      <PageHeader title="紀錄" />
      <EmptyState icon={BarChart3} title="建置中" />
    </>
  );
}
