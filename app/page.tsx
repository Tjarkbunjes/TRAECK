'use client';

import { FitnessHome } from '@/components/FitnessHome';
import { CardsDashboard } from '@/features/cards/components/CardsDashboard';
import { useModules } from '@/lib/use-modules';

/** `/` is the cards dashboard unless the user has switched the fitness module back on. */
export default function RootPage() {
  const { modules } = useModules();
  return modules.fitness ? <FitnessHome /> : <CardsDashboard />;
}
