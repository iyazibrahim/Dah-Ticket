package models

// CanManageTicketWorkflow returns whether the actor may change ticket workflow fields
// (status, priority, assignment, type, category, resolution/closure).
func CanManageTicketWorkflow(actor User, ticket Ticket) bool {
	if ticket.AssigneeID != nil && *ticket.AssigneeID == actor.ID {
		return true
	}
	if actor.CanAssignAnyone() {
		if ticket.AssigneeID == nil {
			return true
		}
		return ticket.IsEscalated
	}
	return false
}
