# TriageAI

Sistema de triaje inteligente hospitalario basado en el Sistema de Triaje de Manchester (MTS).

## Estructura del proyecto
TriageAI/
├── frontend/   # Aplicación React + TypeScript (Vite)
└── backend/    # API FastAPI + clasificador ML (Python)

## Requisitos previos

- Node.js 18+ y npm
- Python 3.10+
- (Opcional) Un entorno virtual de Python

## Cómo ejecutar el proyecto

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

El backend queda disponible en: http://localhost:8000

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

El frontend queda disponible en: http://localhost:5173

## Arquitectura

Ambos proyectos aplican **arquitectura hexagonal**:

| Capa | Frontend | Backend |
|------|----------|---------|
| Dominio | `src/domain/` | `app/domain/` |
| Aplicación | `src/application/` | `app/application/` |
| Infraestructura | `src/infrastructure/` | `app/infrastructure/` |

## Variables de entorno

Crea el archivo `frontend/.env` con:
VITE_API_URL=http://localhost:8000

Un archivo `frontend/.env.example` ya está incluido como referencia.

## Tecnologías

**Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui  
**Backend:** FastAPI, Uvicorn, scikit-learn, Pydantic
