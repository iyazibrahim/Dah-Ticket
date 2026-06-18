package models

// Permission helpers for tiered RBAC (Option A: base role + is_admin + is_super_admin).

func (u User) IsStaffMember() bool {
	return u.Role == RoleITAgent || u.Role == RoleManager || u.Role == RoleAdmin
}

func (u User) IsDelegatedAdmin() bool {
	return u.Role == RoleITAgent && u.IsAdmin
}

func (u User) IsFullAdmin() bool {
	return u.IsSuperAdmin || (u.Role == RoleManager && u.IsAdmin) || (u.Role == RoleAdmin && u.IsAdmin)
}

func (u User) HasAdminElevation() bool {
	return u.IsAdmin || u.IsSuperAdmin || u.Role == RoleAdmin
}

func (u User) CanAcceptTickets() bool {
	return u.IsStaffMember()
}

func (u User) CanAssignAnyone() bool {
	return u.Role == RoleManager || u.IsFullAdmin() || u.Role == RoleAdmin
}

func (u User) CanAssignITAgents() bool {
	return u.CanAssignAnyone() || u.IsDelegatedAdmin()
}

func (u User) CanPromoteAdmin() bool {
	return u.IsFullAdmin()
}

func (u User) CanAccessFullSettings() bool {
	return u.IsFullAdmin()
}

func (u User) CanManageUsers() bool {
	return u.IsFullAdmin()
}

func (u User) CanEditAnyWiki() bool {
	return u.Role == RoleManager || u.HasAdminElevation()
}

func (u User) CanManageKBCategories() bool {
	return u.HasAdminElevation()
}

func (u User) CanPublishWiki() bool {
	return u.Role == RoleManager || u.HasAdminElevation()
}

func (u User) IsAssignableStaff() bool {
	return u.Role == RoleITAgent || u.Role == RoleManager || u.Role == RoleAdmin
}

// HasLocationScope is true when the user is restricted to a single primary location (PIC).
func (u User) HasLocationScope() bool {
	if u.IsSuperAdmin || u.IsFullAdmin() {
		return false
	}
	return u.PrimaryLocationID != nil
}

// ScopedLocationID returns the user's primary location when location-scoped.
func (u User) ScopedLocationID() *uint {
	if u.HasLocationScope() {
		return u.PrimaryLocationID
	}
	return nil
}
