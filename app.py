from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'wassup-chat-secret-key-2024')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///chat.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins='*')

# ─── MODELS ────────────────────────────────────────────────────────────────────
class Message(db.Model):
    id        = db.Column(db.Integer, primary_key=True)
    username  = db.Column(db.String(80), nullable=False)
    room      = db.Column(db.String(80), nullable=False, default='general')
    content   = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':        self.id,
            'username':  self.username,
            'room':      self.room,
            'content':   self.content,
            'timestamp': self.timestamp.strftime('%H:%M')
        }

class Student(db.Model):
    id     = db.Column(db.Integer, primary_key=True)
    name   = db.Column(db.String(50),  nullable=False)
    phone  = db.Column(db.String(15),  nullable=False)
    email  = db.Column(db.String(50),  nullable=False)
    course = db.Column(db.String(20),  nullable=False)
    year   = db.Column(db.String(10),  nullable=False)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'phone': self.phone,
                'email': self.email, 'course': self.course, 'year': self.year}

# ─── SEED DATA ─────────────────────────────────────────────────────────────────
STUDENTS_SEED = [
    (1,'Dabeer Khan',   '9528170614','aarav1@gmail.com',   'CSE-AIML','1st'),
    (2,'Mohd Yusuf',    '9876500002','vivaan2@gmail.com',  'CSE-AIML','1st'),
    (3,'Hardik Patel',  '9876500003','aditya3@gmail.com',  'CSE-AIML','1st'),
    (4,'Krishna Singh', '9876500004','krishna4@gmail.com', 'CSE-AIML','1st'),
    (5,'Arjun Mehta',   '9876500005','arjun5@gmail.com',   'CSE-AIML','1st'),
    (6,'Ishaan Kapoor', '9876500006','ishaan6@gmail.com',  'CSE-AIML','1st'),
    (7,'Rohan Das',     '9876500007','rohan7@gmail.com',   'CSE-AIML','1st'),
    (8,'Kabir Jain',    '9876500008','kabir8@gmail.com',   'CSE-AIML','1st'),
    (9,'Dev Patel',     '9876500009','dev9@gmail.com',     'CSE-AIML','1st'),
    (10,'Yash Agarwal', '9876500010','yash10@gmail.com',   'CSE-AIML','1st'),
    (11,'Ananya Sharma','9876500011','ananya11@gmail.com', 'CSE-AIML','1st'),
    (12,'Diya Gupta',   '9876500012','diya12@gmail.com',   'CSE-AIML','1st'),
    (13,'Sara Khan',    '9876500013','sara13@gmail.com',   'CSE-AIML','1st'),
    (14,'Meera Iyer',   '9876500014','meera14@gmail.com',  'CSE-AIML','1st'),
    (15,'Riya Verma',   '9876500015','riya15@gmail.com',   'CSE-AIML','1st'),
    (16,'Kavya Nair',   '9876500016','kavya16@gmail.com',  'CSE-AIML','1st'),
    (17,'Pooja Singh',  '9876500017','pooja17@gmail.com',  'CSE-AIML','1st'),
    (18,'Neha Mishra',  '9876500018','neha18@gmail.com',   'CSE-AIML','1st'),
    (19,'Priya Joshi',  '9876500019','priya19@gmail.com',  'CSE-AIML','1st'),
    (20,'Simran Kaur',  '9876500020','simran20@gmail.com', 'CSE-AIML','1st'),
]

with app.app_context():
    db.create_all()
    # Seed students only if table is empty
    if Student.query.count() == 0:
        for row in STUDENTS_SEED:
            db.session.add(Student(id=row[0], name=row[1], phone=row[2],
                                   email=row[3], course=row[4], year=row[5]))
        db.session.commit()
        print(f'[DB] Seeded {len(STUDENTS_SEED)} students.')

# ─── ROUTES ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/history/<room>')
def history(room):
    messages = Message.query.filter_by(room=room)\
                            .order_by(Message.timestamp.asc())\
                            .limit(50).all()
    return {'messages': [m.to_dict() for m in messages]}

@app.route('/students')
def students_page():
    return render_template('students.html')

@app.route('/api/students')
def api_students():
    q = request.args.get('q', '').strip()
    query = Student.query
    if q:
        like = f'%{q}%'
        query = query.filter(
            Student.name.ilike(like) |
            Student.email.ilike(like) |
            Student.phone.ilike(like)
        )
    return {'students': [s.to_dict() for s in query.order_by(Student.id).all()]}

# ─── SOCKET EVENTS ─────────────────────────────────────────────────────────────
@socketio.on('join')
def on_join(data):
    username = data.get('username', 'Anonymous')
    room     = data.get('room', 'general')
    join_room(room)
    emit('system', {
        'msg': f'{username} joined #{room}',
        'timestamp': datetime.utcnow().strftime('%H:%M')
    }, to=room)

@socketio.on('leave')
def on_leave(data):
    username = data.get('username', 'Anonymous')
    room     = data.get('room', 'general')
    leave_room(room)
    emit('system', {
        'msg': f'{username} left #{room}',
        'timestamp': datetime.utcnow().strftime('%H:%M')
    }, to=room)

@socketio.on('message')
def handle_message(data):
    username = data.get('username', 'Anonymous')
    room     = data.get('room', 'general')
    content  = data.get('content', '').strip()
    if not content:
        return

    # Persist to DB (Step 5 — SQL message history)
    msg = Message(username=username, room=room, content=content)
    with app.app_context():
        db.session.add(msg)
        db.session.commit()
        payload = msg.to_dict()

    emit('message', payload, to=room)

@socketio.on('typing')
def handle_typing(data):
    room = data.get('room', 'general')
    emit('typing', {'username': data.get('username'), 'room': room}, to=room, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)
