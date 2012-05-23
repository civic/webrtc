#!env/bin/python

import os
import webapp2
from webapp2_extras import json
from webapp2_extras import jinja2

class BaseHandler(webapp2.RequestHandler):
  @webapp2.cached_property
  def jinja2(self):
    return jinja2.get_jinja2(app=self.app)

  def render_response(self, _tempplate, **context):
    path = os.path.join(os.path.dirname(__file__), _tempplate)
    rv = self.jinja2.render_template(path, **context)
    self.response.write(rv)

class HelloWebapp2(BaseHandler):
  def get(self):

    context = {"title": "WebRTC demo"}
    self.render_response("template.html", **context)


app = webapp2.WSGIApplication([
    ('/', HelloWebapp2),
  ]
  ,debug=True
  ,config={'webapp2_extras.jinja2': {
        'template_path': ['.']
      }
    }
  )

def main():
  #from paste import httpserver
  from paste.urlparser import StaticURLParser
  from paste.cascade import Cascade
  app_static = StaticURLParser("./static")
  app_in = Cascade([app_static, app])


  #httpserver.serve(app_in, host='127.0.0.1', port='8080')

  from wsgiref.simple_server import make_server
  httpd = make_server("", 8080, app_in)
  httpd.serve_forever()

if __name__ == '__main__':
  main()


