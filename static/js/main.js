$(function(){
    var localInfo = {
        video:  $("#video_local").get(0),
        video_remote:  $("#video_remote").get(0),
        stream: null,
        initiator: false,
        peerCon: null,
        started: false,
        uid: render_param.uid,
        readySDP: null
    };
    //最初のroom情報取得
    wsSend({"act": "list", "join": "1"}, function(data){
        updateRoomDisplay(data.room_list);
        //定期的な更新情報チェック
        setInterval(function(){
            wsSend({"act": "check"}, function(data){
                //room一覧から
                $.each(data.ret, function(i, json_str){
                    var msg = JSON.parse(json_str)
                    if (msg.type == "sdp"){
                        //通信相手先からのsdpを受信
                        receiveSDP(msg.sdp);
                    } else if (msg.type == "room_info"){
                        //room情報
                        updateRoomDisplay(msg.room_list);
                    }

                });
            });
        }, 3000);
    });
    //room情報の反映
    function updateRoomDisplay(room_list){
        console.log("list receive", room_list);
        var container = $("#room_container");
        container.empty();
        $.each(room_list, function(i, room_persons){
            if (i > 0){ //lobbyは除く
                var class_add = "";
                if (room_persons == 2){     //2名いる部屋
                    class_add = " room_full";
                }
                $('<div class="room' + class_add + '" data-no="' + i + '"> Room' + (100 + i) + 
                    "<br/>(" + room_persons + "人)</div>").appendTo(container);
            }
        });
        container.append($('<div style="clear: both">ロビー'+ room_list[0] + '人</div>'));
    }
    //sdpの通信相手からの受信
    function receiveSDP(sdp){
        if (sdp == 'BYE') {
            console.log('Session terminated.');
            localInfo.video_remote.src = null;
            localInfo.video_remote.style.opacity = 0;
            localInfo.initiator = false;
            localInfo.started = false;
        } else {
            if (sdp.indexOf("\"ERROR\"", 0) == -1) {
                if (!localInfo.initiator && !localInfo.started) {
                    //1人目は受信によって通信開始
                    maybeStart();
                }
                if (localInfo.peerCon){
                    //基本的にはpeerConが作成済みのはず
                    console.log("processSignalingMessage1");
                    //受信した相手のsdpからと自分のpeerConと接続を確立する
                    localInfo.peerCon.processSignalingMessage(sdp);
                } else {
                    //peerConが確立するまで一時保持
                    console.log("sdp ready");
                    localInfo.readySDP = sdp;
                }
            } else {
                console.log("ERROR ***************");
            }
        }
    }
    $(window).unload(function(){
        //leaveしてすべての部屋からいなくなる
        $.ajax({
            type: "POST",
            url: "/ajax",
            async: false,
            data: {"act": "leave", "uid": localInfo.uid},
            dataType: "json"
        });
    });


    //roomクリック時
    $("#room_container").on("click", ".room", function(){
        var no = parseInt($(this).attr("data-no"));
        try {
            //カメラストリーム開始
            navigator.webkitGetUserMedia({audio:true, video:true}, onGUMSuccess, onGUMError);
            console.log("Requested access to local media with new syntax.");
        } catch (e) {
            //ブラウザのバージョンによって若干I/Fが異なるのでその対応
            try {
                navigator.webkitGetUserMedia("video,audio", onGUMSuccess, onGUMError);
                console.log("Requested access to local media with old syntax.");
            } catch (e) {
                alert("webkitGetUserMedia() failed. Is the MediaStream flag enabled in about:flags?");
                console.log("webkitGetUserMedia failed with exception: " + e.message);
            }
        }
        //カメラストリーム取得成功時
        function onGUMSuccess(stream){
            localInfo.stream = stream;
            localInfo.video.src = window.webkitURL ?  window.webkitURL.createObjectURL(stream) : stream;

            //部屋への移動をサーバーに通知
            wsSend({act: "move", room_fr: 0, room_to: no}, function(data){
                console.log("move_ok receive");
                console.log(data.room_list);
                localInfo.room = data.room_to;
                if (data.count == 2){
                    //自分が二人目なら、initiatorとして相手への通知開始
                    localInfo.initiator = true;
                    maybeStart();
                } else {
                    localInfo.initiator = false;
                }
            });
            $("#video_container").slideDown();
            $("#room_container").fadeOut();

        }
        function onGUMError(error){
            console.error('An error occurred: [CODE ' + error.code + ']');
            return;
        }
    });
    //切断ボタン押下
    $("#dis").click(function(){
        localInfo.stream.stop();
        localInfo.stream = null;
        localInfo.started = false;
        $(localInfo.video).removeAttr("src");
        $(localInfo.video_remote).removeAttr("src");
        if (localInfo.peerCon){
            localInfo.peerCon.close();
            localInfo.peerCon = null;
        }
        //ロビーへ移動 0=lobby
        wsSend({act: "move", room_fr: localInfo.room, room_to: 0}, function(data){
            console.log("move_ok receive");
            console.log(data.room_list);
            localInfo.room = data.room_to;
        });
        $("#video_container").slideUp();
        $("#room_container").fadeIn();

    });
    /**
     * ビデオ通話開始
     * 入室一人目は、stream取得,peerCon取得に成功したらsdpを送信する
     * 入室二人目は、sdpの受信によって、送信元へ自分のsdpを返答する
     */
    function maybeStart() {
        if (!localInfo.started && localInfo.stream) {
            console.log("Creating PeerConnection.");
            createPeerConnection();
            console.log("Adding local stream.");
            localInfo.peerCon.addStream(localInfo.stream);
            localInfo.started = true;
        }
    }
    function createPeerConnection(){
        //connect to STUN server
        var pc;
        var stun = "STUN stun.l.google.com:19302";
        //var stun = "STUN NONE";

        if (localInfo.peerCon == null){
            console.log("createPeerConnection")
            //ブラウザ実装の違いがあるのでいろいろな方法で実装してある
            try {
                pc = new webkitDeprecatedPeerConnection(stun, onSignalingMessage);
            } catch (e){
                try {
                    pc = new webkitPeerConnection(stun, onSignalingMessage);
                    console.log("Created webkitPeerConnnection with config.");
                } catch (e) {
                    console.log("Failed to create webkitPeerConnection, exception: " + e.message);
                    alert("Cannot create PeerConnection object; Is the 'PeerConnection' flag enabled in about:flags?");
                    return;
                }
            }
            localInfo.peerCon = pc;
        } else {
            console.log("use peerConnection")
            pc = localInfo.peerCon;
        }

        // set handlers for peerconnection events
        $(pc).bind("connecting", function(){
            console.log("onSessionConnecting...");
        });
        $(pc).bind("open", function(){
            console.log("onSessionOpened...");
        });

        pc.onaddstream = function(){
            console.log("onRemoteStreamAdded...");
            var url = webkitURL.createObjectURL(event.stream);
            localInfo.video_remote.src = url;

        };
        $(pc).bind("removestream", function(){
            console.log("onRemoteStreamRemoved...");
        });

        if (localInfo.readySDP){
            //先にsdpを受信している場合は、それを使用する
            console.log("processSignalingMessage2");
            localInfo.peerCon.processSignalingMessage(localInfo.readySDP);
        }
    }

    function onSignalingMessage(msg) {
        console.log("receive signaling message");
        wsSend({"act": "sdp", "room_no": localInfo.room, "sdp": msg});
    }

    function wsSend(obj, callback){
        if (!callback){
            callback = function(res){
                console.log(res);
            };
        }
        obj = obj || {};
        obj["uid"] = localInfo.uid;
        $.ajax({
            type: "POST",
            url: "/ajax",
            data: obj,
            dataType: "json",
            success: callback,
            error: function(){
            }
        });
    }

});
