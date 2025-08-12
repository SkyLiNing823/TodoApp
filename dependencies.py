from typing import Annotated
from sqlalchemy.orm import Session
from fastapi import Depends
from TodoApp.database import SessionLocal 
from fastapi.templating import Jinja2Templates

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

templates = Jinja2Templates(directory="TodoApp/templates") 
