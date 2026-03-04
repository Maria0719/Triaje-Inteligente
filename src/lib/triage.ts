import { MTSLevel, VitalSigns } from '@/types';

export function classifyPatient(
  symptoms: string[],
  vitalSigns: VitalSigns,
  painScale: number,
  medicalHistory: string[]
): { level: MTSLevel; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Consciousness
  if (vitalSigns.consciousnessLevel === 'No responde') { score += 50; factors.push('Paciente no responde'); }
  else if (vitalSigns.consciousnessLevel === 'Dolor') { score += 30; factors.push('Responde solo al dolor'); }
  else if (vitalSigns.consciousnessLevel === 'Voz') { score += 15; factors.push('Nivel de consciencia alterado'); }

  // SpO2
  if (vitalSigns.oxygenSaturation < 90) { score += 30; factors.push(`SpO2 crítica: ${vitalSigns.oxygenSaturation}%`); }
  else if (vitalSigns.oxygenSaturation < 95) { score += 15; factors.push(`SpO2 baja: ${vitalSigns.oxygenSaturation}%`); }

  // Heart rate
  if (vitalSigns.heartRate > 120 || vitalSigns.heartRate < 40) { score += 20; factors.push(`Frecuencia cardíaca: ${vitalSigns.heartRate} bpm`); }
  else if (vitalSigns.heartRate > 100 || vitalSigns.heartRate < 50) { score += 10; factors.push(`Frecuencia cardíaca elevada: ${vitalSigns.heartRate} bpm`); }

  // BP
  if (vitalSigns.systolicBP > 180 || vitalSigns.systolicBP < 80) { score += 20; factors.push(`Presión arterial: ${vitalSigns.systolicBP}/${vitalSigns.diastolicBP} mmHg`); }
  else if (vitalSigns.systolicBP > 160 || vitalSigns.systolicBP < 90) { score += 10; factors.push(`Presión arterial alterada: ${vitalSigns.systolicBP}/${vitalSigns.diastolicBP} mmHg`); }

  // Respiratory rate
  if (vitalSigns.respiratoryRate > 25 || vitalSigns.respiratoryRate < 8) { score += 15; factors.push(`Frecuencia respiratoria: ${vitalSigns.respiratoryRate} rpm`); }

  // Temperature
  if (vitalSigns.temperature > 39) { score += 10; factors.push(`Fiebre alta: ${vitalSigns.temperature}°C`); }
  else if (vitalSigns.temperature > 38) { score += 5; factors.push(`Fiebre: ${vitalSigns.temperature}°C`); }

  // Critical symptoms
  const criticalSymptoms = ['Dolor torácico', 'Pérdida de consciencia', 'Convulsiones', 'Hemorragia'];
  const urgentSymptoms = ['Dificultad respiratoria', 'Trauma'];
  symptoms.forEach(s => {
    if (criticalSymptoms.includes(s)) { score += 20; factors.push(s); }
    else if (urgentSymptoms.includes(s)) { score += 10; factors.push(s); }
  });

  // Pain
  if (painScale >= 9) { score += 15; factors.push(`Dolor severo: ${painScale}/10`); }
  else if (painScale >= 7) { score += 8; factors.push(`Dolor intenso: ${painScale}/10`); }

  // History
  if (medicalHistory.includes('Cardiopatía') && symptoms.includes('Dolor torácico')) { score += 15; factors.push('Antecedente de cardiopatía'); }
  if (medicalHistory.includes('Anticoagulantes') && symptoms.includes('Hemorragia')) { score += 10; factors.push('Uso de anticoagulantes'); }

  let level: MTSLevel;
  if (score >= 60) level = 1;
  else if (score >= 40) level = 2;
  else if (score >= 25) level = 3;
  else if (score >= 10) level = 4;
  else level = 5;

  return { level, factors: factors.length > 0 ? factors : ['Signos vitales dentro de parámetros normales'] };
}
