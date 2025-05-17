## 💡 System Architecture
- Web: React frontend (port 3000)


- API: FastAPI backend (port 8000)

## 📁 File Structure
```
project-root/
├── docker-compose.yml          # Container orchestration
├── backend/
│   ├── Dockerfile              # Backend image definition
│   ├── requirements.txt        # Python dependencies
│   └── app/                    # FastAPI code
└── frontend/
    ├── Dockerfile              # Frontend image definition
    └── src/                    # React code
```

## 🔧 Setup
Ensure Docker is running

Run:
   ```bash
   docker-compose up --build
   ```
