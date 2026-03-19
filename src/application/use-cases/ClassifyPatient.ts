import { VitalSigns, TriageResult } from '@/domain/entities/Patient';
import { ITriageService } from '@/domain/ports/ITriageService';

export class ClassifyPatientUseCase {
  constructor(private readonly triageService: ITriageService) {}

  async execute(
    symptoms: string[],
    vitalSigns: VitalSigns,
    painScale: number,
    medicalHistory: string[]
  ): Promise<TriageResult> {
    return this.triageService.classify(symptoms, vitalSigns, painScale, medicalHistory);
  }
}