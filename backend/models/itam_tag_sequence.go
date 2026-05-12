package models

import "time"

type ITAMTagSequence struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Prefix       string    `gorm:"type:varchar(40);uniqueIndex;not null" json:"prefix"`
	NextSequence uint      `gorm:"default:1" json:"next_sequence"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
