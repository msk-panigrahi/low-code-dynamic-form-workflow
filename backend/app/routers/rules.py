import traceback
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import RuleCreate, RuleUpdate, RuleResponse, RuleList
from ..services.rule_service import RuleService

router = APIRouter(prefix="/api", tags=["rules"])


@router.post("/forms/{form_id}/rules", response_model=RuleResponse)
async def create_rule(form_id: int, request: RuleCreate, db: Session = Depends(get_db)):
    """Create a new conditional rule for a form."""
    try:
        rule = RuleService.create_rule(
            db=db,
            form_id=form_id,
            trigger_field_id=request.trigger_field_id,
            operator=request.operator,
            compare_value=request.compare_value,
            target_field_id=request.target_field_id,
            action=request.action,
        )
        return RuleResponse(**rule)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.get("/forms/{form_id}/rules", response_model=RuleList)
async def list_rules(form_id: int, db: Session = Depends(get_db)):
    """Get all conditional rules for a form."""
    try:
        rules = RuleService.get_rules(db=db, form_id=form_id)
        return RuleList(
            rules=[RuleResponse(**r) for r in rules],
            total=len(rules),
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")


@router.put("/forms/{form_id}/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(form_id: int, rule_id: int, request: RuleUpdate, db: Session = Depends(get_db)):
    """Update an existing conditional rule."""
    try:
        rule = RuleService.update_rule(
            db=db,
            form_id=form_id,
            rule_id=rule_id,
            trigger_field_id=request.trigger_field_id,
            operator=request.operator,
            compare_value=request.compare_value,
            target_field_id=request.target_field_id,
            action=request.action,
        )
        return RuleResponse(**rule)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")


@router.patch("/forms/{form_id}/rules/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(form_id: int, rule_id: int, db: Session = Depends(get_db)):
    """Toggle a rule's active status."""
    try:
        rule = RuleService.toggle_rule(db=db, form_id=form_id, rule_id=rule_id)
        return RuleResponse(**rule)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to toggle rule: {str(e)}")


@router.delete("/forms/{form_id}/rules/{rule_id}")
async def delete_rule(form_id: int, rule_id: int, db: Session = Depends(get_db)):
    """Delete a conditional rule."""
    try:
        RuleService.delete_rule(db=db, form_id=form_id, rule_id=rule_id)
        return {"message": "Rule deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete rule: {str(e)}")
