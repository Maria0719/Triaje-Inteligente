import { VitalSigns, TriageResult, MTSLevel } from '@/domain/entities/Patient';
import { ITriageService } from '@/domain/ports/ITriageService';
export class LocalTriageClassifier implements ITriageService {
    async classify(symptoms: string[], vitalSigns: VitalSigns, painScale: number, medicalHistory: string[]): Promise<TriageResult> {
        const factors: string[] = [];
        let score = 0;
        if (vitalSigns.consciousnessLevel === 'No responde') {
            score += 50;
            factors.push('Paciente no responde');
        }
        else if (vitalSigns.consciousnessLevel === 'Dolor') {
            score += 30;
            factors.push('Responde solo al dolor');
        }
        else if (vitalSigns.consciousnessLevel === 'Voz') {
            score += 15;
            factors.push('Nivel de consciencia alterado');
        }
        if (vitalSigns.oxygenSaturation < 90) {
            score += 30;
            factors.push(`SpO2 crítica: ${vitalSigns.oxygenSaturation}%`);
        }
        else if (vitalSigns.oxygenSaturation < 95) {
            score += 15;
            factors.push(`SpO2 baja: ${vitalSigns.oxygenSaturation}%`);
        }
        if (vitalSigns.heartRate > 120 || vitalSigns.heartRate < 40) {
            score += 20;
            factors.push(`Frecuencia cardíaca: ${vitalSigns.heartRate} bpm`);
        }
        if (vitalSigns.systolicBP > 180 || vitalSigns.systolicBP < 80) {
            score += 20;
            factors.push(`Presión arterial: ${vitalSigns.systolicBP}/${vitalSigns.diastolicBP} mmHg`);
        }
        if (vitalSigns.respiratoryRate > 25 || vitalSigns.respiratoryRate < 8) {
            score += 15;
            factors.push(`Frecuencia respiratoria: ${vitalSigns.respiratoryRate} rpm`);
        }
        if (vitalSigns.temperature > 39) {
            score += 10;
            factors.push(`Fiebre alta: ${vitalSigns.temperature}°C`);
        }
        const criticalSymptoms = ['Dolor torácico', 'Pérdida de consciencia', 'Convulsiones', 'Hemorragia'];
        const urgentSymptoms = ['Dificultad respiratoria', 'Trauma'];
        symptoms.forEach(s => {
            if (criticalSymptoms.includes(s)) {
                score += 20;
                factors.push(s);
            }
            else if (urgentSymptoms.includes(s)) {
                score += 10;
                factors.push(s);
            }
        });
        if (painScale >= 9) {
            score += 15;
            factors.push(`Dolor severo: ${painScale}/10`);
        }
        else if (painScale >= 7) {
            score += 8;
            factors.push(`Dolor intenso: ${painScale}/10`);
        }
        if (medicalHistory.includes('Cardiopatía') && symptoms.includes('Dolor torácico')) {
            score += 15;
            factors.push('Antecedente de cardiopatía');
        }
        let level: MTSLevel;
        if (score >= 60)
            level = 1;
        else if (score >= 40)
            level = 2;
        else if (score >= 25)
            level = 3;
        else if (score >= 10)
            level = 4;
        else
            level = 5;
        return { level, factors: factors.length > 0 ? factors : ['Signos vitales dentro de parámetros normales'] };
    }
}
