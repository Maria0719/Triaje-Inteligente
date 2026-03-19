import { VitalSigns, TriageResult } from '@/domain/entities/Patient';

export interface ITriageService {
  classify(
    symptoms: string[],
    vitalSigns: VitalSigns,
    painScale: number,
    medicalHistory: string[]
  ): Promise<TriageResult>;
}