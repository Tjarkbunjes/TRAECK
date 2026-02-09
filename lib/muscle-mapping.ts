// Maps exercise muscleGroup to SVG region IDs with primary/secondary highlighting
export const MUSCLE_GROUP_MAP: Record<string, {
  primary: string[];
  secondary: string[];
  defaultView: 'front' | 'back';
}> = {
  chest:     { primary: ['chest'], secondary: ['shoulders-front', 'triceps'], defaultView: 'front' },
  back:      { primary: ['back-upper', 'back-lower'], secondary: ['biceps', 'rear-delts'], defaultView: 'back' },
  shoulders: { primary: ['shoulders-front', 'rear-delts'], secondary: ['traps', 'triceps'], defaultView: 'front' },
  legs:      { primary: ['quads', 'hamstrings', 'glutes'], secondary: ['calves-front', 'calves-back'], defaultView: 'front' },
  arms:      { primary: ['biceps', 'triceps'], secondary: ['forearms-front', 'forearms-back'], defaultView: 'front' },
  core:      { primary: ['abs', 'obliques'], secondary: ['back-lower'], defaultView: 'front' },
  cardio:    { primary: [], secondary: [], defaultView: 'front' },
};

export const FRONT_MUSCLES = new Set([
  'chest', 'shoulders-front', 'biceps', 'forearms-front',
  'abs', 'obliques', 'quads', 'calves-front',
]);

export const BACK_MUSCLES = new Set([
  'traps', 'rear-delts', 'back-upper', 'back-lower',
  'triceps', 'forearms-back', 'glutes', 'hamstrings', 'calves-back',
]);
