from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import configs, logs, stats, runs, stages, sources, destinations, connections

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include Routers
app.include_router(configs.router)
app.include_router(logs.router)
app.include_router(stats.router)
app.include_router(stages.router)
app.include_router(runs.router)
app.include_router(sources.router)
app.include_router(destinations.router)
app.include_router(connections.router)

@app.get("/")
def read_root():
    return {"message": "Data Pipeline Config API (Modularized)"}
