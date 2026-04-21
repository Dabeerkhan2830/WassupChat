# ⚡ WassupChat — Premium Real-Time Messenger

A high-fidelity **WhatsApp clone** built with Flask, WebSockets, and a searchable student directory. Designed for speed, aesthetics, and cloud-native deployment.

---

## 🚀 Features

- **WhatsApp-Style UI** — Complete with chat bubbles, tails, double-ticks, and a left-panel contact list.
- **Real-Time Messaging** — Powered by `Flask-SocketIO` (WebSockets) for instant message delivery.
- **Live Typing Indicators** — See when others are typing in real-time.
- **Message History** — Persistent storage using SQLAlchemy (loads last 50 messages on join).
- **Student Directory** — Integrated searchable database for **CSE-AIML 1st Year** students.
- **Cloud-Ready** — Perfect for deployment on Azure (VM + SQL + Blob Storage).

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python / Flask |
| **Real-time** | Socket.IO |
| **Database** | SQLite (Local) / Azure SQL (Prod) |
| **Frontend** | HTML5, CSS3 (Advanced Bubbles), JS (Vanilla) |
| **Aesthetics** | WhatsApp Dark Mode / Glassmorphism |

---

## 📁 Project Structure

```
Eco10_project/
├── app.py              # Application backend & Socket.IO logic
├── requirements.txt    # Python dependencies
├── static/
│   ├── css/style.css   # Pixel-perfect WhatsApp styling
│   └── js/script.js    # Client-side Socket.IO & UI logic
├── templates/
│   ├── index.html      # Main chat interface
│   └── students.html   # Searchable student directory
├── .env.example        # Template for cloud credentials
└── README.md           # Project documentation
```

---

## ⚙️ How to Run Locally

### 1. Prerequisites
- Python 3.10+
- pip

### 2. Installation
```bash
git clone https://github.com/Dabeerkhan2830/WassupChat.git
cd WassupChat
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the App
```bash
python app.py
```
Visit **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

---

## 🎓 Student Directory API

| Endpoint | Method | Description |
|---|---|---|
| `/students` | GET | Renders the student directory UI |
| `/api/students` | GET | Returns JSON list of all students |
| `/api/students?q=name` | GET | Search students by name, email, or phone |

---

## ☁️ Azure Deployment Steps

1. **Step 1**: Create an Azure VM (Ubuntu 22.04).
2. **Step 2**: Open ports 22, 80, 443 in the Network Security Group.
3. **Step 3**: Install Nginx and configure it as a reverse proxy (config included in repo).
4. **Step 4**: Set up Azure SQL and update `DATABASE_URL` in your env.
5. **Step 5**: Run via Gunicorn for production performance.

---

*Built for the ECO Practicals Practical.*
