# Gunicorn configuration for WassupChat
import os

# Socket.IO requires a single worker to maintain state unless using a message queue
workers = 1
worker_class = 'eventlet'
bind = '127.0.0.1:5000'
timeout = 600
accesslog = '-'
errorlog = '-'
