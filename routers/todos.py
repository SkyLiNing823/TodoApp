from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Path, Request
from starlette import status
from models import Todos
from dependencies import db_dependency, templates
from auth import get_current_user, user_dependency
from starlette.responses import RedirectResponse
from google import genai
import os


router = APIRouter(
    prefix='/todos',
    tags=['todos']
)


gemini_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))


class TodoRequest(BaseModel):
    title: str = Field(min_length=3)
    description: str = Field(min_length=3, max_length=100)
    priority: int = Field(gt=0, lt=6)
    complete: bool


class DescriptionSuggestRequest(BaseModel):
    title: str = Field(min_length=2)


def redirect_to_login():
    redirect_response = RedirectResponse(
        url='/auth/login-page', status_code=status.HTTP_302_FOUND)
    redirect_response.delete_cookie(key='access_token')
    return redirect_response

### Pages ###


@router.get('/todo-page')
async def render_todo_page(request: Request, db: db_dependency):
    try:
        user = await get_current_user(request.cookies.get('access_token'))
        if user is None:
            return redirect_to_login()
        todos = db.query(Todos).filter(Todos.owner_id == user.get('id')).all()
        return templates.TemplateResponse('todo.html', {'request': request, 'todos': todos, 'user': user})
    except:
        return redirect_to_login()


@router.get('/add-todo-page')
async def render_todo_page(request: Request):
    try:
        user = await get_current_user(request.cookies.get('access_token'))
        if user is None:
            return redirect_to_login()
        return templates.TemplateResponse('add-todo.html', {'request': request, 'user': user})
    except:
        return redirect_to_login()


@router.get('/edit-todo-page/{todo_id}')
async def render_todo_page(request: Request, todo_id: int, db: db_dependency):
    try:
        user = await get_current_user(request.cookies.get('access_token'))
        if user is None:
            return redirect_to_login()
        todo = db.query(Todos).filter(Todos.id == todo_id).first()
        return templates.TemplateResponse('edit-todo.html', {'request': request, "todo": todo, 'user': user})
    except:
        return redirect_to_login()

### Endpoints ###


@router.get('/', status_code=status.HTTP_200_OK)
async def read_all(user: user_dependency, db: db_dependency):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    return db.query(Todos).filter(Todos.owner_id == user.get('id')).all()


@router.get('/todo/{todo_id}', status_code=status.HTTP_200_OK)
async def read_todo(user: user_dependency, db: db_dependency, todo_id: int = Path(gt=0)):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    todo_model = db.query(Todos).filter(Todos.id == todo_id).filter(
        Todos.owner_id == user.get('id')).first()
    if todo_model is not None:
        return todo_model
    raise HTTPException(status_code=404, detail='Todo not found.')


@router.post('/todo', status_code=status.HTTP_201_CREATED)
async def create_todo(user: user_dependency, db: db_dependency, todo_request: TodoRequest):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    todo_model = Todos(**todo_request.model_dump(), owner_id=user.get('id'))
    db.add(todo_model)
    db.commit()


@router.put('/todo/{todo_id}', status_code=status.HTTP_204_NO_CONTENT)
async def update_todo(user: user_dependency, db: db_dependency, todo_request: TodoRequest, todo_id: int = Path(gt=0)):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    todo_model = db.query(Todos).filter(Todos.id == todo_id).filter(
        Todos.owner_id == user.get('id')).first()
    if todo_model is None:
        raise HTTPException(status_code=404, detail='Todo not found.')
    todo_model.title = todo_request.title
    todo_model.description = todo_request.description
    todo_model.priority = todo_request.priority
    todo_model.complete = todo_request.complete

    db.add(todo_model)
    db.commit()


@router.delete('/todo/{todo_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(user: user_dependency, db: db_dependency, todo_id: int = Path(gt=0)):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    todo_model = db.query(Todos).filter(Todos.id == todo_id).filter(
        Todos.owner_id == user.get('id')).first()
    if todo_model is None:
        raise HTTPException(status_code=404, detail='Todo not found.')
    db.query(Todos).filter(Todos.id == todo_id).filter(
        Todos.owner_id == user.get('id')).delete()

    db.commit()


@router.post('/suggest-description', status_code=status.HTTP_200_OK)
async def suggest_description(user: user_dependency,
                              request_body: DescriptionSuggestRequest):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed.')
    try:
        prompt = f"Based on the following to-do item title, generate a brief description suggestion. The description should be the same language as the title and no more than 80 characters. ONLY SUGGESTION NO OTHER CONTENTS.\ntitle: '{request_body.title}'"
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt)
        return {"suggestion": response.text}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate description suggestions: {str(e)}"
        )
