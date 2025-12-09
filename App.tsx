import React, { useState, useEffect } from 'react';
import { UserData, Gender, ActivityLevel, CalculatedStats, DietDay, WorkoutDay, DeficitLevel } from './types';
import { generateDietPlan, generateWorkoutPlan, regenerateMeal, regenerateWorkoutDay } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { StepIndicator } from './components/StepIndicator';
import { 
  Activity, 
  ChevronRight, 
  Scale, 
  Utensils, 
  Dumbbell, 
  HeartPulse, 
  AlertCircle,
  Loader2,
  Apple,
  Save,
  Lock,
  Zap,
  LayoutDashboard,
  ChevronDown,
  User,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Mail,
  Clock,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Feather,
  Flame,
  Dna,
  History,
  LogIn,
  ArrowLeft,
  X
} from 'lucide-react';

// --- Helper Functions for Calculations ---
const calculateStats = (user: UserData, deficitLevel: DeficitLevel = DeficitLevel.MODERATE): CalculatedStats => {
  // Mifflin-St Jeor Equation
  let bmr = (10 * user.weight) + (6.25 * user.height) - (5 * user.age);
  
  if (user.gender === Gender.MALE) {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  let activityMultiplier = 1.2;
  switch (user.activityLevel) {
    case ActivityLevel.SEDENTARY: activityMultiplier = 1.2; break;
    case ActivityLevel.LIGHTLY_ACTIVE: activityMultiplier = 1.375; break;
    case ActivityLevel.MODERATELY_ACTIVE: activityMultiplier = 1.55; break;
    case ActivityLevel.VERY_ACTIVE: activityMultiplier = 1.725; break;
    case ActivityLevel.EXTRA_ACTIVE: activityMultiplier = 1.9; break;
  }

  const tdee = Math.round(bmr * activityMultiplier);
  
  // Dynamic Deficit Calculation
  let deficitPercentage = 0.20; // Default Moderate (20%)
  
  switch (deficitLevel) {
    case DeficitLevel.LIGHT:
      deficitPercentage = 0.10; // 10% deficit
      break;
    case DeficitLevel.MODERATE:
      deficitPercentage = 0.20; // 20% deficit
      break;
    case DeficitLevel.AGGRESSIVE:
      deficitPercentage = 0.30; // 30% deficit
      break;
  }

  const targetCalories = Math.round(tdee * (1 - deficitPercentage)); 
  
  // Estimate: 7700kcal deficit = 1kg fat
  const weeklyDeficit = (tdee - targetCalories) * 7;
  // Prevent division by zero if targetWeightLoss is 0, though input should prevent this
  const weeksToGoal = user.targetWeightLoss > 0 
    ? Math.ceil((user.targetWeightLoss * 7700) / (weeklyDeficit || 1)) 
    : 0;

  return { bmr: Math.round(bmr), tdee, targetCalories, weeksToGoal };
};

const initialUser: UserData = {
  name: '',
  email: '',
  age: 30,
  weight: 90,
  height: 175,
  gender: Gender.MALE,
  activityLevel: ActivityLevel.SEDENTARY,
  targetWeightLoss: 10,
  availableFoods: '',
  workoutDays: 3,
  workoutDuration: 'Até 1h',
  targetMuscles: [],
};

const muscleGroups = [
  "Peitoral", "Costas", "Pernas (Quadríceps)", "Posterior de Coxa", 
  "Glúteos", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Cardio Intenso"
];

const workoutDurations = [
  "Até 30min", "Até 45min", "Até 1h", "Até 1h30", "Até 2h"
];

// --- Reusable View Components ---

const DietListView: React.FC<{ 
  dietPlan: DietDay[]; 
  onRegenerateMeal?: (dayIdx: number, mealIdx: number) => Promise<void>; 
}> = ({ dietPlan, onRegenerateMeal }) => {
  
  // Track loading state for specific meals: "dayIndex-mealIndex"
  const [loadingMeals, setLoadingMeals] = useState<Record<string, boolean>>({});
  // Track collapsed state for days (index -> boolean).
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});

  const handleRegenerateClick = async (dayIdx: number, mealIdx: number) => {
    if (!onRegenerateMeal) return;
    
    const key = `${dayIdx}-${mealIdx}`;
    setLoadingMeals(prev => ({ ...prev, [key]: true }));
    try {
      await onRegenerateMeal(dayIdx, mealIdx);
    } finally {
      setLoadingMeals(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleDay = (idx: number) => {
    setCollapsedDays(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6">
      {dietPlan.map((day, dayIdx) => {
        const isCollapsed = collapsedDays[dayIdx];

        return (
          <div key={dayIdx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
            <button 
              onClick={() => toggleDay(dayIdx)}
              className="w-full bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                  <ChevronRight className="text-gray-400" size={20} />
                </div>
                <h3 className="font-bold text-lg text-gray-800">{day.dayName}</h3>
              </div>
              <span className="text-sm font-medium text-secondary bg-green-50 px-3 py-1 rounded-full border border-green-100">
                ~{day.totalCalories} kcal
              </span>
            </button>
            
            {!isCollapsed && (
              <div className="divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                {day.meals.map((meal, mealIdx) => {
                  const isLoading = loadingMeals[`${dayIdx}-${mealIdx}`];
                  
                  return (
                    <div key={mealIdx} className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-700 text-lg">{meal.name}</h4>
                          {onRegenerateMeal && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRegenerateClick(dayIdx, mealIdx); }}
                              disabled={isLoading}
                              className="text-gray-400 hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
                              title="Gerar nova opção para esta refeição"
                            >
                              {isLoading ? <Loader2 size={16} className="animate-spin text-primary" /> : <RefreshCw size={16} />}
                            </button>
                          )}
                        </div>
                        <span className="text-sm font-bold text-primary bg-sky-50 px-3 py-1 rounded-lg border border-sky-100 whitespace-nowrap shadow-sm">
                          {meal.calories} kcal
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">{meal.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span> 
                          Proteína: {meal.macros.protein}
                        </span>
                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          <span className="w-2 h-2 rounded-full bg-yellow-400"></span> 
                          Carboidratos: {meal.macros.carbs}
                        </span>
                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span> 
                          Gorduras: {meal.macros.fats}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const WorkoutListView: React.FC<{ 
  workoutPlan: WorkoutDay[];
  onRegenerateDay?: (dayIdx: number) => Promise<void>;
  onDurationChange?: (dayIdx: number, newDuration: string) => Promise<void>;
}> = ({ workoutPlan, onRegenerateDay, onDurationChange }) => {
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const [loadingDays, setLoadingDays] = useState<Record<number, boolean>>({});

  const toggleDay = (idx: number) => {
    setCollapsedDays(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleRegenerateClick = async (dayIdx: number) => {
    if (!onRegenerateDay) return;
    
    setLoadingDays(prev => ({ ...prev, [dayIdx]: true }));
    try {
      await onRegenerateDay(dayIdx);
    } finally {
      setLoadingDays(prev => ({ ...prev, [dayIdx]: false }));
    }
  };

  const handleDurationChangeClick = async (dayIdx: number, duration: string) => {
    if (!onDurationChange) return;
    setLoadingDays(prev => ({ ...prev, [dayIdx]: true }));
    try {
      await onDurationChange(dayIdx, duration);
    } finally {
      setLoadingDays(prev => ({ ...prev, [dayIdx]: false }));
    }
  }

  return (
    <div className="grid gap-6">
      {workoutPlan.map((day, idx) => {
        const isCollapsed = collapsedDays[idx];
        const isLoading = loadingDays[idx];

        return (
          <div key={idx} className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-accent transition-all duration-300">
            <button 
              onClick={() => toggleDay(idx)}
              className="w-full p-6 bg-indigo-50/50 border-b border-indigo-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:bg-indigo-50 transition-colors text-left"
            >
              <div className="flex items-start gap-4">
                 <div className={`mt-1 text-indigo-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                    <ChevronRight size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-xl text-gray-800">{day.dayName}</h3>
                    <p className="text-accent font-medium mt-1">{day.focus}</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-2 self-start md:self-auto">
                 {/* Duration Badge with Icon */}
                 <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100">
                    <Clock size={16} className="text-accent" /> 
                    <span className="whitespace-nowrap">{day.duration}</span>
                 </div>

                 {/* Action Buttons Group */}
                 {(onDurationChange || onRegenerateDay) && (
                   <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-100 ml-2">
                      {/* Change Duration Button (Hidden Select Trick) */}
                      {onDurationChange && (
                        <div 
                          className="relative p-2 border-r border-gray-100 hover:bg-gray-50 cursor-pointer group" 
                          title="Alterar tempo disponível"
                          onClick={(e) => e.stopPropagation()}
                        >
                           <History size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                           <select 
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              value={day.duration}
                              onChange={(e) => handleDurationChangeClick(idx, e.target.value)}
                              disabled={isLoading}
                           >
                              {workoutDurations.map(d => (
                                <option key={d} value={d} className="bg-white text-gray-900">{d}</option>
                              ))}
                           </select>
                        </div>
                      )}

                      {/* Regenerate Button */}
                      {onRegenerateDay && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); handleRegenerateClick(idx); }}
                          className="p-2 hover:bg-gray-50 cursor-pointer group"
                          title="Gerar nova sequência"
                        >
                          {isLoading ? (
                            <Loader2 size={18} className="animate-spin text-indigo-600" />
                          ) : (
                            <RefreshCw size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                          )}
                        </div>
                      )}
                   </div>
                 )}
              </div>
            </button>
            
            {!isCollapsed && (
              <div className="p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Cardio Section */}
                <div className="mb-6 bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <h4 className="font-bold text-rose-700 text-xs uppercase tracking-wide mb-2 flex items-center gap-2">
                     <HeartPulse size={14} /> Cardio
                  </h4>
                  <p className="text-gray-800 font-medium text-sm">{day.cardio}</p>
                </div>

                {/* Exercises */}
                <div className="space-y-4">
                  {day.exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 hover:border-gray-200">
                      
                      {/* Sets & Reps Highlight */}
                      <div className="flex gap-2 shrink-0">
                        <div className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg w-16 h-16 shadow-sm">
                           <span className="text-xl font-black text-gray-800 leading-none">{ex.sets}</span>
                           <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Séries</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg min-w-[4rem] px-2 h-16 shadow-sm">
                           <span className="text-lg font-black text-gray-800 leading-none text-center">{ex.reps}</span>
                           <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Reps</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-gray-800 text-lg mb-1 truncate">{ex.name}</h5>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 flex items-center gap-1 whitespace-nowrap">
                            <Activity size={10}/> Descanso: {ex.rest}
                          </span>
                          {ex.notes && (
                            <p className="text-sm text-gray-500 italic border-l-2 border-gray-300 pl-2 line-clamp-2">
                              {ex.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const StatsCard: React.FC<{ stats: CalculatedStats | null; user: UserData; deficitLevel: DeficitLevel }> = ({ stats, user, deficitLevel }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
      <h3 className="text-gray-500 font-medium text-sm uppercase">Taxa Metabólica Basal</h3>
      <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.bmr} <span className="text-sm font-normal text-gray-400">kcal/dia</span></p>
      <p className="text-xs text-gray-500 mt-2">O que você queima em repouso absoluto.</p>
    </div>
    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-500">
      <h3 className="text-gray-500 font-medium text-sm uppercase">Gasto Energético Total</h3>
      <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.tdee} <span className="text-sm font-normal text-gray-400">kcal/dia</span></p>
      <p className="text-xs text-gray-500 mt-2">Nível: {user.activityLevel.split(' ')[0]}</p>
    </div>
    <div className="bg-gradient-to-br from-primary to-secondary p-6 rounded-xl shadow-md text-white">
      <h3 className="font-medium text-sm uppercase opacity-90">Meta Diária (Déficit {deficitLevel})</h3>
      <p className="text-4xl font-bold mt-2">{stats?.targetCalories} <span className="text-sm font-normal opacity-80">kcal</span></p>
      <p className="text-xs mt-2 opacity-90">Perda estimada de {user.targetWeightLoss}kg em {stats?.weeksToGoal} semanas.</p>
    </div>
  </div>
);

// --- Screen Components ---

interface AnamnesisModalProps {
  onConfirm: () => void;
  isOpen: boolean;
}

const AnamnesisModal: React.FC<AnamnesisModalProps> = ({ onConfirm, isOpen }) => {
  const [agreed, setAgreed] = useState(false);
  const [q1, setQ1] = useState(false);
  const [q2, setQ2] = useState(false);
  const [q3, setQ3] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative overflow-y-auto max-h-[90vh]">
        <div className="flex items-center gap-3 mb-6">
           <div className="bg-red-100 p-2 rounded-full">
              <ShieldCheck className="text-red-600" size={28} />
           </div>
           <h2 className="text-2xl font-bold text-gray-800">Anamnese e Segurança</h2>
        </div>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          Antes de iniciarmos, precisamos garantir que você está apto a realizar atividades físicas e seguir uma dieta. Por favor, responda com sinceridade.
        </p>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input type="checkbox" className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary" checked={q1} onChange={e => setQ1(e.target.checked)} />
            <span className="text-sm text-gray-700">Afirmo que não tenho problemas cardíacos diagnosticados que me impeçam de treinar.</span>
          </label>
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input type="checkbox" className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary" checked={q2} onChange={e => setQ2(e.target.checked)} />
            <span className="text-sm text-gray-700">Afirmo que não sinto dores no peito ou tonturas frequentes ao realizar esforço físico.</span>
          </label>
           <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input type="checkbox" className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary" checked={q3} onChange={e => setQ3(e.target.checked)} />
            <span className="text-sm text-gray-700">Afirmo que não possuo lesões ósseas ou articulares graves que possam piorar com a atividade física sugerida.</span>
          </label>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-secondary rounded border-gray-300 focus:ring-secondary"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-800">
              Eu confirmo que todas as informações acima são verdadeiras e assumo total responsabilidade pela execução dos treinos e dieta sugeridos pelo aplicativo. Entendo que o Glyx Fitness é uma ferramenta de suporte e não substitui acompanhamento médico profissional.
            </span>
          </label>
        </div>

        <button 
          onClick={onConfirm}
          disabled={!agreed || !q1 || !q2 || !q3}
          className="w-full bg-primary hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar e Prosseguir
        </button>
      </div>
    </div>
  );
};

interface ProfileEditModalProps {
  user: UserData;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: UserData) => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ user, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<UserData>(user);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if(isOpen) setFormData(user);
  }, [isOpen, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
       await onSave(formData);
       onClose();
    } catch (e) {
      alert("Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
           <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
           <User className="text-primary" /> Editar Perfil
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input type="text" className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
           </div>
           
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
              <input type="number" className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.age || ''} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})} />
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
               <select className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as Gender})}>
                 <option value={Gender.MALE}>Masculino</option>
                 <option value={Gender.FEMALE}>Feminino</option>
               </select>
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input type="number" className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: parseFloat(e.target.value) || 0})} />
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
              <input type="number" className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.height || ''} onChange={e => setFormData({...formData, height: parseInt(e.target.value) || 0})} />
           </div>

           <div className="md:col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">Meta de Perda (kg)</label>
             <input type="number" className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.targetWeightLoss || ''} onChange={e => setFormData({...formData, targetWeightLoss: parseFloat(e.target.value) || 0})} />
           </div>

           <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Atividade</label>
              <select className="w-full px-4 py-2 bg-gray-100 rounded-lg" value={formData.activityLevel} onChange={e => setFormData({...formData, activityLevel: e.target.value as ActivityLevel})}>
                {Object.values(ActivityLevel).map(level => <option key={level} value={level}>{level}</option>)}
              </select>
           </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 bg-primary hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
};


interface OnboardingProps {
  user: UserData;
  setUser: (u: UserData) => void;
  onNext: () => void;
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ user, setUser, onNext }) => (
  <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Vamos começar sua transformação</h1>
      <p className="text-gray-500">Preencha seus dados corporais para iniciarmos a análise.</p>
    </div>

    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 pb-2 border-b">
      <Scale className="text-primary" /> Dados Pessoais
    </h2>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
        <input 
          type="text" 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.name} 
          onChange={e => setUser({...user, name: e.target.value})} 
          placeholder="Como gostaria de ser chamado?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
        <input 
          type="number" 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.age || ''} 
          onChange={e => setUser({...user, age: parseInt(e.target.value) || 0})} 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
        <select 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.gender}
          onChange={e => setUser({...user, gender: e.target.value as Gender})}
        >
          <option value={Gender.MALE}>Masculino</option>
          <option value={Gender.FEMALE}>Feminino</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Peso Atual (kg)</label>
        <input 
          type="number" 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.weight || ''} 
          onChange={e => setUser({...user, weight: parseFloat(e.target.value) || 0})} 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
        <input 
          type="number" 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.height || ''} 
          onChange={e => setUser({...user, height: parseInt(e.target.value) || 0})} 
        />
      </div>

      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo: Perder Quantos Kgs?</label>
        <div className="relative">
          <input 
            type="number" 
            className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors pl-12"
            value={user.targetWeightLoss || ''} 
            onChange={e => setUser({...user, targetWeightLoss: parseFloat(e.target.value) || 0})} 
          />
          <span className="absolute left-4 top-2 text-gray-900 font-bold text-sm">- KG</span>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Atividade</label>
        <select 
          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-colors"
          value={user.activityLevel}
          onChange={e => setUser({...user, activityLevel: e.target.value as ActivityLevel})}
        >
          {Object.values(ActivityLevel).map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="mt-8 flex justify-end">
      <button 
        onClick={onNext}
        disabled={!user.name}
        className="bg-primary hover:bg-sky-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Gerar Análise <ChevronRight size={18} />
      </button>
    </div>
  </div>
);

interface AnalysisProps {
  stats: CalculatedStats | null;
  user: UserData;
  deficitLevel: DeficitLevel;
  onDeficitChange: (level: DeficitLevel) => void;
  onBack: () => void;
  onNext: () => void;
}

const AnalysisScreen: React.FC<AnalysisProps> = ({ stats, user, deficitLevel, onDeficitChange, onBack, onNext }) => (
  <div className="max-w-3xl mx-auto">
    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Diagnóstico Metabólico</h2>
    
    <StatsCard stats={stats} user={user} deficitLevel={deficitLevel} />

    {/* Deficit Level Selection - Enhanced */}
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-yellow-100 rounded-lg">
           <Zap className="text-yellow-600" size={20} />
        </div>
        <div>
           <h3 className="font-bold text-gray-800 text-lg">Defina seu Ritmo</h3>
           <p className="text-xs text-gray-500">Qual a intensidade do seu déficit calórico?</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onDeficitChange(DeficitLevel.LIGHT)}
          className={`relative p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group ${
            deficitLevel === DeficitLevel.LIGHT 
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200 ring-offset-2 scale-[1.02]' 
              : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <div className={`p-3 rounded-xl w-fit transition-colors ${deficitLevel === DeficitLevel.LIGHT ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-gray-100 text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-500'}`}>
             <Feather size={24} />
          </div>
          <div>
            <h4 className={`font-bold text-lg mb-1 ${deficitLevel === DeficitLevel.LIGHT ? 'text-emerald-900' : 'text-gray-700'}`}>Leve</h4>
            <p className="text-sm text-gray-500 leading-snug">Perda gradual. Ideal para manter massa magra e evitar fome.</p>
          </div>
          {deficitLevel === DeficitLevel.LIGHT && <div className="absolute top-4 right-4 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>}
        </button>

        <button
           onClick={() => onDeficitChange(DeficitLevel.MODERATE)}
           className={`relative p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group ${
            deficitLevel === DeficitLevel.MODERATE 
              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200 ring-offset-2 scale-[1.02]' 
              : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
          }`}
        >
           <div className={`p-3 rounded-xl w-fit transition-colors ${deficitLevel === DeficitLevel.MODERATE ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
             <Zap size={24} />
          </div>
          <div>
            <h4 className={`font-bold text-lg mb-1 ${deficitLevel === DeficitLevel.MODERATE ? 'text-blue-900' : 'text-gray-700'}`}>Moderada</h4>
            <p className="text-sm text-gray-500 leading-snug">O padrão ouro. Equilíbrio perfeito entre resultado e bem-estar.</p>
          </div>
          {deficitLevel === DeficitLevel.MODERATE && <div className="absolute top-4 right-4 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>}
        </button>

        <button
           onClick={() => onDeficitChange(DeficitLevel.AGGRESSIVE)}
           className={`relative p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group ${
            deficitLevel === DeficitLevel.AGGRESSIVE
              ? 'border-red-500 bg-red-50/50 ring-2 ring-red-200 ring-offset-2 scale-[1.02]' 
              : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/30'
          }`}
        >
          <div className={`p-3 rounded-xl w-fit transition-colors ${deficitLevel === DeficitLevel.AGGRESSIVE ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-400 group-hover:bg-red-100 group-hover:text-red-500'}`}>
             <Flame size={24} />
          </div>
          <div>
            <h4 className={`font-bold text-lg mb-1 ${deficitLevel === DeficitLevel.AGGRESSIVE ? 'text-red-900' : 'text-gray-700'}`}>Intensa</h4>
            <p className="text-sm text-gray-500 leading-snug">Máxima queima de gordura. Requer disciplina ferrenha.</p>
          </div>
           {deficitLevel === DeficitLevel.AGGRESSIVE && <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
        </button>
      </div>
    </div>

    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl mb-8 flex items-start gap-4">
      <HeartPulse className="text-indigo-600 shrink-0 mt-1" />
      <div>
        <h4 className="font-bold text-indigo-800 mb-1">Estratégia de Perda de Gordura</h4>
        <p className="text-indigo-700 text-sm leading-relaxed">
          Para combater a obesidade de forma sustentável, aplicamos um déficit calórico moderado aliado a exercícios. 
          Isso garante que você perca gordura preservando massa magra, essencial para manter o metabolismo acelerado.
        </p>
      </div>
    </div>

    <div className="flex justify-between items-center">
       <button onClick={onBack} className="text-gray-500 hover:text-gray-800 px-4">Voltar</button>
       <button 
        onClick={onNext}
        className="bg-secondary hover:bg-emerald-600 text-white text-lg font-semibold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
      >
        <Utensils size={20} /> Montar Dieta Personalizada
      </button>
    </div>
  </div>
);

interface FoodInputProps {
  user: UserData;
  setUser: (u: UserData) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string;
  onBack: () => void;
}

const FoodInputScreen: React.FC<FoodInputProps> = ({ user, setUser, onGenerate, loading, error, onBack }) => (
  <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
    <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <Apple className="text-secondary" /> Preferências Alimentares
    </h2>
    <p className="text-gray-600 mb-6">
      Para que a dieta seja realista, liste os alimentos que você tem em casa, gosta de comer ou tem facilidade para comprar.
      A IA usará isso para criar receitas práticas.
    </p>

    <textarea
      className="w-full h-40 p-4 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 focus:bg-white focus:ring-2 focus:ring-secondary outline-none transition-all resize-none"
      placeholder="Ex: Frango, ovos, arroz, feijão, alface, tomate, banana, aveia, iogurte, pão integral..."
      value={user.availableFoods}
      onChange={e => setUser({...user, availableFoods: e.target.value})}
    ></textarea>

    {error && (
      <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
        <AlertCircle size={16} /> {error}
      </div>
    )}

    <div className="mt-6 flex justify-between">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-800 px-4">Voltar</button>
      <button 
        onClick={onGenerate}
        disabled={!user.availableFoods || loading}
        className="bg-secondary hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
      >
        {loading ? <Loader2 className="animate-spin" /> : 'Gerar Plano Alimentar'}
      </button>
    </div>
  </div>
);

interface DietPlanProps {
  dietPlan: DietDay[] | null;
  stats: CalculatedStats | null;
  onRegenerateMeal: (dayIdx: number, mealIdx: number) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
  isEditing?: boolean;
}

const DietPlanScreen: React.FC<DietPlanProps> = ({ dietPlan, stats, onRegenerateMeal, onBack, onNext, isEditing }) => (
  <div className="max-w-4xl mx-auto">
    <h2 className="text-3xl font-bold text-gray-800 mb-2">Seu Plano Alimentar Semanal</h2>
    <p className="text-gray-500 mb-8">Baseado em {stats?.targetCalories} calorias diárias.</p>

    {dietPlan ? <DietListView dietPlan={dietPlan} onRegenerateMeal={onRegenerateMeal} /> : <div className="text-center p-10 text-gray-500">Nenhum plano gerado. Tente novamente.</div>}

    <div className="mt-10 flex justify-center pb-10 gap-4">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-800 px-4">Voltar</button>
      <button 
        onClick={onNext}
        className={`${isEditing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-accent hover:bg-indigo-600'} text-white text-lg font-semibold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2`}
      >
        {isEditing ? (
          <><Save size={20} /> Salvar Alterações</>
        ) : (
          <><Dumbbell size={20} /> Ir para Treinamento</>
        )}
      </button>
    </div>
  </div>
);

interface WorkoutSetupProps {
  user: UserData;
  setUser: (u: UserData) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string;
  onBack: () => void;
}

const WorkoutSetupScreen: React.FC<WorkoutSetupProps> = ({ user, setUser, onGenerate, loading, error, onBack }) => {
  const toggleMuscle = (m: string) => {
    if (user.targetMuscles.includes(m)) {
      setUser({...user, targetMuscles: user.targetMuscles.filter(tm => tm !== m)});
    } else {
      setUser({...user, targetMuscles: [...user.targetMuscles, m]});
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Dumbbell className="text-accent" /> Configurar Treino
      </h2>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Disponibilidade Semanal (Dias)</label>
        <div className="flex justify-between gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map(num => (
            <button
              key={num}
              onClick={() => setUser({...user, workoutDays: num})}
              className={`min-w-[40px] w-full py-3 rounded-lg font-semibold transition-all ${
                user.workoutDays === num 
                ? 'bg-accent text-white shadow-md' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Tempo Disponível por Treino</label>
        <div className="grid grid-cols-2 gap-2">
          {workoutDurations.map(duration => (
            <button
              key={duration}
              onClick={() => setUser({...user, workoutDuration: duration})}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                user.workoutDuration === duration 
                ? 'bg-accent text-white shadow-md' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {duration}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Foco Muscular / Preferências</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {muscleGroups.map(muscle => (
            <button
              key={muscle}
              onClick={() => toggleMuscle(muscle)}
              className={`text-sm py-2 px-3 rounded-lg border transition-all text-left ${
                user.targetMuscles.includes(muscle)
                ? 'bg-indigo-50 border-accent text-accent font-medium'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {muscle}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 px-4">Voltar</button>
        <button 
          onClick={onGenerate}
          disabled={user.targetMuscles.length === 0 || loading}
          className="bg-accent hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-70"
        >
           {loading ? <Loader2 className="animate-spin" /> : 'Gerar Treino Personalizado'}
        </button>
      </div>
    </div>
  );
};

interface WorkoutPlanProps {
  workoutPlan: WorkoutDay[] | null;
  onRegenerateDay: (dayIdx: number) => Promise<void>;
  onDurationChange: (dayIdx: number, duration: string) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
  isEditing?: boolean;
}

const WorkoutPlanScreen: React.FC<WorkoutPlanProps> = ({ workoutPlan, onRegenerateDay, onDurationChange, onBack, onNext, isEditing }) => (
  <div className="max-w-4xl mx-auto pb-10">
    <div className="text-center mb-10">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Seu Treino Personalizado</h2>
      <p className="text-gray-500">Combinação de cardio e força para maximizar a queima de gordura.</p>
    </div>

    {workoutPlan ? <WorkoutListView workoutPlan={workoutPlan} onRegenerateDay={onRegenerateDay} onDurationChange={onDurationChange} /> : <div className="text-center">Erro no treino.</div>}

    <div className="mt-12 flex justify-center gap-4">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-800 px-4">Voltar</button>
      <button 
        onClick={onNext}
        className={`${isEditing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'} text-white text-lg font-semibold py-4 px-10 rounded-full shadow-xl transition-all hover:scale-105 flex items-center gap-2 ${!isEditing && 'animate-bounce'}`}
      >
        {isEditing ? (
          <><Save size={24} /> Salvar Alterações</>
        ) : (
          <><CheckCircle2 size={24} /> Confirmar e Salvar Plano</>
        )}
      </button>
    </div>
  </div>
);

interface AuthProps {
  user: UserData;
  setUser: (u: UserData) => void;
  onComplete: () => void;
  isLoginMode: boolean; // True if logging in from header, False if registering after flow
  dietPlan: DietDay[] | null;
  workoutPlan: WorkoutDay[] | null;
  onBack: () => void;
}

const AuthScreen: React.FC<AuthProps> = ({ user, setUser, onComplete, isLoginMode, dietPlan, workoutPlan, onBack }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (isLoginMode) {
        // --- LOGIN FLOW ---
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password,
        });

        if (signInError) throw signInError;

        onComplete();

      } else {
        // --- REGISTRATION FLOW ---
        // 1. Sign Up
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: user.email,
          password: password,
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Erro na criação do usuário.");

        const userId = authData.user.id;

        // 2. Create Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            name: user.name,
            age: user.age,
            weight: user.weight,
            height: user.height,
            gender: user.gender,
            activity_level: user.activityLevel,
            target_weight_loss: user.targetWeightLoss,
            available_foods: user.availableFoods,
            workout_days: user.workoutDays,
            workout_duration: user.workoutDuration,
            target_muscles: user.targetMuscles
          });

        if (profileError) throw profileError;

        // 3. Save Diet Plan
        if (dietPlan) {
          const { error: dietError } = await supabase
            .from('plans')
            .insert({
              user_id: userId,
              type: 'diet',
              data: JSON.stringify(dietPlan)
            });
          if (dietError) console.error("Erro ao salvar dieta", dietError);
        }

        // 4. Save Workout Plan
        if (workoutPlan) {
          const { error: workoutError } = await supabase
            .from('plans')
            .insert({
              user_id: userId,
              type: 'workout',
              data: JSON.stringify(workoutPlan)
            });
          if (workoutError) console.error("Erro ao salvar treino", workoutError);
        }
        
        onComplete();
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="text-center mb-8">
        <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="text-secondary" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          {isLoginMode ? 'Bem-vindo de volta!' : 'Salve seu Progresso'}
        </h2>
        <p className="text-gray-500 mt-2">
          {isLoginMode 
            ? 'Entre para acessar seus planos.' 
            : 'Crie uma conta segura para acessar sua dieta e treino em qualquer lugar.'}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              type="email" 
              className="w-full pl-10 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-secondary outline-none transition-colors"
              value={user.email} 
              onChange={e => setUser({...user, email: e.target.value})} 
              placeholder="seu@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
          <div className="relative">
             <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              type="password" 
              className="w-full pl-10 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-secondary outline-none transition-colors"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <button 
        onClick={handleAuth}
        disabled={!user.email || !password || loading}
        className="w-full mt-8 bg-secondary hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'Entrar' : 'Criar Conta e Salvar')}
      </button>

      {isLoginMode && (
        <button 
          onClick={onBack}
          className="w-full mt-4 text-sm text-gray-500 hover:text-primary transition-colors flex items-center justify-center gap-1"
        >
          <ArrowLeft size={14} /> Não tem uma conta? Iniciar teste
        </button>
      )}
    </div>
  );
};

interface DashboardProps {
  user: UserData;
  stats: CalculatedStats | null;
  dietPlan: DietDay[];
  workoutPlan: WorkoutDay[];
  onLogout: () => void;
  onEditDiet: () => void;
  onEditWorkout: () => void;
  onEditProfile: () => void;
  onRestart: () => void;
  onRegenerateMeal: (dayIdx: number, mealIdx: number) => Promise<void>;
  onRegenerateWorkoutDay: (dayIdx: number) => Promise<void>;
  onDurationChange: (dayIdx: number, duration: string) => Promise<void>;
}

const DashboardScreen: React.FC<DashboardProps> = ({ 
  user, stats, dietPlan, workoutPlan, onLogout, onEditDiet, onEditWorkout, onEditProfile, onRestart,
  onRegenerateMeal, onRegenerateWorkoutDay, onDurationChange
}) => {
  const [openSections, setOpenSections] = useState({
    profile: true,
    metabolism: true,
    diet: true,
    workout: true
  });

  const toggle = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Olá, {user.name.split(' ')[0]}!</h1>
          <p className="text-gray-500">Aqui está o resumo do seu plano Glyx Fitness.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={onRestart} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2" title="Refazer Teste">
             <RotateCcw size={20} /> <span className="hidden sm:inline">Refazer Teste</span>
           </button>
           <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sair">
             <LogOut size={20} />
           </button>
        </div>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => toggle('profile')} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex items-center gap-3">
            <User className="text-primary" />
            <h3 className="font-bold text-gray-700">Resumo do Perfil</h3>
          </div>
          <div className="flex items-center gap-2">
            <div onClick={(e) => {e.stopPropagation(); onEditProfile()}} className="p-1 hover:bg-gray-200 rounded cursor-pointer text-gray-500 hover:text-primary"><Pencil size={18}/></div>
            <ChevronDown className={`transition-transform ${openSections.profile ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {openSections.profile && (
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 block">Idade</span> <span className="font-semibold">{user.age} anos</span></div>
            <div><span className="text-gray-500 block">Peso Inicial</span> <span className="font-semibold">{user.weight} kg</span></div>
            <div><span className="text-gray-500 block">Altura</span> <span className="font-semibold">{user.height} cm</span></div>
            <div><span className="text-gray-500 block">Meta</span> <span className="font-semibold text-secondary">-{user.targetWeightLoss} kg</span></div>
          </div>
        )}
      </div>

      {/* Metabolism Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => toggle('metabolism')} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex items-center gap-3">
            <Activity className="text-red-500" />
            <h3 className="font-bold text-gray-700">Análise Metabólica</h3>
          </div>
           <ChevronDown className={`transition-transform ${openSections.metabolism ? 'rotate-180' : ''}`} />
        </button>
        {openSections.metabolism && (
          <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 uppercase font-bold">Metabolismo Basal</p>
                  <p className="text-xl font-bold text-blue-800">{stats?.bmr} kcal</p>
                </div>
                 <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-xs text-emerald-600 uppercase font-bold">Gasto Total</p>
                  <p className="text-xl font-bold text-emerald-800">{stats?.tdee} kcal</p>
                </div>
                 <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-xs text-purple-600 uppercase font-bold">Meta Diária</p>
                  <p className="text-2xl font-bold text-purple-800">{stats?.targetCalories} kcal</p>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Diet Plan */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => toggle('diet')} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex items-center gap-3">
            <Utensils className="text-green-500" />
            <h3 className="font-bold text-gray-700">Plano Alimentar</h3>
          </div>
          <div className="flex items-center gap-2">
            <div onClick={(e) => {e.stopPropagation(); onEditDiet()}} className="p-1 hover:bg-gray-200 rounded cursor-pointer text-gray-500 hover:text-primary"><Pencil size={18}/></div>
            <ChevronDown className={`transition-transform ${openSections.diet ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {openSections.diet && (
          <div className="p-6">
            <DietListView dietPlan={dietPlan} onRegenerateMeal={onRegenerateMeal} />
          </div>
        )}
      </div>

      {/* Workout Plan */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => toggle('workout')} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex items-center gap-3">
            <Dumbbell className="text-indigo-500" />
            <h3 className="font-bold text-gray-700">Rotina de Treinos</h3>
          </div>
          <div className="flex items-center gap-2">
            <div onClick={(e) => {e.stopPropagation(); onEditWorkout()}} className="p-1 hover:bg-gray-200 rounded cursor-pointer text-gray-500 hover:text-primary"><Pencil size={18}/></div>
            <ChevronDown className={`transition-transform ${openSections.workout ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {openSections.workout && (
          <div className="p-6">
            <WorkoutListView workoutPlan={workoutPlan} onRegenerateDay={onRegenerateWorkoutDay} onDurationChange={onDurationChange} />
          </div>
        )}
      </div>
    </div>
  );
};


// --- Main App Component ---

const App: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Onboarding, 1: Anamnesis (Modal), 2: Analysis, 3: FoodInput, 4: DietResult, 5: WorkoutSetup, 6: WorkoutResult, 7: Auth/Save, 8: Dashboard
  const [user, setUser] = useState<UserData>(initialUser);
  const [stats, setStats] = useState<CalculatedStats | null>(null);
  const [dietPlan, setDietPlan] = useState<DietDay[] | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutDay[] | null>(null);
  const [deficitLevel, setDeficitLevel] = useState<DeficitLevel>(DeficitLevel.MODERATE);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAnamnesis, setShowAnamnesis] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Track if user is editing from dashboard
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register'); // To control AuthScreen behavior

  const nextStep = () => {
    // If editing, handle specific returns
    if (isEditing) {
       // Logic handled inside specific screens (onNext) to return to dashboard
       setStep(8);
       setIsEditing(false);
       // Trigger Save to DB
       savePlansToSupabase();
       return;
    }
    setStep(prev => prev + 1);
  };
  
  const prevStep = () => {
    if (isEditing) {
      setStep(8); // Cancel edit returns to dashboard
      setIsEditing(false);
      return;
    }
    setStep(prev => prev - 1);
  };

  const handleOnboardingNext = () => {
    if (!user.name || !user.weight || !user.height || !user.age) {
       alert("Por favor, preencha todos os campos.");
       return;
    }
    setShowAnamnesis(true);
  };

  const handleAnamnesisConfirm = () => {
    setShowAnamnesis(false);
    const calculated = calculateStats(user, deficitLevel);
    setStats(calculated);
    setStep(2); // Go to Analysis
  };

  const handleDeficitChange = (level: DeficitLevel) => {
    setDeficitLevel(level);
    const calculated = calculateStats(user, level);
    setStats(calculated);
  };

  const handleGenerateDiet = async () => {
    setLoading(true);
    setError('');
    try {
      if (!stats) throw new Error("Stats not calculated");
      const plan = await generateDietPlan(user, stats);
      setDietPlan(plan);
      nextStep();
    } catch (err) {
      setError("Falha ao gerar dieta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWorkout = async () => {
    setLoading(true);
    setError('');
    try {
      const plan = await generateWorkoutPlan(user);
      setWorkoutPlan(plan);
      nextStep();
    } catch (err) {
      setError("Falha ao gerar treino. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateMeal = async (dayIdx: number, mealIdx: number) => {
    if (!dietPlan || !stats) return;
    try {
      const currentMeal = dietPlan[dayIdx].meals[mealIdx];
      const newMeal = await regenerateMeal(user, currentMeal.name, currentMeal.calories);
      
      const newDietPlan = [...dietPlan];
      newDietPlan[dayIdx].meals[mealIdx] = newMeal;
      setDietPlan(newDietPlan);
      
      if (step === 8) savePlansToSupabase(newDietPlan, workoutPlan); // Save if in dashboard
    } catch (e) {
      alert("Erro ao atualizar refeição.");
    }
  };

  const handleRegenerateWorkoutDay = async (dayIdx: number) => {
    if (!workoutPlan) return;
    try {
      const currentDay = workoutPlan[dayIdx];
      const newDay = await regenerateWorkoutDay(user, currentDay);
      
      const newWorkoutPlan = [...workoutPlan];
      newWorkoutPlan[dayIdx] = newDay;
      setWorkoutPlan(newWorkoutPlan);

      if (step === 8) savePlansToSupabase(dietPlan, newWorkoutPlan); // Save if in dashboard
    } catch (e) {
      alert("Erro ao atualizar treino.");
    }
  };

  const handleDurationChange = async (dayIdx: number, newDuration: string) => {
    if (!workoutPlan) return;
    try {
       const currentDay = workoutPlan[dayIdx];
       // Optimistic update for UI
       const tempPlan = [...workoutPlan];
       tempPlan[dayIdx].duration = newDuration;
       setWorkoutPlan(tempPlan);

       const newDay = await regenerateWorkoutDay(user, currentDay, newDuration);
       
       const newWorkoutPlan = [...workoutPlan];
       newWorkoutPlan[dayIdx] = newDay;
       setWorkoutPlan(newWorkoutPlan);

       if (step === 8) savePlansToSupabase(dietPlan, newWorkoutPlan); // Save if in dashboard
    } catch (e) {
      alert("Erro ao atualizar duração e treino.");
    }
  }

  // Helper to save data when editing in Dashboard
  const savePlansToSupabase = async (currentDiet = dietPlan, currentWorkout = workoutPlan) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // First, find the plan IDs.
    const { data: plans } = await supabase.from('plans').select('id, type').eq('user_id', authUser.id);
    
    const dietId = plans?.find(p => p.type === 'diet')?.id;
    const workoutId = plans?.find(p => p.type === 'workout')?.id;

    if (dietId && currentDiet) {
       await supabase.from('plans').update({ data: JSON.stringify(currentDiet) }).eq('id', dietId);
    }
    if (workoutId && currentWorkout) {
       await supabase.from('plans').update({ data: JSON.stringify(currentWorkout) }).eq('id', workoutId);
    }
  };

  const handleProfileUpdate = async (updatedUser: UserData) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { error } = await supabase.from('profiles').update({
        name: updatedUser.name,
        age: updatedUser.age,
        weight: updatedUser.weight,
        height: updatedUser.height,
        gender: updatedUser.gender,
        activity_level: updatedUser.activityLevel,
        target_weight_loss: updatedUser.targetWeightLoss
      }).eq('id', authUser.id);
      
      if (error) throw error;
      
      // Update local state
      setUser(updatedUser);
      // Recalculate stats immediately
      const newStats = calculateStats(updatedUser, deficitLevel);
      setStats(newStats);
    }
  };

  // When Auth completes (Login or Signup)
  const handleAuthComplete = async () => {
    // If it was login, we need to fetch data.
    // If it was signup, data is already in state.
    // Let's refetch everything to be safe and consistent.
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
       const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
       const { data: plans } = await supabase.from('plans').select('*').eq('user_id', authUser.id);
       
       if (profile) {
         setUser(prev => ({
           ...prev,
           name: profile.name,
           age: profile.age,
           weight: profile.weight,
           height: profile.height,
           gender: profile.gender as Gender,
           activityLevel: profile.activity_level as ActivityLevel,
           targetWeightLoss: profile.target_weight_loss,
           availableFoods: profile.available_foods,
           workoutDays: profile.workout_days,
           workoutDuration: profile.workout_duration,
           targetMuscles: profile.target_muscles || []
         }));
         const calculated = calculateStats({ ...initialUser, ...profile, gender: profile.gender as Gender, activityLevel: profile.activity_level as ActivityLevel }, DeficitLevel.MODERATE); // Deficit level not stored in DB in this simple version, defaulting
         setStats(calculated);
       }

       if (plans) {
         const dPlan = plans.find(p => p.type === 'diet');
         const wPlan = plans.find(p => p.type === 'workout');
         if (dPlan) setDietPlan(JSON.parse(dPlan.data as string));
         if (wPlan) setWorkoutPlan(JSON.parse(wPlan.data as string));
       }
    }
    setStep(8); // Dashboard
  };

  const handleHeaderLogin = () => {
    setAuthMode('login');
    setStep(7); // Jump to Auth Screen
  };

  const handleRestart = () => {
    setStep(0);
    setDietPlan(null);
    setWorkoutPlan(null);
    setUser(initialUser); 
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-primary to-secondary p-2 rounded-lg text-white">
              <Dna size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              Glyx Fitness
            </span>
          </div>
          {step !== 8 && step !== 7 && (
            <button 
              onClick={handleHeaderLogin}
              className="text-sm font-medium text-primary hover:text-sky-700 flex items-center gap-1"
            >
              <LogIn size={16} /> Já tem conta? Entrar
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        {step < 8 && step !== 7 && <StepIndicator currentStep={step} totalSteps={7} />}

        {step === 0 && <OnboardingScreen user={user} setUser={setUser} onNext={handleOnboardingNext} />}
        
        {step === 2 && (
          <AnalysisScreen 
            stats={stats} 
            user={user}
            deficitLevel={deficitLevel}
            onDeficitChange={handleDeficitChange}
            onBack={prevStep} 
            onNext={nextStep} 
          />
        )}

        {step === 3 && (
          <FoodInputScreen 
            user={user} 
            setUser={setUser} 
            onGenerate={handleGenerateDiet} 
            loading={loading} 
            error={error} 
            onBack={prevStep}
          />
        )}

        {step === 4 && (
          <DietPlanScreen 
            dietPlan={dietPlan} 
            stats={stats}
            onRegenerateMeal={handleRegenerateMeal}
            onBack={prevStep} 
            onNext={nextStep}
            isEditing={isEditing}
          />
        )}

        {step === 5 && (
          <WorkoutSetupScreen 
            user={user} 
            setUser={setUser} 
            onGenerate={handleGenerateWorkout} 
            loading={loading} 
            error={error} 
            onBack={prevStep}
          />
        )}

        {step === 6 && (
          <WorkoutPlanScreen 
            workoutPlan={workoutPlan} 
            onRegenerateDay={handleRegenerateWorkoutDay}
            onDurationChange={handleDurationChange}
            onBack={prevStep} 
            onNext={() => { setAuthMode('register'); nextStep(); }}
            isEditing={isEditing}
          />
        )}

        {step === 7 && (
          <AuthScreen 
            user={user} 
            setUser={setUser} 
            onComplete={handleAuthComplete} 
            isLoginMode={authMode === 'login'}
            dietPlan={dietPlan}
            workoutPlan={workoutPlan}
            onBack={() => setStep(0)}
          />
        )}

        {step === 8 && (
          <DashboardScreen 
            user={user} 
            stats={stats} 
            dietPlan={dietPlan || []} 
            workoutPlan={workoutPlan || []} 
            onLogout={() => { supabase.auth.signOut(); setStep(0); setUser(initialUser); }}
            onEditDiet={() => { setIsEditing(true); setStep(4); }}
            onEditWorkout={() => { setIsEditing(true); setStep(6); }}
            onEditProfile={() => setShowProfileEdit(true)}
            onRestart={handleRestart}
            onRegenerateMeal={handleRegenerateMeal}
            onRegenerateWorkoutDay={handleRegenerateWorkoutDay}
            onDurationChange={handleDurationChange}
          />
        )}
      </main>

      <AnamnesisModal isOpen={showAnamnesis} onConfirm={handleAnamnesisConfirm} />
      <ProfileEditModal 
        user={user} 
        isOpen={showProfileEdit} 
        onClose={() => setShowProfileEdit(false)} 
        onSave={handleProfileUpdate} 
      />
    </div>
  );
};

export default App;