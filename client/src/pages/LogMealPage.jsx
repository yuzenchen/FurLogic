import React from 'react';
import { Plus } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

/** 記一餐(建置中,後續任務實作) */
export default function LogMealPage() {
  return (
    <>
      <PageHeader title="記一餐" />
      <EmptyState icon={Plus} title="建置中" />
    </>
  );
}
