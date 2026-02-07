import type { TemplateExercise } from './types';

export interface DefaultTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    id: 'traeck-push',
    name: 'Push Day',
    exercises: [
      { exercise_name: 'Bench Press (Barbell)', muscle_group: 'chest', default_sets: 3 },
      { exercise_name: 'Incline Bench Press (Dumbbell)', muscle_group: 'chest', default_sets: 3 },
      { exercise_name: 'Lateral Raise (Dumbbell)', muscle_group: 'shoulders', default_sets: 3 },
      { exercise_name: 'Tricep Pushdown (Bar)', muscle_group: 'arms', default_sets: 3 },
      { exercise_name: 'Tricep Pushdown (Rope)', muscle_group: 'arms', default_sets: 3 },
    ],
  },
  {
    id: 'traeck-pull',
    name: 'Pull Day',
    exercises: [
      { exercise_name: 'Lat Pulldown (Neutral, Close)', muscle_group: 'back', default_sets: 3 },
      { exercise_name: 'Cable Row (Wide)', muscle_group: 'back', default_sets: 3 },
      { exercise_name: 'Bicep Curls (EZ-Bar)', muscle_group: 'arms', default_sets: 3 },
      { exercise_name: 'Bicep Curls (Dumbbell, Seated)', muscle_group: 'arms', default_sets: 3 },
    ],
  },
  {
    id: 'traeck-legs',
    name: 'Leg Day',
    exercises: [
      { exercise_name: 'Leg Curl (Seated)', muscle_group: 'legs', default_sets: 3 },
      { exercise_name: 'Leg Press (45°)', muscle_group: 'legs', default_sets: 3 },
      { exercise_name: 'Leg Extension', muscle_group: 'legs', default_sets: 3 },
      { exercise_name: 'Hip Abductor', muscle_group: 'legs', default_sets: 3 },
      { exercise_name: 'Hip Adductor', muscle_group: 'legs', default_sets: 3 },
    ],
  },
];
