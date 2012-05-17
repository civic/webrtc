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
    self.response.write("Hello, webapp2!!!")
    self.response.write(json.encode({"hello": "World"}))

    context = {"message": "Hello WOrld"}
    self.render_response("template.html", **context)


app = webapp2.WSGIApplication([
  ('/', HelloWebapp2),
  ], debug=True)

def main():
  from paste import httpserver
  httpserver.serve(app, host='127.0.0.1', port='8080')

if __name__ == '__main__':
  main()


