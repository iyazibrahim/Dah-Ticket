package models

import "fmt"

type HoldReason string

const (
	HoldAwaitingCustomer HoldReason = "awaiting_customer"
	HoldAwaitingVendor   HoldReason = "awaiting_vendor"
	HoldPendingApproval  HoldReason = "pending_approval"
	HoldBlocked          HoldReason = "blocked"
	HoldOther            HoldReason = "other"
)

type ResolutionCode string

const (
	ResolutionFixed            ResolutionCode = "fixed"
	ResolutionWorkaround       ResolutionCode = "workaround"
	ResolutionUserEducation    ResolutionCode = "user_education"
	ResolutionDuplicate        ResolutionCode = "duplicate"
	ResolutionCannotReproduce  ResolutionCode = "cannot_reproduce"
	ResolutionCancelled        ResolutionCode = "cancelled"
)

type ClosureCode string

const (
	ClosureResolvedConfirmed ClosureCode = "resolved_confirmed"
	ClosureAutoClosed        ClosureCode = "auto_closed"
	ClosureDuplicate         ClosureCode = "duplicate"
	ClosureCancelled         ClosureCode = "cancelled"
)

type TransitionContext struct {
	IsStaff             bool
	IsRequester         bool
	IsAssignee          bool
	CanAssignAnyone     bool
	CanManageWorkflow   bool
	ForceClose          bool
	HasAssignee         bool
	AssignmentAccepted  bool
}

func IsValidHoldReason(r string) bool {
	switch HoldReason(r) {
	case HoldAwaitingCustomer, HoldAwaitingVendor, HoldPendingApproval, HoldBlocked, HoldOther:
		return true
	default:
		return false
	}
}

func IsValidResolutionCode(c string) bool {
	switch ResolutionCode(c) {
	case ResolutionFixed, ResolutionWorkaround, ResolutionUserEducation,
		ResolutionDuplicate, ResolutionCannotReproduce, ResolutionCancelled:
		return true
	default:
		return false
	}
}

func IsValidClosureCode(c string) bool {
	switch ClosureCode(c) {
	case ClosureResolvedConfirmed, ClosureAutoClosed, ClosureDuplicate, ClosureCancelled:
		return true
	default:
		return false
	}
}

// HoldReasonPausesSLA returns true when the hold reason should pause the resolution SLA clock.
func HoldReasonPausesSLA(r HoldReason) bool {
	return r == HoldAwaitingCustomer || r == HoldAwaitingVendor
}

func canActOnTicket(ctx TransitionContext) bool {
	return ctx.CanManageWorkflow
}

// ValidateStatusTransition enforces ITIL-aligned status transitions.
func ValidateStatusTransition(from, to TicketStatus, ctx TransitionContext) error {
	if from == to {
		return nil
	}

	// Requester transitions
	if ctx.IsRequester && !ctx.IsStaff {
		switch {
		case from == StatusResolved && to == StatusClosed:
			return nil
		case from == StatusResolved && to == StatusInProgress:
			return nil
		default:
			return fmt.Errorf("requesters can only accept or reopen resolved tickets")
		}
	}

	// Staff transitions
	if !ctx.IsStaff {
		return fmt.Errorf("you do not have permission to change ticket status")
	}

	switch from {
	case StatusOpen:
		switch to {
		case StatusInProgress:
			if !ctx.HasAssignee {
				return fmt.Errorf("ticket must be assigned before starting progress")
			}
			if !ctx.CanManageWorkflow {
				return fmt.Errorf("only the assignee or an escalated manager can start progress on this ticket")
			}
			if !ctx.AssignmentAccepted && !ctx.IsAssignee {
				return fmt.Errorf("assignee must accept the ticket before starting progress")
			}
			return nil
		case StatusClosed:
			if ctx.ForceClose && ctx.CanManageWorkflow {
				return nil
			}
			return fmt.Errorf("use resolve before closing, or use close without resolve")
		default:
			return fmt.Errorf("invalid transition from open to %s", to)
		}
	case StatusInProgress:
		switch to {
		case StatusOnHold, StatusResolved:
			if !canActOnTicket(ctx) {
				return fmt.Errorf("only the assignee or a manager after escalation can update this ticket")
			}
			return nil
		case StatusClosed:
			if ctx.ForceClose && canActOnTicket(ctx) {
				return nil
			}
			return fmt.Errorf("mark resolved before closing, or use close without resolve")
		default:
			return fmt.Errorf("invalid transition from in_progress to %s", to)
		}
	case StatusOnHold:
		switch to {
		case StatusInProgress:
			if !canActOnTicket(ctx) {
				return fmt.Errorf("only the assignee or a manager after escalation can resume this ticket")
			}
			return nil
		default:
			return fmt.Errorf("invalid transition from on_hold to %s", to)
		}
	case StatusResolved:
		switch to {
		case StatusClosed, StatusInProgress:
			if to == StatusClosed && ctx.IsStaff && !ctx.IsRequester && !ctx.CanManageWorkflow {
				return fmt.Errorf("only the assignee or a manager after escalation can close this ticket")
			}
			return nil
		default:
			return fmt.Errorf("invalid transition from resolved to %s", to)
		}
	case StatusClosed:
		switch to {
		case StatusInProgress:
			if !canActOnTicket(ctx) {
				return fmt.Errorf("only the assignee or a manager after escalation can reopen this ticket")
			}
			return nil
		default:
			return fmt.Errorf("invalid transition from closed to %s", to)
		}
	default:
		return fmt.Errorf("unknown status: %s", from)
	}
}

func NextPriority(p TicketPriority) TicketPriority {
	switch p {
	case PriorityLow:
		return PriorityMedium
	case PriorityMedium:
		return PriorityHigh
	case PriorityHigh, PriorityCritical:
		return PriorityCritical
	default:
		return PriorityMedium
	}
}
