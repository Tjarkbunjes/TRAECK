'use client';

import { useMemo } from 'react';
import { FrontBody } from './muscle-svg/FrontBody';
import { BackBody } from './muscle-svg/BackBody';
import { MUSCLE_GROUP_MAP } from '@/lib/muscle-mapping';

interface MuscleMapProps {
  muscleGroup: string;
  size?: number;
  view?: 'front' | 'back' | 'auto';
  className?: string;
}

export function MuscleMap({ muscleGroup, size = 48, view = 'auto', className }: MuscleMapProps) {
  const mapping = MUSCLE_GROUP_MAP[muscleGroup];

  const { primarySet, secondarySet, showView } = useMemo(() => {
    if (!mapping) return { primarySet: new Set<string>(), secondarySet: new Set<string>(), showView: 'front' as const };
    return {
      primarySet: new Set(mapping.primary),
      secondarySet: new Set(mapping.secondary),
      showView: view === 'auto' ? mapping.defaultView : view,
    };
  }, [mapping, view]);

  if (!mapping) return null;

  // Thumbnail: crop to torso (square). Full: show entire body (1:2 ratio).
  const isThumb = size < 80;
  const vb = isThumb ? '20 50 160 160' : '0 0 200 400';
  const height = isThumb ? size : size * 2;

  return (
    <svg
      viewBox={vb}
      width={size}
      height={height}
      className={className}
      aria-label={`${muscleGroup} muscles`}
    >
      {showView === 'front' ? (
        <FrontBody highlighted={primarySet} secondary={secondarySet} />
      ) : (
        <BackBody highlighted={primarySet} secondary={secondarySet} />
      )}
    </svg>
  );
}
