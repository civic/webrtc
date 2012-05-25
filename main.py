#!env/bin/python

import os
import webapp2
from time import gmtime, strftime  
import gevent
import geventwebsocket
from webapp2_extras import jinja2
from webapp2_extras import json
from paste import cascade
from geventwebsocket.handler import WebSocketHandler
import random


class BaseHandler(webapp2.RequestHandler):
  @webapp2.cached_property
  def jinja2(self):
    return jinja2.get_jinja2(app=self.app)

  def render_response(self, _tempplate, **context):
    path = os.path.join(os.path.dirname(__file__), _tempplate)

    rv = self.jinja2.render_template(path, **context)
    self.response.write(rv)

class IndexHandler(BaseHandler):
  def get(self):

    context = {"title": "WebRTC demo"}

    context["initiator"] = "false"
    if self.request.get("i"):
      context["initiator"] = "true"

    source_str = 'abcdefghijklmnopqrstuvwxyz'
    random.choice(source_str)  
    context["uid"] = "".join([random.choice(source_str) for x in xrange(16)])

    self.render_response("template.html", **context)

class MyWebSocketHandler(webapp2.RequestHandler):
  def get(self):
    ws = self.request.environ['wsgi.websocket']
    if ws:
      self.websocket_handle(ws)

  def websocket_handle(self, ws):
    sockets = self.app.registry["rooms"][0] #0 = roby
    try:
      sockets.append(ws)
      while True:
        msg = ws.receive()
        if msg is None:
          break

        self.on_receive(ws, msg)

    except geventwebsocket.WebSocketError, ex:
      console.log("closed")
      ws.close()
      rooms = self.app.registry["rooms"]
      for sockets in rooms:
        sockets.remove(ws)

  def on_receive(self, ws,  message):
    json_obj = json.decode(message)

    if json_obj['act'] == 'sdp':
      room_no = json_obj['room_no']
      sockets = self.app.registry["rooms"][room_no]
      self.send_to(ws, sockets, json_obj)

    elif json_obj['act'] == 'list':
      print "list call"
      rooms = self.app.registry["rooms"]
      list = []
      for sockets in rooms:
        list.append(len(sockets))

      self.send_to(ws, [ws], {"act": "list", "room_list": list}, True)

    elif json_obj['act'] == 'move':
      rooms = self.app.registry["rooms"]
      room_to = json_obj['room_to']
      room_fr = json_obj['room_fr']

      if room_to == 0 or len(rooms[room_to]) < 2:
        if ws in rooms[room_fr]:
          rooms[room_fr].remove(ws)
        rooms[room_to].append(ws)

        self.send_to(ws, [ws], {"act": "move_ok", "count": len(rooms[room_to]), "room_to": room_to}, True)

      #list response
      rooms = self.app.registry["rooms"]
      list = []
      for sockets in rooms:
        list.append(len(sockets))

      targets = []
      for sockets in rooms:
        for tws in sockets:
          targets.append(tws)

      self.send_to(ws, targets, {"act": "list", "room_list": list}, True)

    elif json_obj['act'] == 'leave':
      rooms = self.app.registry["rooms"]
      for sockets in rooms:
        b = len(sockets)
        if ws in sockets:
          sockets.remove(ws)
        print str(b) + ", " + str(len(sockets))
        ws.close()

  def send_to(self, ws, target_sockets, json_obj, include_me = False):
    removes = set()

    json_str = json.encode(json_obj)
    for ts in target_sockets:  
      try:
        if ws != ts or include_me:
          ts.send(json_str)   
      except:
        removes.add(ts)

    rooms = self.app.registry["rooms"]
    for rmv in removes:
      for sockets in rooms:
        if rmv in sockets:
          sockets.remove(rmv)


  def send_all(self, ws, json_obj):
    removes = set()
    sockets = self.app.registry["sockets"]
    json_str = json.encode(json_obj)
    for ts in sockets:  
      try:
        if ws != ts:
          ts.send(json_str)   
      except geventwebsocket.WebSocketError, ex:
        removes.add(ts)

    for rmv in removes:
      if rmv in sockets:
        sockets.remove(rmv)

    print json_str


app = webapp2.WSGIApplication([
    ('/', IndexHandler),
    ('/ws', MyWebSocketHandler),
  ]
  ,debug=True
  ,config={'webapp2_extras.jinja2': {
        'template_path': ['.']
      }
    }
  )
app.registry["rooms"] = [[] for x in xrange(11)];


def main():
  from paste.urlparser import StaticURLParser
  app_static = StaticURLParser("./static")
  app_in = cascade.Cascade([app_static, app])

  server = gevent.pywsgi.WSGIServer(('0.0.0.0', 8080), app_in, handler_class=WebSocketHandler)
  server.serve_forever()

if __name__ == '__main__':
  main()

