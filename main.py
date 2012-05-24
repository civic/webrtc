#!env/bin/python

import os
import webapp2
from time import gmtime, strftime  
import json
import gevent
import geventwebsocket
from geventwebsocket.handler import WebSocketHandler
from webapp2_extras import jinja2
from paste import cascade

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
        message_dic = {}  
        message_dic['msg'] = msg
        message_dic['time'] = strftime("%H:%M:%S", gmtime())  

        removes = set()
        for ts in sockets:  
          try:
            ts.send(json.JSONEncoder().encode(message_dic))   
          except geventwebsocket.WebSocketError, ex:
            removes.add(ts)

        for rmv in removes:
          if rmv in sockets:
            sockets.remove(rmv)

        print msg
    except geventwebsocket.WebSocketError, ex:
      ws.close()


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

