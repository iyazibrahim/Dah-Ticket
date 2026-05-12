package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC", host, user, password, dbname, port)

	// Keep trying to connect to the database (it might take a few seconds for postgres to boot up in docker)
	var err error
	var db *gorm.DB
	
	for i := 0; i < 5; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err == nil {
			break
		}
		log.Printf("Failed to connect to database. Retrying in 5 seconds... (%d/5)", i+1)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatal("Could not connect to the database:", err)
	}

	DB = db
	log.Println("Successfully connected to the database")
}
