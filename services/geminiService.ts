import { GoogleGenAI, Type } from "@google/genai";
import { UserData, CalculatedStats, DietDay, WorkoutDay, DietMeal } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Using gemini-2.5-flash as it is the most efficient/best free tier model currently.
const MODEL_ID = "gemini-2.5-flash";

export const generateDietPlan = async (user: UserData, stats: CalculatedStats): Promise<DietDay[]> => {
  const prompt = `
    Crie um plano de dieta semanal de 7 dias para uma pessoa com os seguintes dados:
    - Peso: ${user.weight}kg
    - Altura: ${user.height}cm
    - Idade: ${user.age} anos
    - Meta Diária de Calorias: ${stats.targetCalories} kcal (Déficit calórico para perda de peso)
    - Alimentos Disponíveis/Preferências: "${user.availableFoods}"
    
    O plano deve ser variado, saudável e focado em perda de gordura.
    Retorne APENAS um JSON válido seguindo estritamente o schema solicitado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayName: { type: Type.STRING, description: "Ex: Segunda-feira ou Dia 1" },
              totalCalories: { type: Type.NUMBER },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Ex: Café da Manhã" },
                    description: { type: Type.STRING, description: "Descrição detalhada dos alimentos" },
                    calories: { type: Type.NUMBER },
                    macros: {
                      type: Type.OBJECT,
                      properties: {
                        protein: { type: Type.STRING },
                        carbs: { type: Type.STRING },
                        fats: { type: Type.STRING },
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DietDay[];
    }
    throw new Error("Não foi possível gerar a dieta.");
  } catch (error) {
    console.error("Erro ao gerar dieta:", error);
    throw error;
  }
};

export const regenerateMeal = async (user: UserData, currentMealName: string, targetCalories: number): Promise<DietMeal> => {
  const prompt = `
    Crie uma UNICA opção de refeição substituta para o "${currentMealName}".
    - Meta calórica da refeição: Aproximadamente ${targetCalories} kcal.
    - Alimentos Disponíveis: "${user.availableFoods}"
    - Objetivo: Perda de gordura.
    
    Retorne APENAS um JSON válido para o objeto da refeição.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Mantenha o nome da refeição original" },
            description: { type: Type.STRING, description: "Nova descrição da refeição" },
            calories: { type: Type.NUMBER },
            macros: {
              type: Type.OBJECT,
              properties: {
                protein: { type: Type.STRING },
                carbs: { type: Type.STRING },
                fats: { type: Type.STRING },
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DietMeal;
    }
    throw new Error("Erro ao regenerar refeição.");
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export const generateWorkoutPlan = async (user: UserData): Promise<WorkoutDay[]> => {
  const prompt = `
    Crie um plano de treino personalizado para uma pessoa com foco em emagrecimento e definição.
    - Dias disponíveis: ${user.workoutDays} dias por semana.
    - Tempo disponível por treino: ${user.workoutDuration}.
    - Grupos musculares alvo: ${user.targetMuscles.join(', ')}.
    - Nível de atividade atual: ${user.activityLevel}.
    
    IMPORTANTE:
    - Respeite o limite de tempo informado (${user.workoutDuration}). Ajuste volume e intensidade para caber neste tempo.
    - O treino deve ser equilibrado para evitar fadiga muscular excessiva e prevenir lesões, considerando que o usuário está em déficit calórico.
    - Inclua musculação e cardio adequado ao tempo.
    
    Retorne APENAS um JSON válido seguindo estritamente o schema solicitado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayName: { type: Type.STRING, description: "Ex: Treino A" },
              focus: { type: Type.STRING, description: "Ex: Pernas e Glúteos" },
              duration: { type: Type.STRING, description: "Duração estimada em minutos" },
              cardio: { type: Type.STRING, description: "Instrução específica de cardio" },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    sets: { type: Type.NUMBER },
                    reps: { type: Type.STRING },
                    rest: { type: Type.STRING },
                    notes: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as WorkoutDay[];
    }
    throw new Error("Não foi possível gerar o treino.");
  } catch (error) {
    console.error("Erro ao gerar treino:", error);
    throw error;
  }
};

export const regenerateWorkoutDay = async (user: UserData, currentDay: WorkoutDay, newDuration?: string): Promise<WorkoutDay> => {
  const durationToUse = newDuration || currentDay.duration;

  const prompt = `
    Crie uma NOVA sequência de exercícios para substituir o treino de "${currentDay.dayName}".
    - Foco Muscular: ${currentDay.focus}
    - Duração Alvo: ${durationToUse} (IMPORTANTE: Ajuste o volume para caber neste novo tempo).
    - Objetivo: Perda de gordura e definição.
    - Mude os exercícios em relação ao comum, varie os estímulos.
    
    Retorne APENAS um JSON válido para o objeto do dia de treino.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dayName: { type: Type.STRING, description: "Mantenha o nome original" },
            focus: { type: Type.STRING, description: "Mesmo foco" },
            duration: { type: Type.STRING, description: "A duração solicitada" },
            cardio: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  sets: { type: Type.NUMBER },
                  reps: { type: Type.STRING },
                  rest: { type: Type.STRING },
                  notes: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as WorkoutDay;
    }
    throw new Error("Erro ao regenerar treino.");
  } catch (error) {
    console.error(error);
    throw error;
  }
};