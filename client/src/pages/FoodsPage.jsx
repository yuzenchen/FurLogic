import React from 'react';
import { Apple } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

/** 食材(建置中,後續任務實作) */
export default function FoodsPage() {
  return (
    <>
      <PageHeader title="食材" />
      <EmptyState icon={Apple} title="建置中" />
    </>
  );
}
