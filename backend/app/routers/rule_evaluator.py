import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import RuleEvaluationRequest, RuleEvaluationResponse, FieldEvaluation
from ..services.rule_evaluator_service import RuleEvaluationService

router = APIRouter(prefix="/api", tags=["rule-evaluation"])


@router.post("/forms/{form_id}/evaluate-rules", response_model=RuleEvaluationResponse)
async def evaluate_rules(
    form_id: int,
    request: RuleEvaluationRequest,
    db: Session = Depends(get_db),
):
    """Evaluate all conditional rules for a form against submitted values."""
    try:
        field_states, triggered_rule_ids = RuleEvaluationService.evaluate(
            db=db,
            form_id=form_id,
            form_values=request.form_values,
        )

        field_evaluations = []
        for field_id, state in field_states.items():
            field_evaluations.append(
                FieldEvaluation(
                    field_id=field_id,
                    visible=state.get("visible", True),
                    required=state.get("required", False),
                )
            )

        return RuleEvaluationResponse(
            field_states=field_evaluations,
            triggered_rules=triggered_rule_ids,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Failed to evaluate rules: {str(e)}"
        )
