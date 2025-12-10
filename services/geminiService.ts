import { UserData, CalculatedStats, DietDay, WorkoutDay, DietMeal } from "../types";
import { GoogleGenAI } from "@google/genai";

const MODEL_ID = 'gemini-2.5-flash';

// Utility to clean AI response if it comes wrapped in markdown code blocks
const cleanJsonResponse = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const generateDietPlan = async (user: UserData, stats: CalculatedStats): Promise<DietDay[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    Atue como um Nutricionista Esportivo de alto nível especializado em emagrecimento e mudança de composição corporal.
    
    Sua missão: Criar um plano alimentar semanal (7 dias) EXTREMAMENTE detalhado e saboroso.
    
    Regras Críticas:
    1. O retorno DEVE ser estritamente um JSON válido.
    2. Não inclua nenhum texto antes ou depois do JSON.
    3. Respeite rigorosamente a meta calórica diária de ${stats.targetCalories} kcal.
    4. Priorize os alimentos que o usuário tem disponíveis: "${user.availableFoods}".
    5. Se os alimentos disponíveis forem escassos, sugira alimentos baratos e acessíveis (ovos, frango, arroz, feijão, vegetais da estação).
    6. Formato dos macros: Proteína (alta prioridade), Carboidratos (moderado), Gorduras (saudáveis).
  `;

  const prompt = `
    Gere o plano para:
    - Perfil: ${user.gender}, ${user.age} anos, ${user.weight}kg, ${user.height}cm.
    - Objetivo: Perda de gordura (${user.targetWeightLoss}kg alvo).
    
    Estrutura do JSON Obrigatória:
    [
      {
        "dayName": "Dia 1",
        "totalCalories": ${stats.targetCalories},
        "meals": [
          {
            "name": "Café da Manhã",
            "description": "Descrição apetitosa e quantidades exatas (ex: 2 ovos, 100g de mamão)",
            "calories": 350,
            "macros": { "protein": "20g", "carbs": "15g", "fats": "10g" }
          },
          ... (Almoço, Lanche, Jantar)
        ]
      },
      ... (até Dia 7)
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7 // Criatividade moderada para variar receitas
      }
    });

    if (response.text) {
      const cleanText = cleanJsonResponse(response.text);
      return JSON.parse(cleanText) as DietDay[];
    }
    throw new Error("A IA retornou uma resposta vazia.");
  } catch (error) {
    console.error("Critical Diet Gen Error:", error);
    throw new Error("Falha ao criar dieta. Verifique sua conexão e tente novamente.");
  }
};

export const regenerateMeal = async (user: UserData, currentMealName: string, targetCalories: number): Promise<DietMeal> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    Você é um Nutricionista focado em substituições inteligentes.
    O usuário quer trocar a refeição "${currentMealName}".
    Gere UMA nova opção que tenha aproximadamente ${targetCalories} kcal.
    Retorne APENAS um JSON válido.
  `;

  const prompt = `
    - Alimentos disponíveis: "${user.availableFoods}".
    - Foco: Manter a saciedade e o déficit calórico.
    - Gere uma receita diferente da anterior.
    
    Estrutura JSON:
    {
      "name": "${currentMealName} (Opção Alternativa)",
      "description": "Ingredientes e modo de preparo rápido.",
      "calories": ${targetCalories},
      "macros": { "protein": "...", "carbs": "...", "fats": "..." }
    }
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
      const cleanText = cleanJsonResponse(response.text);
      return JSON.parse(cleanText) as DietMeal;
    }
    throw new Error("Resposta vazia ao regenerar refeição.");
  } catch (error) {
    console.error("Meal Regen Error:", error);
    throw error;
  }
}

export const generateWorkoutPlan = async (user: UserData): Promise<WorkoutDay[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    Atue como um Treinador Físico de Elite (Personal Trainer).
    
    Sua missão: Criar um plano de treino periodizado para ${user.workoutDays} dias na semana.
    
    Regras de Ouro:
    1. Tempo disponível: ${user.workoutDuration} (CRÍTICO: O volume do treino deve caber neste tempo).
    2. Nível atual: ${user.activityLevel}.
    3. Objetivo: Emagrecimento com preservação de massa magra.
    4. Respeite os grupos musculares: ${user.targetMuscles.join(', ')}.
    5. Retorne APENAS JSON válido.
    
    Lógica de Tempo:
    - "Até 30min": Use super-séries, HIIT, pouco descanso. Max 4-5 exercícios.
    - "Até 1h": Treino padrão de hipertrofia/força. 6-7 exercícios.
    - "Mais de 1h": Volume alto, cardio extenso pós-treino.
  `;

  const prompt = `
    Gere a estrutura exata abaixo em JSON:
    [
      {
        "dayName": "Treino A - [Foco Principal]",
        "focus": "Ex: Pernas e Ombros",
        "duration": "${user.workoutDuration}",
        "cardio": "Instrução específica de cardio (ex: 20min esteira inclinada)",
        "exercises": [
           { 
             "name": "Nome do Exercício", 
             "sets": 3, 
             "reps": "12-15", 
             "rest": "45s", 
             "notes": "Dica técnica de execução ou cadência" 
           }
        ]
      }
    ]
    * Crie ${user.workoutDays} dias diferentes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.5 // Menos criativo, mais técnico e seguro
      }
    });

    if (response.text) {
      const cleanText = cleanJsonResponse(response.text);
      return JSON.parse(cleanText) as WorkoutDay[];
    }
    throw new Error("A IA retornou uma resposta vazia.");
  } catch (error) {
    console.error("Critical Workout Gen Error:", error);
    throw new Error("Falha ao criar treino. Tente novamente.");
  }
};

export const regenerateWorkoutDay = async (user: UserData, currentDay: WorkoutDay, newDuration?: string): Promise<WorkoutDay> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const durationToUse = newDuration || currentDay.duration;

  const systemInstruction = `
    Você é um Personal Trainer adaptando um treino.
    O usuário precisa mudar o treino de "${currentDay.focus}" para caber em "${durationToUse}".
    Retorne APENAS JSON válido.
  `;

  const prompt = `
    Reescreva o treino completo para o dia: ${currentDay.dayName}.
    
    Restrições:
    1. Mantenha o foco muscular: ${currentDay.focus}.
    2. NOVA DURAÇÃO: ${durationToUse}.
    3. Se o tempo diminuiu, aumente a intensidade e reduza o volume.
    4. Se o tempo aumentou, adicione mais séries ou exercícios acessórios.
    
    Estrutura JSON:
    {
        "dayName": "${currentDay.dayName}",
        "focus": "${currentDay.focus}",
        "duration": "${durationToUse}",
        "cardio": "Novo cardio ajustado ao tempo",
        "exercises": [ ... lista de exercícios atualizada ... ]
    }
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
      const cleanText = cleanJsonResponse(response.text);
      return JSON.parse(cleanText) as WorkoutDay;
    }
    throw new Error("Resposta vazia ao regenerar treino.");
  } catch (error) {
    console.error("Workout Regen Error:", error);
    throw error;
  }
};