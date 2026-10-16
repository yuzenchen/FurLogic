import React from 'react';
import { Home } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

/** 今日(建置中,後續任務實作) */
export default function TodayPage() {
  return (
    <>
      <PageHeader title="今日" />
      <EmptyState icon={Home} title="建置中" />
    </>
  );
}
