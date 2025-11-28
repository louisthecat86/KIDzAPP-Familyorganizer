#!/usr/bin/env python3
"""
Add Entry Script for Bitcoin Tracker
Usage: python add_entry.py 1500
"""
import sqlite3
import sys
import os
import requests
from datetime import datetime
from db_setup import setup_database, DB_FILE

def get_btc_price_eur():
    """Fetch current Bitcoin price in EUR from CoinGecko API"""
    try:
        response = requests.get(
            'https://api.coingecko.com/api/v3/simple/price',
            params={'ids': 'bitcoin', 'vs_currencies': 'eur'},
            timeout=10
        )
        response.raise_for_status()
        btc_price = response.json()['bitcoin']['eur']
        print(f"✓ Current BTC price: €{btc_price:,.2f}")
        return btc_price
    except Exception as e:
        print(f"✗ Error fetching BTC price: {e}")
        return None

def get_last_total_satoshi():
    """Get the cumulative satoshi from the last entry"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('SELECT gesamt_satoshi_bis_dahin FROM entries ORDER BY id DESC LIMIT 1')
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0
    except:
        return 0

def add_entry(verdiente_satoshi):
    """Add a new entry to the database"""
    # Get current BTC price
    btc_price = get_btc_price_eur()
    if btc_price is None:
        print("✗ Cannot add entry without BTC price")
        return False
    
    # Calculate cumulative satoshi
    last_total = get_last_total_satoshi()
    gesamt_satoshi = last_total + verdiente_satoshi
    
    # Calculate euro value
    euro_wert = (gesamt_satoshi / 100_000_000) * btc_price
    
    # Insert into database
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO entries (verdiente_satoshi, btc_eur_preis, gesamt_satoshi_bis_dahin, euro_wert)
            VALUES (?, ?, ?, ?)
        ''', (verdiente_satoshi, btc_price, gesamt_satoshi, euro_wert))
        
        conn.commit()
        conn.close()
        
        print(f"\n✓ Entry added successfully!")
        print(f"  Verdiente Satoshi: {verdiente_satoshi}")
        print(f"  BTC Preis (EUR): €{btc_price:,.2f}")
        print(f"  Gesamt Satoshi: {gesamt_satoshi}")
        print(f"  Euro-Wert: €{euro_wert:,.2f}")
        return True
    except Exception as e:
        print(f"✗ Error adding entry: {e}")
        return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python add_entry.py <satoshi_amount>")
        print("Example: python add_entry.py 1500")
        sys.exit(1)
    
    try:
        verdiente_satoshi = int(sys.argv[1])
        if verdiente_satoshi <= 0:
            print("✗ Satoshi amount must be greater than 0")
            sys.exit(1)
    except ValueError:
        print(f"✗ Invalid satoshi amount: {sys.argv[1]}")
        sys.exit(1)
    
    # Ensure database exists
    if not os.path.exists(DB_FILE):
        print(f"Database not found. Creating '{DB_FILE}'...")
        setup_database()
    
    # Add entry
    add_entry(verdiente_satoshi)

if __name__ == "__main__":
    main()
