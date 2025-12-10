import { UserData, CalculatedStats, DietDay, WorkoutDay, DietMeal } from "../types";
import { GoogleGenAI } from "@google/genai";

const MODEL_ID = 'gemini-2.5-flash';

// --- Utilitários ---

/**
 * Limpa a resposta da IA para garantir que seja um JSON válido.
 * Remove blocos de código Markdown (```json ... ```) e espaços em branco.
 */
const cleanJsonResponse = (text: string): string => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  // Às vezes a IA coloca texto antes ou depois do JSON, tentamos extrair o array/objeto
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  
  if (firstBracket === -1 && firstBrace === -1) return cleaned;

  const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace) 
    ? firstBracket 
    : firstBrace;
    
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  
  const end = Math.max(lastBracket, lastBrace);

  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  
  return cleaned;
};

/**
 * Inicializa o cliente da API.
 * CRÍTICO: Deve ser chamado dentro das funções para garantir que process.env.API_KEY esteja disponível.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não detectada. Por favor, verifique a configuração do projeto.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Funções de Dieta ---

export const generateDietPlan = async (user: UserData, stats: CalculatedStats): Promise<DietDay[]> => {
  const ai = getAIClient();

  const systemInstruction = `
    Você é um Nutricionista Esportivo de elite do app Glyx Fitness.
    Objetivo: Criar um plano alimentar semanal (7 dias) focado em emagrecimento (${user.targetWeightLoss}kg meta).
    
    REGRAS RÍGIDAS DE OUTPUT:
    1. Retorne APENAS um JSON válido. Sem texto introdutório, sem explicações.
    2. Respeite a meta calórica: ~${stats.targetCalories} kcal/dia.
    3. Use SOMENTE os alimentos disponíveis: "${user.availableFoods}". Se faltar algo, sugira itens básicos e baratos.
    4. Estrutura de Macros: Alta proteína, carboidratos moderados, gorduras boas.
  `;

  const prompt = `
    Perfil do Paciente:
    - ${user.gender}, ${user.age} anos, ${user.weight}kg, ${user.height}cm.
    - Nível de Atividade: ${user.activityLevel}.
    
    Gere o JSON exato abaixo para 7 dias:
    [
      {
        "dayName": "Segunda-feira",
        "totalCalories": ${stats.targetCalories},
        "meals": [
          {
            "name": "Café da Manhã",
            "description": "Receita prática (ex: Ovos mexidos com...)",
            "calories": 400,
            "macros": { "protein": "25g", "carbs": "30g", "fats": "12g" }
          },
          ... (Almoço, Lanche, Jantar)
        ]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.6
      }
    });

    if (!response.text) throw new Error("Resposta vazia da IA.");
    return JSON.parse(cleanJsonResponse(response.text)) as DietDay[];
  } catch (error) {
    console.error("Erro Diet Plan:", error);
    throw new Error("Não foi possível gerar a dieta. Tente novamente.");
  }
};

export const regenerateMeal = async (user: UserData, currentMealName: string, targetCalories: number): Promise<DietMeal> => {
  const ai = getAIClient();

  const prompt = `
    Atue como Nutricionista. Substitua a refeição "${currentMealName}" por uma NOVA opção.
    - Calorias Alvo: ~${targetCalories} kcal.
    - Alimentos disponíveis: "${user.availableFoods}".
    - Retorne APENAS o JSON desta refeição.
    
    JSON Esperado:
    {
      "name": "Nome da Nova Opção",
      "description": "Ingredientes e preparo.",
      "calories": ${targetCalories},
      "macros": { "protein": "...", "carbs": "...", "fats": "..." }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    if (!response.text) throw new Error("Resposta vazia da IA.");
    return JSON.parse(cleanJsonResponse(response.text)) as DietMeal;
  } catch (error) {
    console.error("Erro Meal Regen:", error);
    throw error;
  }
};

// --- Funções de Treino ---

export const generateWorkoutPlan = async (user: UserData): Promise<WorkoutDay[]> => {
  const ai = getAIClient();

  // Lógica de adaptação baseada no tempo
  let timeStrategy = "";
  if (user.workoutDuration.includes("30min") || user.workoutDuration.includes("45min")) {
    timeStrategy = "ALTA INTENSIDADE (HIIT/Tabata), pouco descanso, Bi-sets. Máximo 4-5 exercícios focais.";
  } else if (user.workoutDuration.includes("1h")) {
    timeStrategy = "Hipertrofia Clássica. 6-7 exercícios, descanso de 60-90s.";
  } else {
    timeStrategy = "Volume Alto + Cardio Extenso. 8+ exercícios.";
  }

  const systemInstruction = `
    Você é um Personal Trainer do Glyx Fitness.
    Objetivo: Criar rotina para ${user.workoutDays} dias/semana.
    Foco Muscular: ${user.targetMuscles.join(', ')}.
    Tempo Disponível: ${user.workoutDuration}.
    Estratégia Obrigatória: ${timeStrategy}.
    
    REGRAS:
    1. Retorne APENAS JSON.
    2. Garanta que o treino caiba no tempo (${user.workoutDuration}).
    3. Evite fadiga excessiva em dias consecutivos (alterne grupos musculares se possível).
  `;

  const prompt = `
    Gere o JSON para ${user.workoutDays} dias de treino:
    [
      {
        "dayName": "Treino A",
        "focus": "Ex: Superiores",
        "duration": "${user.workoutDuration}",
        "cardio": "Detalhes do cardio (ex: 15min esteira)",
        "exercises": [
           { 
             "name": "Supino Reto", 
             "sets": 3, 
             "reps": "10-12", 
             "rest": "60s", 
             "notes": "Contraia o peitoral no topo." 
           }
        ]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.5
      }
    });

    if (!response.text) throw new Error("Resposta vazia da IA.");
    return JSON.parse(cleanJsonResponse(response.text)) as WorkoutDay[];
  } catch (error) {
    console.error("Erro Workout Gen:", error);
    throw new Error("Falha ao criar treino. Tente novamente.");
  }
};

export const regenerateWorkoutDay = async (user: UserData, currentDay: WorkoutDay, newDuration?: string): Promise<WorkoutDay> => {
  const ai = getAIClient();
  const duration = newDuration || currentDay.duration;

  const prompt = `
    Atue como Personal Trainer. Refaça o treino do dia "${currentDay.dayName}" (${currentDay.focus}).
    NOVA DURAÇÃO: ${duration}.
    
    Instruções:
    - Se o tempo diminuiu para 30/45min: Use Bi-sets, reduza descanso, corte exercícios isolados.
    - Se o tempo aumentou: Adicione volume e cardio.
    
    Retorne APENAS o JSON do dia:
    {
        "dayName": "${currentDay.dayName}",
        "focus": "${currentDay.focus}",
        "duration": "${duration}",
        "cardio": "...",
        "exercises": [ ... ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    if (!response.text) throw new Error("Resposta vazia da IA.");
    return JSON.parse(cleanJsonResponse(response.text)) as WorkoutDay;
  } catch (error) {
    console.error("Erro Workout Regen:", error);
    throw error;
  }
};
