export enum Gender {
  MALE = 'Masculino',
  FEMALE = 'Feminino'
}

export enum ActivityLevel {
  SEDENTARY = 'Sedentário (pouco ou nenhum exercício)',
  LIGHTLY_ACTIVE = 'Levemente ativo (exercício leve 1-3 dias/semana)',
  MODERATELY_ACTIVE = 'Moderadamente ativo (exercício moderado 3-5 dias/semana)',
  VERY_ACTIVE = 'Muito ativo (exercício pesado 6-7 dias/semana)',
  EXTRA_ACTIVE = 'Extremamente ativo (exercício muito pesado/trabalho físico)'
}

export enum DeficitLevel {
  LIGHT = 'Leve',
  MODERATE = 'Moderado',
  AGGRESSIVE = 'Alta'
}

export interface UserData {
  name: string;
  email: string;
  age: number;
  weight: number; // kg
  height: number; // cm
  gender: Gender;
  activityLevel: ActivityLevel;
  targetWeightLoss: number; // kg
  availableFoods: string;
  workoutDays: number;
  workoutDuration: string; // New field
  targetMuscles: string[];
}

export interface CalculatedStats {
  bmr: number; // Basal Metabolic Rate
  tdee: number; // Total Daily Energy Expenditure
  targetCalories: number; // Daily caloric intake for weight loss
  weeksToGoal: number;
}

export interface DietMeal {
  name: string;
  description: string;
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
}

export interface DietDay {
  dayName: string;
  totalCalories: number;
  meals: DietMeal[];
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes: string;
}

export interface WorkoutDay {
  dayName: string;
  focus: string;
  duration: string;
  exercises: Exercise[];
  cardio: string;
}