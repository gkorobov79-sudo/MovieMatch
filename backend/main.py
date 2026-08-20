from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message":"MovieMatch backend is working!"}
