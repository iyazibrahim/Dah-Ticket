package models

import "fmt"

type HoldReason string

const (
	HoldAwaitingCustomer  HoldReason = "awaiting_customer"
	HoldAwaitingVendor    HoldReason = "awaiting_vendor"
	HoldPendingApproval   HoldReason = "pending_approval"
	HoldBlocked           HoldReason = "blocked"
	HoldOther             HoldReason = "other"
)

type TransitionContext struct {
	IsStaff         bool
	IsRequester     bool
	IsAssignee      bool
	CanAssignAnyone bool
	ForceClose      bool // explicit "close without resolve" from open/in_progress
}

func IsValidHoldReason(r string) bool {
	switch HoldReason(r) {
	case HoldAwaitingCustomer, HoldAwaitingVendor, HoldPendingApproval, HoldBlocked, HoldOther:
		return true
	default:
		return false
	}
}

func canActOnTicket(ctx TransitionContext) bool {
	return ctx.IsAssignee || ctx.CanAssignAnyone
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
			return nil
		case StatusClosed:
			if ctx.ForceClose {
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
				return fmt.Errorf("only the assignee or a manager can update this ticket")
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
				return fmt.Errorf("only the assignee or a manager can resume this ticket")
			}
			return nil
		default:
			return fmt.Errorf("invalid transition from on_hold to %s", to)
		}
	case StatusResolved:
		switch to {
		case StatusClosed, StatusInProgress:
			return nil
		default:
			return fmt.Errorf("invalid transition from resolved to %s", to)
		}
	case StatusClosed:
		switch to {
		case StatusInProgress:
			if !canActOnTicket(ctx) && !ctx.CanAssignAnyone {
				return fmt.Errorf("only staff can reopen closed tickets")
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
