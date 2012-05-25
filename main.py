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

    self.render_response("template.html", **context)

class MyWebSocketHandler(webapp2.RequestHandler):
  def get(self):
    ws = self.request.environ['wsgi.websocket']
    if ws:
      self.websocket_handle(ws)

  def websocket_handle(self, ws):
    sockets = self.app.registry["sockets"]
    try:
      sockets.add(ws)
      while True:
        msg = ws.receive()
        if msg is None:
          break

        self.on_receive(ws, msg)

    except geventwebsocket.WebSocketError, ex:
      ws.close()

  def on_receive(self,ws,  message):
    json_obj = {"sdp": message}

    self.send_all(ws, json_obj)

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
app.registry["sockets"] = set()


def main():
  from paste.urlparser import StaticURLParser
  app_static = StaticURLParser("./static")
  app_in = cascade.Cascade([app_static, app])

  server = gevent.pywsgi.WSGIServer(('0.0.0.0', 8080), app_in, handler_class=WebSocketHandler)
  server.serve_forever()

if __name__ == '__main__':
  main()

