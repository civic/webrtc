#!env/bin/python
#coding: utf-8

import os
import webapp2
from time import gmtime, strftime  
from webapp2_extras import jinja2
from webapp2_extras import json
import paste
import paste.cascade
import paste.urlparser

# gevent-websocketでの実装は IPv6対応にハマったので断念した
#import gevent
#import geventwebsocket
#from geventwebsocket.handler import WebSocketHandler
import random

import cogen.web.wsgi
import cogen.common 

#テンプレートエンジンを使うためのBaseClass
class BaseHandler(webapp2.RequestHandler):
  @webapp2.cached_property
  def jinja2(self):
    return jinja2.get_jinja2(app=self.app)

  def render_response(self, _tempplate, **context):
    path = os.path.join(os.path.dirname(__file__), _tempplate)

    rv = self.jinja2.render_template(path, **context)
    self.response.write(rv)

#トップページ表示
class IndexHandler(BaseHandler):
  def get(self):

    context = {"title": "IPv6 Hackathon demo"}

    #通信開始トリガになるinitiator
    context["initiator"] = "false"
    if self.request.get("i"):
      context["initiator"] = "true"

    #ユーザID。toppage表示時に自動決定
    source_str = 'abcdefghijklmnopqrstuvwxyz'
    random.choice(source_str)  
    context["uid"] = "".join([random.choice(source_str) for x in xrange(16)])

    self.render_response("template.html", **context)

class RoomManager:
  def __init__(self, room_count):
    #[0] ロビー
    #[1] room1  [uid1, uid2]  のようにuidの配列
    self.rooms = [[] for x in xrange(room_count + 1)]  #[0] is lobby

  def join(self, uid):
    self.rooms[0].append(uid)

  def leave(self, uid):
    for members in self.rooms:
      b = len(members)
      if uid in members:
        members.remove(uid)

      print str(b) + ", " + str(len(members))

  def move(self, uid, room_fr, room_to):
    rooms = self.rooms
    if room_to == 0 or len(rooms[room_to]) < 2:
      if uid in rooms[room_fr]:
        rooms[room_fr].remove(uid)
      rooms[room_to].append(uid)

  def getMembersCountList(self):
    list = []
    for members in self.rooms:
      list.append(len(members))
    return list

  def getMembers(self, room_no):
    return tuple(self.rooms[room_no])


#room情報
room_manager = RoomManager(5)
  
#Ajaxで通知取得時のmsgbox
#uidをキーに通知情報の配列を持つ
msgbox = {}

#AjaxリクエストHanlder
class AjaxHandler(webapp2.RequestHandler):
  def post(self):
    act = self.request.get("act") #action
    uid = self.request.get("uid") #ユーザid

    print act + " called by " + uid
    ret = None

    #actionに対応するメソッド実行
    action_method = getattr(self, "act_" + act)
    ret = action_method()

    #json文字列にエンコードしてレスポンス
    json_str = json.encode(ret)
    self.response.write(json_str)

  #room情報一覧取得
  def act_list(self):
    uid = self.request.get("uid")

    if self.request.get("join") == "1": #最初のアクセス
      print "join " + uid
      room_manager.join(uid)
      msgbox[uid] = []  #msgboxの生成

      room_list = room_manager.getMembersCountList()
      self.send_to(uid, None, {"type": "room_info", "room_list": room_list})

    return {"act": "list_ret", "room_list": room_manager.getMembersCountList()}

  #room,ロビーから退室して終了
  def act_leave(self):
    uid = self.request.get("uid")
    print uid

    room_manager.leave(uid)
    if uid in msgbox:
      del msgbox[uid] 

    room_list = room_manager.getMembersCountList()
    self.send_to(uid, None, {"type": "room_info", "room_list": room_list})

    return {}

  #部屋の移動
  def act_move(self):
    room_to = int(self.request.get('room_to'))
    room_fr = int(self.request.get('room_fr'))
    uid = self.request.get('uid')

    #部屋の移動
    room_manager.move(uid, room_fr, room_to)

    #list response

    #移動先のメンバー数
    dst_count = len(room_manager.getMembers(room_to))
    room_list = room_manager.getMembersCountList()
    self.send_to(uid, None, {"type": "room_info", "room_list": room_list})

    return {"act": "move_ret", "count": dst_count, "room_to": room_to, 
        "room_list": room_list}

  #SDPの送信
  def act_sdp(self):
    room_no = int(self.request.get('room_no'))
    uid = self.request.get("uid")
    memebers = room_manager.getMembers(room_no)

    #room入室者へsdpを通知
    self.send_to(uid, memebers, {"type": "sdp", "sdp": self.request.get("sdp")})

    return {}
  
  #ポーリングによる情報取得
  def act_check(self):
    uid = self.request.get("uid")

    msgs = msgbox.get(uid)  #自分のmsgbox
    if not msgs:
      msgs = [json.encode({"type": "room_info", "room_list": room_manager.getMembersCountList()})]

    msgbox[uid] = []  #一度取得したら空に
    return {"act": "check_ret", "ret": msgs}

  #別のクライアントへ情報通知
  def send_to(self, fr, targets, json_obj, include_me = False):
    #本来はwebsocketでサーバーから先の入出者へ、
    #通知するつもりだったが、push通知をやめて暫定的にpollingで取得するようにした
    #(websocket実装のipv6対応に断念したため） 
    #受信箱に通知情報を足して、ポーリングの取得に備える
    json_str = json.encode(json_obj)

    if targets == None:
      targets = msgbox.keys()

    for ts in targets:  
      if fr != ts or include_me:  #自分がtargetsに含まれている場合に対象とするか
        msgbox[ts].append(json_str)
      print msgbox[ts]


app = webapp2.WSGIApplication([
    ('/', IndexHandler),
    ('/ajax', AjaxHandler),
  ]
  ,debug=True
  ,config={'webapp2_extras.jinja2': {
        'template_path': ['.']
      }
    }
  )




#開発時にscriptとして実行した際のエントリポイント
#wsgiサーバーで動作させるときは使われない
def main():
  #開発時にfrontにnginxを置かずにsimple_serverで動作させるときに
  #static filesを返すだけのrequest_handlerを登録す
  app_static = paste.urlparser.StaticURLParser("./static")
  app_in = paste.cascade.Cascade([app_static, app]) #そして本来のappと統合

  #gevent実装は断念
  #server = gevent.pywsgi.WSGIServer(('0.0.0.0', 8080), app_in, handler_class=WebSocketHandler)
  #server.serve_forever()

  #開発時用のsimple_server
  from wsgiref.simple_server import make_server
  httpd = make_server('', 8080, app_in)
  httpd.serve_forever()

if __name__ == '__main__':
  main()

