
$(function(){
    var localInfo = {
        video:  $("#video_local").get(0),
        video_remote:  $("#video_remote").get(0),
        stream: null,
        initiator: false,
        ws: null,
        peerCon: null,
        channelReady: false,
        started: false,
        uid: render_param.uid,
        readySDP: null
    };
    var ws = new WebSocket("ws://" + location.host + "/ws");
    $(ws).bind("open", function(){
        console.log("web socket opened");
        localInfo.channelReady = true;

        wsSend({"act": "list"});
    });
    $(ws).bind("close", function(){
        wsSend({"act": "leave"});
    });
    $(window).unload(function(){
        wsSend({"act": "leave"});
    });
    $(ws).bind("message", function(e){
        var data = JSON.parse(e.originalEvent.data);
        console.log("websocket receive", data);
        if (data.act == "sdp"){
            var sdp = data.sdp;

            if (sdp != 'BYE') {
                if (sdp.indexOf("\"ERROR\"", 0) == -1) {
                    if (!localInfo.initiator && !localInfo.started) {
                        maybeStart();
                    }
                    if (localInfo.peerCon){
                        console.log("processSignalingMessage1");
                        localInfo.peerCon.processSignalingMessage(sdp);
                    } else {
                        console.log("sdp ready");
                        localInfo.readySDP = sdp;
                    }
                } else {
                    console.log("ERROR ***************");
                }
            } else {
                console.log('Session terminated.');
                localInfo.video_remote.src = null;
                localInfo.video_remote.style.opacity = 0;
                localInfo.initiator = false;
                localInfo.started = false;
            }
        } else if (data.act == "list"){
            console.log("list receive", data.room_list);
            var container = $("#room_container");
            container.empty();
            $.each(data.room_list, function(i, room){
                if (i > 0){
                    $('<div class="room" data-no="' + i + '"> Room' + (100 + i) + "</div>").appendTo(container);
                }
            });

        } else if (data.act == "move_ok"){
            console.log("move_ok receive");
            localInfo.room = data.room_to;
            if (data.count == 2){
                localInfo.initiator = true;
                maybeStart();
            } else {
                localInfo.initiator = false;
            }
        }
    });
    localInfo.ws = ws;


    $("#room_container").on("click", ".room", function(){
        var no = parseInt($(this).attr("data-no"));
        try {
            navigator.webkitGetUserMedia({audio:true, video:true}, onGUMSuccess, onGUMError);
            console.log("Requested access to local media with new syntax.");
        } catch (e) {
            try {
                navigator.webkitGetUserMedia("video,audio", onGUMSuccess, onGUMError);
                console.log("Requested access to local media with old syntax.");
            } catch (e) {
                alert("webkitGetUserMedia() failed. Is the MediaStream flag enabled in about:flags?");
                console.log("webkitGetUserMedia failed with exception: " + e.message);
            }
        }
        function onGUMSuccess(stream){
            localInfo.stream = stream;
            localInfo.video.src = window.webkitURL ?  window.webkitURL.createObjectURL(stream) : stream;

            wsSend({act: "move", room_fr: 0, room_to: no});
            $("#video_container").slideDown();
            $("#room_container").fadeOut();


        }
        function onGUMError(error){
            console.error('An error occurred: [CODE ' + error.code + ']');
            return;
        }
    });
    /*
    $("#connect").toggle(
        function(){
            try {
                navigator.webkitGetUserMedia({audio:true, video:true}, onGUMSuccess, onGUMError);
                console.log("Requested access to local media with new syntax.");
            } catch (e) {
                try {
                    navigator.webkitGetUserMedia("video,audio", onGUMSuccess, onGUMError);
                    console.log("Requested access to local media with old syntax.");
                } catch (e) {
                    alert("webkitGetUserMedia() failed. Is the MediaStream flag enabled in about:flags?");
                    console.log("webkitGetUserMedia failed with exception: " + e.message);
                }
            }
            function onGUMSuccess(stream){
                localInfo.stream = stream;
                localInfo.video.src = window.webkitURL ?  window.webkitURL.createObjectURL(stream) : stream;

                if (localInfo.initiator){
                    maybeStart();
                }
            }
            function onGUMError(error){
                console.error('An error occurred: [CODE ' + error.code + ']');
                return;
            }
            $(this).text("Disconnect");
        }, function(){
            localInfo.stream.stop();
            $(localInfo.video).removeAttr("src");
            $(this).text("Connect");
            if (localInfo.peerCon){
                localInfo.peerCon.close();
                localInfo.peerCon = null;
            }

        }
    );
    */
    function maybeStart() {
        if (!localInfo.started && localInfo.stream && localInfo.channelReady) {
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
        //var stun = "STUN stun.l.google.com:19302";
        var stun = "STUN NONE";

        if (localInfo.peerCon == null){
            console.log("createPeerConnection")
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
            console.log("processSignalingMessage2");
            localInfo.peerCon.processSignalingMessage(localInfo.readySDP);
        }
    }

    function onSignalingMessage(msg) {
        console.log("receive signaling message");

        wsSend({"act": "sdp", "room_no": localInfo.room, "sdp": msg});
    }

    function wsSend(obj){
        localInfo.ws.send(JSON.stringify(obj));
    }

});
