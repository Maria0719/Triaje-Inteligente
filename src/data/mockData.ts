import { Patient, Alert } from '@/types'; // Importa tipos base

const now = new Date(); // Guarda tiempo actual
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000); // Resta minutos al tiempo
const elapsedMinutesSince = (date: Date) => Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); // Calcula minutos transcurridos
const arrivalAndWait = (minutes: number) => { // Crea llegada y espera
  const arrivalTime = minutesAgo(minutes); // Define hora de llegada
  return { arrivalTime, waitTimeMinutes: elapsedMinutesSince(arrivalTime) }; // Devuelve tiempo derivado
};

export const mockPatients: Patient[] = [ // Lista pacientes simulados
  { // Inicia paciente uno
    id: 'P001', // Id del paciente
    firstName: 'Carlos', // Nombre del paciente
    lastName: 'Martínez Restrepo', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1045678901', // Numero de documento
    dateOfBirth: '1958-03-15', // Fecha de nacimiento
    age: 67, // Edad en anos
    sex: 'M', // Sexo del paciente
    chiefComplaint: 'Dolor torácico severo irradiado a brazo izquierdo', // Motivo principal
    symptoms: ['Dolor torácico', 'Mareo', 'Dificultad respiratoria'], // Lista de sintomas
    medicalHistory: ['Hipertensión', 'Diabetes', 'Cardiopatía'], // Historial medico
    painScale: 9, // Escala del dolor
    vitalSigns: { systolicBP: 180, diastolicBP: 110, heartRate: 120, respiratoryRate: 28, temperature: 37.2, oxygenSaturation: 89, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 1, // Nivel MTS asignado
    ...arrivalAndWait(8), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente dos
    id: 'P002', // Id del paciente
    firstName: 'María', // Nombre del paciente
    lastName: 'González Vargas', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1098765432', // Numero de documento
    dateOfBirth: '1990-07-22', // Fecha de nacimiento
    age: 35, // Edad en anos
    sex: 'F', // Sexo del paciente
    chiefComplaint: 'Convulsiones tónico-clónicas de 5 minutos de duración', // Motivo principal
    symptoms: ['Convulsiones', 'Pérdida de consciencia'], // Lista de sintomas
    medicalHistory: ['Ninguno'], // Historial medico
    painScale: 0, // Escala del dolor
    vitalSigns: { systolicBP: 140, diastolicBP: 90, heartRate: 110, respiratoryRate: 22, temperature: 38.5, oxygenSaturation: 93, consciousnessLevel: 'Voz' }, // Signos vitales iniciales
    mtsLevel: 1, // Nivel MTS asignado
    ...arrivalAndWait(5), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente tres
    id: 'P003', // Id del paciente
    firstName: 'Andrés', // Nombre del paciente
    lastName: 'López Herrera', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1023456789', // Numero de documento
    dateOfBirth: '1975-11-30', // Fecha de nacimiento
    age: 50, // Edad en anos
    sex: 'M', // Sexo del paciente
    chiefComplaint: 'Dificultad respiratoria aguda con sibilancias', // Motivo principal
    symptoms: ['Dificultad respiratoria', 'Fiebre'], // Lista de sintomas
    medicalHistory: ['EPOC', 'Hipertensión'], // Historial medico
    painScale: 6, // Escala del dolor
    vitalSigns: { systolicBP: 150, diastolicBP: 95, heartRate: 105, respiratoryRate: 26, temperature: 38.8, oxygenSaturation: 91, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 2, // Nivel MTS asignado
    ...arrivalAndWait(18), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente cuatro
    id: 'P004', // Id del paciente
    firstName: 'Valentina', // Nombre del paciente
    lastName: 'Rodríguez Peña', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1112345678', // Numero de documento
    dateOfBirth: '2000-02-14', // Fecha de nacimiento
    age: 26, // Edad en anos
    sex: 'F', // Sexo del paciente
    chiefComplaint: 'Dolor abdominal intenso en fosa ilíaca derecha', // Motivo principal
    symptoms: ['Dolor abdominal', 'Vómito', 'Fiebre'], // Lista de sintomas
    medicalHistory: ['Ninguno'], // Historial medico
    painScale: 8, // Escala del dolor
    vitalSigns: { systolicBP: 125, diastolicBP: 80, heartRate: 95, respiratoryRate: 20, temperature: 38.2, oxygenSaturation: 97, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 2, // Nivel MTS asignado
    ...arrivalAndWait(25), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente cinco
    id: 'P005', // Id del paciente
    firstName: 'Jorge', // Nombre del paciente
    lastName: 'Castaño Mejía', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '7890123456', // Numero de documento
    dateOfBirth: '1965-06-08', // Fecha de nacimiento
    age: 60, // Edad en anos
    sex: 'M', // Sexo del paciente
    chiefComplaint: 'Cefalea intensa de inicio súbito', // Motivo principal
    symptoms: ['Cefalea', 'Vómito', 'Mareo'], // Lista de sintomas
    medicalHistory: ['Hipertensión', 'Diabetes'], // Historial medico
    painScale: 7, // Escala del dolor
    vitalSigns: { systolicBP: 170, diastolicBP: 100, heartRate: 88, respiratoryRate: 18, temperature: 36.8, oxygenSaturation: 96, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 3, // Nivel MTS asignado
    ...arrivalAndWait(42), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente seis
    id: 'P006', // Id del paciente
    firstName: 'Lucía', // Nombre del paciente
    lastName: 'Ramírez Torres', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1056789012', // Numero de documento
    dateOfBirth: '1988-09-25', // Fecha de nacimiento
    age: 37, // Edad en anos
    sex: 'F', // Sexo del paciente
    chiefComplaint: 'Trauma en extremidad inferior por caída', // Motivo principal
    symptoms: ['Trauma', 'Dolor abdominal'], // Lista de sintomas
    medicalHistory: ['Embarazo'], // Historial medico
    painScale: 6, // Escala del dolor
    vitalSigns: { systolicBP: 118, diastolicBP: 75, heartRate: 82, respiratoryRate: 16, temperature: 36.9, oxygenSaturation: 98, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 3, // Nivel MTS asignado
    ...arrivalAndWait(55), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente siete
    id: 'P007', // Id del paciente
    firstName: 'Santiago', // Nombre del paciente
    lastName: 'Ospina Giraldo', // Apellido del paciente
    documentType: 'TI', // Tipo de documento
    documentNumber: '1001234567', // Numero de documento
    dateOfBirth: '2008-12-03', // Fecha de nacimiento
    age: 17, // Edad en anos
    sex: 'M', // Sexo del paciente
    chiefComplaint: 'Fiebre persistente de 3 días con malestar general', // Motivo principal
    symptoms: ['Fiebre', 'Cefalea', 'Dolor abdominal'], // Lista de sintomas
    medicalHistory: ['Ninguno'], // Historial medico
    painScale: 4, // Escala del dolor
    vitalSigns: { systolicBP: 110, diastolicBP: 70, heartRate: 90, respiratoryRate: 18, temperature: 38.9, oxygenSaturation: 97, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 4, // Nivel MTS asignado
    ...arrivalAndWait(70), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente ocho
    id: 'P008', // Id del paciente
    firstName: 'Carmen', // Nombre del paciente
    lastName: 'Duarte Salazar', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '4567890123', // Numero de documento
    dateOfBirth: '1945-04-18', // Fecha de nacimiento
    age: 80, // Edad en anos
    sex: 'F', // Sexo del paciente
    chiefComplaint: 'Dolor lumbar crónico exacerbado', // Motivo principal
    symptoms: ['Dolor abdominal', 'Mareo'], // Lista de sintomas
    medicalHistory: ['Hipertensión', 'Diabetes', 'Cardiopatía'], // Historial medico
    painScale: 5, // Escala del dolor
    vitalSigns: { systolicBP: 135, diastolicBP: 82, heartRate: 72, respiratoryRate: 16, temperature: 36.5, oxygenSaturation: 96, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 4, // Nivel MTS asignado
    ...arrivalAndWait(90), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente nueve
    id: 'P009', // Id del paciente
    firstName: 'Felipe', // Nombre del paciente
    lastName: 'Arias Montoya', // Apellido del paciente
    documentType: 'CC', // Tipo de documento
    documentNumber: '1034567890', // Numero de documento
    dateOfBirth: '1995-01-10', // Fecha de nacimiento
    age: 31, // Edad en anos
    sex: 'M', // Sexo del paciente
    chiefComplaint: 'Dolor de garganta y congestión nasal de 2 días', // Motivo principal
    symptoms: ['Fiebre', 'Cefalea'], // Lista de sintomas
    medicalHistory: ['Ninguno'], // Historial medico
    painScale: 3, // Escala del dolor
    vitalSigns: { systolicBP: 120, diastolicBP: 78, heartRate: 76, respiratoryRate: 16, temperature: 37.8, oxygenSaturation: 98, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 5, // Nivel MTS asignado
    ...arrivalAndWait(110), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
  { // Inicia paciente diez
    id: 'P010', // Id del paciente
    firstName: 'Diana', // Nombre del paciente
    lastName: 'Morales Quintero', // Apellido del paciente
    documentType: 'Pasaporte', // Tipo de documento
    documentNumber: 'AX123456', // Numero de documento
    dateOfBirth: '1982-08-20', // Fecha de nacimiento
    age: 43, // Edad en anos
    sex: 'F', // Sexo del paciente
    chiefComplaint: 'Erupción cutánea generalizada con prurito', // Motivo principal
    symptoms: ['Otros'], // Lista de sintomas
    medicalHistory: ['Ninguno'], // Historial medico
    painScale: 2, // Escala del dolor
    vitalSigns: { systolicBP: 115, diastolicBP: 72, heartRate: 70, respiratoryRate: 14, temperature: 36.7, oxygenSaturation: 99, consciousnessLevel: 'Alerta' }, // Signos vitales iniciales
    mtsLevel: 5, // Nivel MTS asignado
    ...arrivalAndWait(130), // Calcula llegada y espera
    status: 'waiting', // Estado actual del paciente
  },
];

export const mockAlerts: Alert[] = [ // Lista alertas simuladas
  { // Inicia alerta uno
    id: 'A001', // Id de alerta
    patientId: 'P003', // Id del paciente
    patientName: 'Andrés López Herrera', // Nombre del paciente
    message: 'Tiempo de espera excedido — Nivel 2 debe ser atendido en 10 min (lleva 18 min)', // Mensaje de alerta
    type: 'wait_exceeded', // Tipo de alerta
    severity: 2, // Nivel de severidad
    timeAgo: 'Hace 8 min', // Tiempo relativo alerta
    read: false, // Marca lectura alerta
  },
  { // Inicia alerta dos
    id: 'A002', // Id de alerta
    patientId: 'P005', // Id del paciente
    patientName: 'Jorge Castaño Mejía', // Nombre del paciente
    message: 'Tiempo de espera excedido — Nivel 3 debe ser atendido en 30 min (lleva 42 min)', // Mensaje de alerta
    type: 'wait_exceeded', // Tipo de alerta
    severity: 3, // Nivel de severidad
    timeAgo: 'Hace 12 min', // Tiempo relativo alerta
    read: false, // Marca lectura alerta
  },
  { // Inicia alerta tres
    id: 'A003', // Id de alerta
    patientId: 'P001', // Id del paciente
    patientName: 'Carlos Martínez Restrepo', // Nombre del paciente
    message: 'Signos vitales críticos — SpO2 89%, FC 120 bpm, PA 180/110', // Mensaje de alerta
    type: 'critical_vitals', // Tipo de alerta
    severity: 1, // Nivel de severidad
    timeAgo: 'Hace 3 min', // Tiempo relativo alerta
    read: false, // Marca lectura alerta
  },
  { // Inicia alerta cuatro
    id: 'A004', // Id de alerta
    patientId: 'P007', // Id del paciente
    patientName: 'Santiago Ospina Giraldo', // Nombre del paciente
    message: 'Riesgo escalado — Fiebre persistente con temperatura 38.9°C', // Mensaje de alerta
    type: 'risk_escalated', // Tipo de alerta
    severity: 4, // Nivel de severidad
    timeAgo: 'Hace 20 min', // Tiempo relativo alerta
    read: false, // Marca lectura alerta
  },
];

export const mockStats = { // Resumen estadistico inicial
  totalActive: 10, // Total pacientes activos
  criticalPatients: 4, // Total pacientes criticos
  averageWaitTime: 55, // Promedio de espera
  attendedToday: 23, // Atendidos del dia
  patientsByLevel: [ // Conteo por nivel
    { level: 'Nivel 1', count: 2, fill: 'hsl(0, 72%, 51%)' }, // Conteo del nivel 1
    { level: 'Nivel 2', count: 2, fill: 'hsl(25, 95%, 53%)' }, // Conteo del nivel 2
    { level: 'Nivel 3', count: 2, fill: 'hsl(48, 96%, 53%)' }, // Conteo del nivel 3
    { level: 'Nivel 4', count: 2, fill: 'hsl(142, 71%, 45%)' }, // Conteo del nivel 4
    { level: 'Nivel 5', count: 2, fill: 'hsl(217, 91%, 60%)' }, // Conteo del nivel 5
  ],
  volumeByHour: [ // Flujo por hora
    { hour: '6:00', patients: 2 }, // Pacientes a las 6
    { hour: '7:00', patients: 5 }, // Pacientes a las 7
    { hour: '8:00', patients: 12 }, // Pacientes a las 8
    { hour: '9:00', patients: 18 }, // Pacientes a las 9
    { hour: '10:00', patients: 15 }, // Pacientes a las 10
    { hour: '11:00', patients: 20 }, // Pacientes a las 11
    { hour: '12:00', patients: 14 }, // Pacientes a las 12
    { hour: '13:00', patients: 10 }, // Pacientes a las 13
    { hour: '14:00', patients: 16 }, // Pacientes a las 14
    { hour: '15:00', patients: 13 }, // Pacientes a las 15
    { hour: '16:00', patients: 9 }, // Pacientes a las 16
    { hour: '17:00', patients: 7 }, // Pacientes a las 17
  ],
  topComplaints: [ // Motivos mas frecuentes
    { complaint: 'Dolor torácico', count: 8 }, // Conteo dolor toracico
    { complaint: 'Dificultad respiratoria', count: 6 }, // Conteo dificultad respiratoria
    { complaint: 'Dolor abdominal', count: 5 }, // Conteo dolor abdominal
    { complaint: 'Trauma', count: 4 }, // Conteo trauma
    { complaint: 'Fiebre', count: 3 }, // Conteo fiebre
  ],
  waitTimeByLevel: [ // Espera frente a meta
    { level: 'Nivel 1', actual: 5, recommended: 0 }, // Nivel 1 real meta
    { level: 'Nivel 2', actual: 22, recommended: 10 }, // Nivel 2 real meta
    { level: 'Nivel 3', actual: 48, recommended: 30 }, // Nivel 3 real meta
    { level: 'Nivel 4', actual: 80, recommended: 60 }, // Nivel 4 real meta
    { level: 'Nivel 5', actual: 120, recommended: 120 }, // Nivel 5 real meta
  ],
};
