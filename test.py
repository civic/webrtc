import sys, json  
from time import gmtime, strftime  
from gevent import pywsgi  
from geventwebsocket.handler import WebSocketHandler  
  
f = open("./test.html");  
content = f.read()  
f.close()  
  
tsSet = set()  
  
def frameReceived(ws):  
  tsSet.add(ws)  
  while 1:
    frame = ws.receive()
    message_dic = {}  
    message_dic['message'] = frame  
    message_dic['time'] = strftime("%H:%M:%S", gmtime())  
    for ts in tsSet:  
      ts.send(json.JSONEncoder().encode(message_dic))   
  
def handle(environ, start_response):  
    path = environ["PATH_INFO"]  
    if path == '/ws/echo':  
        ws = environ["wsgi.websocket"]  
        frameReceived(ws)  
    else:  
        start_response("200 OK", [  
                ("Content-Type", "text/html"),  
                ("Content-Length", str(len(content)))  
                ])  
        return iter([content])  
  
if __name__=="__main__":  
    server = pywsgi.WSGIServer(('127.0.0.1', 8082), handle,  
                           handler_class=WebSocketHandler)  
    server.serve_forever()  
