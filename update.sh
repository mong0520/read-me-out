#!/bin/sh
pkill flask
git checkout develop
git pull
#flask db migrate
nohup flask run --host=0.0.0.0 --port=5000 > flask.log 2>&1 &
ps aux | grep flask
