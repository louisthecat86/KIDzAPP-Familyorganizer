#!/usr/bin/env python3
"""
SQLite Database Setup for Bitcoin Tracker
Creates the database and schema automatically
"""
import sqlite3
import os

DB_FILE = "bitcoin_tracker.db"

def setup_database():
    """Create database and tables if they don't exist"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create entries table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            verdiente_satoshi INTEGER NOT NULL,
            btc_eur_preis REAL NOT NULL,
            gesamt_satoshi_bis_dahin INTEGER NOT NULL,
            euro_wert REAL NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"✓ Database '{DB_FILE}' initialized successfully")

if __name__ == "__main__":
    setup_database()
