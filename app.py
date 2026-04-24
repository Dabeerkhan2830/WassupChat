from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'wassup-chat-secret-key-2024')
db_url = os.getenv('DATABASE_URL', 'sqlite:///chat.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins='*')

# ─── MODELS ────────────────────────────────────────────────────────────────────
class Message(db.Model):
    id        = db.Column(db.Integer, primary_key=True)
    username  = db.Column(db.String(80), nullable=False)
    room      = db.Column(db.String(80), nullable=False, default='general', index=True)
    content   = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)

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
    name   = db.Column(db.String(50),  nullable=False, index=True)
    phone  = db.Column(db.String(15),  nullable=False, index=True)
    email  = db.Column(db.String(50),  nullable=False, index=True)
    course = db.Column(db.String(20),  nullable=False)
    year   = db.Column(db.String(10),  nullable=False)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'phone': self.phone,
                'email': self.email, 'course': self.course, 'year': self.year}

with app.app_context():
    db.create_all()

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

@socketio.on('delete_message')
def handle_delete_message(data):
    msg_id = data.get('id')
    username = data.get('username')
    room = data.get('room')
    
    if msg_id:
        msg = Message.query.get(msg_id)
        # Ensure the user deleting it is the one who sent it
        if msg and msg.username == username:
            with app.app_context():
                db.session.delete(msg)
                db.session.commit()
            emit('message_deleted', {'id': msg_id, 'room': room}, to=room)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)
