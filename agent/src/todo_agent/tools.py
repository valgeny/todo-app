"""LangChain tools mirroring the MCP / REST todo contract."""

from __future__ import annotations

import json
from typing import Any, Literal
from urllib.parse import urlencode

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from todo_agent.api import request


def _dump(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


class ListTodosInput(BaseModel):
    status: Literal["all", "completed", "incomplete", "overdue"] = "all"
    sortField: Literal["createdAt", "dueDate", "title"] = "createdAt"
    sortOrder: Literal["ASC", "DESC"] = "DESC"
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class GetTodoInput(BaseModel):
    todoId: str = Field(description="UUID of the to-do")


class CreateTodoInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    dueDate: str | None = Field(default=None, description="YYYY-MM-DD")


class UpdateTodoInput(BaseModel):
    todoId: str
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    dueDate: str | None = Field(default=None, description="YYYY-MM-DD or null via omit")


class TodoIdInput(BaseModel):
    todoId: str


def list_todos(
    status: str = "all",
    sortField: str = "createdAt",
    sortOrder: str = "DESC",
    limit: int = 20,
    offset: int = 0,
) -> str:
    """List to-do items with optional status filter, sort, and pagination."""
    query = urlencode(
        {
            "status": status,
            "sortField": sortField,
            "sortOrder": sortOrder,
            "limit": str(limit),
            "offset": str(offset),
        }
    )
    return _dump(request("GET", f"/api/v0/todos?{query}"))


def get_todo(todoId: str) -> str:
    """Get a single to-do by its UUID."""
    return _dump(request("GET", f"/api/v0/todos/{todoId}"))


def create_todo(
    title: str,
    description: str | None = None,
    dueDate: str | None = None,
) -> str:
    """Create a to-do. Title is required; description and dueDate (YYYY-MM-DD) are optional."""
    body: dict[str, Any] = {"title": title}
    if description is not None:
        body["description"] = description
    if dueDate is not None:
        body["dueDate"] = dueDate
    return _dump(request("POST", "/api/v0/todos", body))


def update_todo(
    todoId: str,
    title: str | None = None,
    description: str | None = None,
    dueDate: str | None = None,
) -> str:
    """Update title, description, and/or dueDate. Provide at least one field."""
    body: dict[str, Any] = {}
    if title is not None:
        body["title"] = title
    if description is not None:
        body["description"] = description
    if dueDate is not None:
        body["dueDate"] = dueDate
    if not body:
        return json.dumps({"error": "Provide at least one of title, description, or dueDate"})
    return _dump(request("PUT", f"/api/v0/todos/{todoId}", body))


def complete_todo(todoId: str) -> str:
    """Mark a to-do as completed by UUID."""
    return _dump(request("PATCH", f"/api/v0/todos/{todoId}", {"isCompleted": True}))


def incomplete_todo(todoId: str) -> str:
    """Mark a to-do as not completed by UUID."""
    return _dump(request("PATCH", f"/api/v0/todos/{todoId}", {"isCompleted": False}))


def delete_todo(todoId: str) -> str:
    """Permanently delete a to-do by UUID."""
    request("DELETE", f"/api/v0/todos/{todoId}")
    return _dump({"deleted": True, "todoId": todoId})


def build_tools() -> list[StructuredTool]:
    return [
        StructuredTool.from_function(
            list_todos,
            name="list_todos",
            args_schema=ListTodosInput,
        ),
        StructuredTool.from_function(
            get_todo,
            name="get_todo",
            args_schema=GetTodoInput,
        ),
        StructuredTool.from_function(
            create_todo,
            name="create_todo",
            args_schema=CreateTodoInput,
        ),
        StructuredTool.from_function(
            update_todo,
            name="update_todo",
            args_schema=UpdateTodoInput,
        ),
        StructuredTool.from_function(
            complete_todo,
            name="complete_todo",
            args_schema=TodoIdInput,
        ),
        StructuredTool.from_function(
            incomplete_todo,
            name="incomplete_todo",
            args_schema=TodoIdInput,
        ),
        StructuredTool.from_function(
            delete_todo,
            name="delete_todo",
            args_schema=TodoIdInput,
        ),
    ]
