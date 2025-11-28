#!/usr/bin/env python3
"""
Generate Chart Script for Bitcoin Tracker
Creates a dual-axis chart with Euro value and BTC price
Usage: python generate_chart.py
"""
import sqlite3
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
import os
from db_setup import DB_FILE

def load_data():
    """Load all entries from database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, euro_wert, btc_eur_preis 
            FROM entries 
            ORDER BY id ASC
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            print("✗ No data in database. Add entries first with: python add_entry.py 1000")
            return None
        
        return rows
    except Exception as e:
        print(f"✗ Error loading data: {e}")
        return None

def parse_timestamp(ts_string):
    """Parse ISO format timestamp"""
    try:
        return datetime.fromisoformat(ts_string.replace('Z', '+00:00'))
    except:
        return datetime.fromisoformat(ts_string)

def generate_chart(rows):
    """Generate and save the chart"""
    # Extract data
    timestamps = []
    euro_values = []
    btc_prices = []
    
    for row in rows:
        ts, euro_val, btc_price = row
        timestamps.append(parse_timestamp(ts))
        euro_values.append(euro_val)
        btc_prices.append(btc_price)
    
    # Create figure with dark theme
    plt.style.use('dark_background')
    fig, ax1 = plt.subplots(figsize=(14, 7))
    fig.patch.set_facecolor('#0f172a')
    ax1.set_facecolor('#1e293b')
    
    # Plot Euro value on left axis
    color1 = '#fbbf24'  # Amber
    ax1.set_xlabel('Datum', color='#94a3b8', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Euro-Wert (€)', color=color1, fontsize=11, fontweight='bold')
    line1 = ax1.plot(timestamps, euro_values, color=color1, linewidth=2.5, marker='o', 
                     markersize=6, label='Euro-Wert der Satoshis', alpha=0.8)
    ax1.tick_params(axis='y', labelcolor=color1)
    ax1.grid(True, alpha=0.2, linestyle='--')
    
    # Format left y-axis as currency
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'€{x:.2f}'))
    
    # Create second y-axis for BTC price
    ax2 = ax1.twinx()
    color2 = '#60a5fa'  # Blue
    ax2.set_ylabel('BTC-Preis (EUR)', color=color2, fontsize=11, fontweight='bold')
    line2 = ax2.plot(timestamps, btc_prices, color=color2, linewidth=2.5, marker='s', 
                     markersize=6, label='BTC-Preis (EUR)', alpha=0.8)
    ax2.tick_params(axis='y', labelcolor=color2)
    
    # Format right y-axis as currency
    ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'€{x:,.0f}'))
    
    # Format x-axis (dates)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%d.%m.%Y'))
    ax1.xaxis.set_major_locator(mdates.AutoDateLocator())
    fig.autofmt_xdate(rotation=45, ha='right')
    
    # Title and legend
    plt.title('Bitcoin Tracker: Entwicklung des Euro-Wertes & BTC-Preis', 
              fontsize=14, fontweight='bold', color='#e2e8f0', pad=20)
    
    # Combine legends
    lines = line1 + line2
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left', framealpha=0.9, fontsize=10)
    
    # Tight layout
    plt.tight_layout()
    
    # Save chart
    output_file = 'entwicklung.png'
    plt.savefig(output_file, dpi=150, facecolor='#0f172a', edgecolor='none')
    print(f"✓ Chart saved as '{output_file}'")
    
    # Print statistics
    print(f"\n📊 Chart Statistics:")
    print(f"  Datenpunkte: {len(rows)}")
    print(f"  Zeitraum: {timestamps[0].strftime('%d.%m.%Y %H:%M')} → {timestamps[-1].strftime('%d.%m.%Y %H:%M')}")
    print(f"  Euro-Wert Min/Max: €{min(euro_values):.2f} / €{max(euro_values):.2f}")
    print(f"  BTC-Preis Min/Max: €{min(btc_prices):,.2f} / €{max(btc_prices):,.2f}")
    
    plt.close()

def main():
    if not os.path.exists(DB_FILE):
        print(f"✗ Database '{DB_FILE}' not found. Add entries first with: python add_entry.py 1000")
        return
    
    print("📊 Generating chart...")
    rows = load_data()
    
    if rows:
        generate_chart(rows)
    else:
        print("Cannot generate chart without data.")

if __name__ == "__main__":
    main()
