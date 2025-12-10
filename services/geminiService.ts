import { UserData, CalculatedStats, DietDay, WorkoutDay, DietMeal } from "../types";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_ID = 'gemini-2.5-flash';

export const generateDietPlan = async (user: UserData, stats: CalculatedStats): Promise<DietDay[]> => {
  const systemInstruction = `
    Você é um nutricionista especialista em emagrecimento.
    Sua tarefa é gerar um plano de dieta semanal de 7 dias.
    Retorne APENAS um JSON válido.
    
    O formato do JSON deve ser EXATAMENTE um array de objetos como este:
    [
      {
        "dayName": "Dia 1",
        "totalCalories": 2000,
        "meals": [
          {
            "name": "Café da Manhã",
            "description": "2 ovos mexidos...",
            "calories": 300,
            "macros": { "protein": "20g", "carbs": "10g", "fats": "15g" }
          }
        ]
      }
    ]
  `;

  const prompt = `
    Crie uma dieta para:
    - Peso: ${user.weight}kg, Altura: ${user.height}cm, Idade: ${user.age}
    - Meta Diária: ${stats.targetCalories} kcal (Déficit para perda de gordura)
    - Alimentos Disponíveis: "${user.availableFoods}"
    
    O plano deve ser variado e saboroso.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DietDay[];
    }
    throw new Error("Resposta vazia da IA");
  } catch (error) {
    console.error("Erro ao gerar dieta:", error);
    throw error;
  }
};

export const regenerateMeal = async (user: UserData, currentMealName: string, targetCalories: number): Promise<DietMeal> => {
  const systemInstruction = `
    Você é um nutricionista. Gere uma única opção de refeição substituta.
    Retorne APENAS um JSON válido no seguinte formato:
    {
      "name": "Nome da Refeição",
      "description": "Descrição detalhada",
      "calories": 0,
      "macros": { "protein": "0g", "carbs": "0g", "fats": "0g" }
    }
  `;

  const prompt = `
    Substitua o "${currentMealName}".
    - Meta calórica: ~${targetCalories} kcal.
    - Alimentos: "${user.availableFoods}"
    - Foco: Perda de gordura.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DietMeal;
    }
    throw new Error("Resposta vazia da IA");
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export const generateWorkoutPlan = async (user: UserData): Promise<WorkoutDay[]> => {
  const systemInstruction = `
    Você é um personal trainer de elite.
    Gere um plano de treino semanal.
    Retorne APENAS um JSON válido.
    
    O formato deve ser EXATAMENTE um array de objetos:
    [
      {
        "dayName": "Treino A",
        "focus": "Pernas",
        "duration": "Até 1h",
        "cardio": "20min caminhada",
        "exercises": [
           { "name": "Agachamento", "sets": 3, "reps": "12", "rest": "60s", "notes": "Desça devagar" }
        ]
      }
    ]
  `;

  const prompt = `
    Crie um treino para emagrecimento e definição:
    - Dias por semana: ${user.workoutDays}
    - Tempo disponível: ${user.workoutDuration}
    - Grupos musculares alvo: ${user.targetMuscles.join(', ')}
    - Nível de atividade: ${user.activityLevel}
    
    IMPORTANTE: Respeite rigorosamente o tempo de ${user.workoutDuration}. Ajuste o volume (séries) para caber.
    Inclua musculação e cardio.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as WorkoutDay[];
    }
    throw new Error("Resposta vazia da IA");
  } catch (error) {
    console.error("Erro ao gerar treino:", error);
    throw error;
  }
};

export const regenerateWorkoutDay = async (user: UserData, currentDay: WorkoutDay, newDuration?: string): Promise<WorkoutDay> => {
  const durationToUse = newDuration || currentDay.duration;

  const systemInstruction = `
    Você é um personal trainer. Gere APENAS um dia de treino para substituir o atual.
    Retorne APENAS um JSON válido no seguinte formato:
    {
        "dayName": "Treino X",
        "focus": "...",
        "duration": "...",
        "cardio": "...",
        "exercises": [ ... ]
    }
  `;

  const prompt = `
    Crie uma NOVA sequência para o dia "${currentDay.dayName}".
    - Foco Muscular: ${currentDay.focus}
    - Duração Alvo: ${durationToUse} (CRÍTICO: Ajuste para caber neste tempo).
    - Objetivo: Perda de gordura.
    - Varie os exercícios em relação ao comum.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as WorkoutDay;
    }
    throw new Error("Resposta vazia da IA");
  } catch (error) {
    console.error(error);
    throw error;
  }
};
