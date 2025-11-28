# 💰 Bitcoin Tracker

Ein Python-Projekt zur Verfolgung von verdienten Satoshis und deren Euro-Wert mit Live-Bitcoin-Preisen und automatischer Chart-Generierung.

## 🎯 Funktionalität

Das Projekt speichert Einträge mit folgenden Datenpunkten:
- **Timestamp**: Zeitpunkt der Eintragung
- **Verdiente Satoshi**: Neue Satoshis in diesem Eintrag
- **BTC EUR Preis**: Aktueller Bitcoin-Preis (live von CoinGecko API)
- **Gesamt Satoshi**: Kumulierte Summe aller Satoshis
- **Euro-Wert**: Gesamtsumme × BTC-Preis ÷ 100.000.000

## 📊 Features

✅ SQLite-Datenbank mit automatischer Struktur
✅ Live-Bitcoin-Preis von CoinGecko API (kein API-Key erforderlich)
✅ Dual-Axis Chart mit Matplotlib:
   - Linke Achse: Euro-Wert der Satoshis
   - Rechte Achse: BTC-Preis (EUR)
✅ Dunkles Theme für Charts
✅ Automatische Datenbank-Initialisierung

## 🚀 Installation

### 1. Abhängigkeiten installieren

```bash
pip install requests matplotlib pandas
```

### 2. Datenbank initialisieren (optional)

```bash
python db_setup.py
```

Die Datenbank wird automatisch erstellt, wenn Sie das erste Mal einen Eintrag hinzufügen.

## 📝 Verwendung

### Eintrag hinzufügen

```bash
python add_entry.py 1500
```

Dies addiert **1500 Satoshis** und:
- Fetcht den aktuellen BTC-Preis von CoinGecko
- Berechnet die neue Gesamtsumme
- Speichert den Eintrag in der Datenbank
- Zeigt eine Zusammenfassung an

**Beispiel-Output:**
```
✓ Current BTC price: €91.430,00
✓ Entry added successfully!
  Verdiente Satoshi: 1500
  BTC Preis (EUR): €91.430,00
  Gesamt Satoshi: 5150
  Euro-Wert: €4.71
```

### Chart generieren

```bash
python generate_chart.py
```

Dies erzeugt eine **entwicklung.png** mit:
- Zeitbasierte X-Achse (Datum)
- Euro-Wert Kurve (gelb/amber, linke Y-Achse)
- BTC-Preis Kurve (blau, rechte Y-Achse)
- Automatische Skalierung basierend auf Datenpunkten

## 📁 Dateistruktur

```
bitcoin-tracker/
├── db_setup.py           # Datenbankinitialisierung
├── add_entry.py          # Script zum Hinzufügen von Einträgen
├── generate_chart.py     # Chart-Generierung
├── README.md             # Diese Datei
├── bitcoin_tracker.db    # SQLite-Datenbank (wird automatisch erstellt)
└── entwicklung.png       # Generiertes Chart (wird beim ersten Mal erstellt)
```

## 💡 Workflow-Beispiel

```bash
# 1. Eintrag hinzufügen
python add_entry.py 500

# 2. Weiterer Eintrag
python add_entry.py 1000

# 3. Chart generieren
python generate_chart.py

# 4. Chart anschauen: entwicklung.png
```

## 🔍 Datenbank-Schema

Die `bitcoin_tracker.db` enthält eine `entries` Tabelle:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | INTEGER (PK) | Eindeutige ID |
| timestamp | DATETIME | Zeitstempel des Eintrags |
| verdiente_satoshi | INTEGER | Neue Satoshis in diesem Eintrag |
| btc_eur_preis | REAL | BTC-Kurs zum Zeitpunkt der Eintragung |
| gesamt_satoshi_bis_dahin | INTEGER | Kumulierte Gesamtsumme |
| euro_wert | REAL | Euro-Wert der Gesamtsumme |

## 🌐 API-Integration

Das Projekt verwendet die **CoinGecko API** (kostenlos, kein API-Key erforderlich):
- Endpoint: `https://api.coingecko.com/api/v3/simple/price`
- Gibt den aktuellen Bitcoin-Preis in EUR zurück

## 🎨 Chart-Design

Das generierte Chart hat ein modernes dunkles Theme:
- Hintergrund: Slate (#0f172a)
- Euro-Wert: Amber-Gelb (#fbbf24)
- BTC-Preis: Blau (#60a5fa)
- Gitter: Subtil mit Alpha-Transparenz

## ⚠️ Anforderungen

- Python 3.7+
- requests (für API-Calls)
- matplotlib (für Chart)
- pandas (optional, für erweiterte Datenanalysis)

## 🐛 Fehlerbehebung

**Fehler: "No data in database"**
- Zuerst Einträge hinzufügen: `python add_entry.py 1000`

**Fehler: "Cannot fetch BTC price"**
- CoinGecko API ist möglicherweise überlastet
- Versuchen Sie es später erneut

**Fehler: "No module named requests"**
- Installieren Sie die Abhängigkeiten: `pip install requests`

## 📄 Lizenz

Frei verwendbar für persönliche Projekte.

---

**Viel Erfolg beim Tracking deiner Satoshis! 🚀**
