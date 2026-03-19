import { Patient, VitalSigns, TriageResult, MTSLevel } from '@/domain/entities/Patient';
import { ITriageService } from '@/domain/ports/ITriageService';

export class RegisterPatientUseCase {
  constructor(private readonly triageService: ITriageService) {}

  async execute(data: {
    firstName: string;
    lastName: string;
    documentType: 'CC' | 'Pasaporte' | 'TI';
    documentNumber: string;
    dateOfBirth: string;
    age: number;
    sex: 'M' | 'F' | 'Otro';
    chiefComplaint: string;
    symptoms: string[];
    medicalHistory: string[];
    painScale: number;
    vitalSigns: VitalSigns;
  }): Promise<{ patient: Patient; result: TriageResult }> {
    const result = await this.triageService.classify(
      data.symptoms,
      data.vitalSigns,
      data.painScale,
      data.medicalHistory
    );
    const patient: Patient = {
      id: `P${Date.now()}`,
      ...data,
      mtsLevel: result.level as MTSLevel,
      arrivalTime: new Date(),
      waitTimeMinutes: 0,
      status: 'waiting',
    };
    return { patient, result };
  }
}