# Política de privacidad y tratamiento de datos — TriageAI

**Versión:** 1.0  
**Fecha:** 2026-06-16  
**Aplicable a:** Sistema de triaje inteligente hospitalario (kiosco de autoregistro + panel médico)

---

## 1. Qué datos se capturan

### 1.1 Datos ingresados por el paciente (kiosco)

| Campo               | Descripción                            | Almacenado en BD |
|---------------------|----------------------------------------|-----------------|
| Nombre completo     | Nombre y apellidos del paciente        | Sí              |
| Número de cédula    | Documento de identidad nacional        | Sí              |
| EPS                 | Entidad prestadora de salud            | Sí              |
| Nivel de dolor      | Escala 0–10 (autorreportado)           | Sí              |
| Nivel de consciencia| Una de 4 opciones (autorreportado)     | Sí              |

### 1.2 Signos vitales medidos por cámara (rPPG — kiosco)

| Signo vital                    | Fuente        | Almacenado en BD                  |
|--------------------------------|---------------|-----------------------------------|
| Frecuencia cardíaca (FC)       | Cámara rPPG   | Sí (valor + confianza)            |
| Frecuencia respiratoria (FR)   | Cámara rPPG   | Sí (valor + confianza)            |
| Variabilidad frecuencia cardiaca (HRV) | Cámara rPPG | Sí, si disponible (valor + confianza) |
| SpO2 estimada por cámara       | Cámara rPPG   | Sí, si disponible (valor + confianza) |

**Importante:** La SpO2 medida por cámara es una **estimación no clínica** y se muestra siempre como "estimado cámara". No reemplaza un pulsioxímetro certificado.

### 1.3 Datos ingresados por el personal médico (panel de administración)

| Campo               | Descripción                                    | Almacenado en BD |
|---------------------|------------------------------------------------|-----------------|
| Signos vitales clínicos | Presión arterial, temperatura, SpO2 clínica | Sí              |
| Síntomas            | Lista de síntomas seleccionados               | Sí              |
| Antecedentes        | Historia médica relevante                     | Sí              |
| Queja principal     | Motivo de consulta en texto libre             | Sí              |
| Nivel MTS asignado  | Nivel de urgencia 1–5 calculado por el sistema| Sí              |

---

## 2. Qué NO se almacena

- **Imágenes o video del paciente:** La cámara se usa únicamente para el procesamiento de señales en tiempo real (rPPG). Los fotogramas nunca se graban, transmiten a servidores externos ni guardan en disco.
- **Audio:** El kiosco no captura audio en ningún momento.
- **Datos biométricos permanentes:** No se almacenan huellas faciales, iris, ni ningún identificador biométrico.
- **Datos de geolocalización:** La aplicación no solicita ni registra la ubicación del dispositivo.
- **Cookies de seguimiento:** La interfaz web no usa cookies de analítica de terceros.

---

## 3. Dónde ocurre el procesamiento

### 3.1 Procesamiento en el navegador (kiosco)

Todo el procesamiento de señales de cámara ocurre **exclusivamente en el navegador del kiosco**:

- Detección de puntos faciales: MediaPipe FaceLandmarker (WASM local, sin envío de datos a Google).
- Extracción de señal rPPG: algoritmo POS sobre los canales RGB del área de la frente.
- Cálculo de FC, FR, HRV y SpO2: FFT y filtros implementados en JavaScript/TypeScript.

**Ningún fotograma, señal cruda ni dato intermedio de procesamiento se envía a servidores.**

### 3.2 Datos que llegan al backend

Solo el **resultado numérico final** de la medición (valor + índice de confianza por signo) se envía al backend junto con los datos de identificación y auto-reporte. El backend corre en la misma red hospitalaria interna.

### 3.3 Base de datos

Los datos se almacenan en SQLite en el servidor local del hospital. No se usan servicios de nube de terceros para almacenamiento de datos clínicos.

---

## 4. Control de calidad y advertencias al médico

- Si el **índice de confianza promedio** de una medición rPPG es inferior a **0.30**, la medición completa se descarta en el kiosco y se solicita al paciente que lo intente de nuevo.
- Si el índice de confianza de **un signo individual** es inferior a **0.50**, el valor se registra en la base de datos pero el médico ve una advertencia visual ("Verificar manualmente") en la vista de detalle del paciente.
- Los valores de confianza se almacenan en la base de datos para trazabilidad.

---

## 5. Alertas automáticas del sistema

El sistema genera automáticamente las siguientes alertas visibles solo para el personal médico:

| Tipo de alerta         | Condición de disparo                                  |
|------------------------|-------------------------------------------------------|
| `critical_vitals`      | Nivel MTS 1 o 2 al registrar                          |
| `anomalous_vitals`     | FC > 120 bpm, FC < 40 bpm, o SpO2 < 90 %             |
| `low_confidence`       | Algún signo con confianza < 0.50                      |
| `wait_exceeded`        | El tiempo de espera supera el máximo para el nivel MTS|
| `risk_escalated`       | El nivel MTS sube al actualizar signos vitales        |

Las alertas **no se duplican**: si ya existe una alerta sin leer del mismo tipo para el mismo paciente, no se crea otra.

---

## 6. Acceso a los datos

- Los datos de pacientes son accesibles **únicamente** al personal médico autenticado en el sistema (login con email y contraseña).
- El kiosco de autoregistro **no muestra** datos de otros pacientes.
- No existen APIs públicas de acceso a datos clínicos.

---

## 7. Retención y eliminación

- Los datos se conservan hasta que el paciente es marcado como "atendido".
- La eliminación definitiva de registros debe realizarse directamente en la base de datos por el administrador del sistema, ya que actualmente no existe una interfaz de eliminación de registros históricos.

---

## 8. Limitaciones y descargo de responsabilidad

- TriageAI es una **herramienta de apoyo** al personal sanitario, no un dispositivo médico certificado.
- Las mediciones de SpO2 por cámara son estimaciones y **no deben usarse como único criterio diagnóstico**.
- El índice de triaje MTS generado por el sistema es una **sugerencia** y debe ser validado por un profesional de la salud.

---

*Para preguntas sobre privacidad o solicitudes de eliminación de datos, contactar al administrador del sistema hospitalario.*
