import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="w-full mb-8 max-w-2xl mx-auto px-4">
      <div className="flex justify-between mb-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full mx-1 transition-all duration-300 ${
              index <= currentStep 
                ? index === currentStep ? 'bg-primary scale-105 shadow' : 'bg-secondary' 
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-center text-gray-500 font-medium uppercase tracking-wider mt-2">
        {indexToStepName(currentStep)} (Passo {currentStep + 1} de {totalSteps})
      </p>
    </div>
  );
};

const indexToStepName = (index: number): string => {
  switch (index) {
    case 0: return "Dados Pessoais";
    case 1: return "Análise Metabólica";
    case 2: return "Preferências Alimentares";
    case 3: return "Plano de Dieta";
    case 4: return "Configurar Treino";
    case 5: return "Plano de Treino";
    case 6: return "Cadastro";
    default: return "";
  }
};