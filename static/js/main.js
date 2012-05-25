
$(function(){
    var localInfo = {
        video:  $("#video_local").get(0),
        video_remote:  $("#video_remote").get(0),
        stream: null,
        ws: null,
        peerCon: null,
        channelReady: false,
        started: false,
        initiator: render_param['initiator'],
        readySDP: null
    };
    var ws = new WebSocket("ws://" + location.host + "/ws");
    $(ws).bind("open", function(){
        console.log("web socket opened");
        localInfo.channelReady = true;
    });
    $(ws).bind("message", function(e){
        var data = JSON.parse(e.originalEvent.data);
        console.log("websocket receive", data);
        var sdp = data.sdp

        if (sdp != 'BYE') {
            if (sdp.indexOf("\"ERROR\"", 0) == -1) {
                if (!localInfo.initiator && !localInfo.started) {
                    maybeStart();
                }
                if (localInfo.peerCon){
                    localInfo.peerCon.processSignalingMessage(sdp);
                } else {
                    localInfo.readySDP = sdp;
                }
                console.log("processSignalingMessage");
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
    });
    localInfo.ws = ws;


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

        }
    );
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
                    console.log("Created webkitPeerConnnection with config \"{{pc_config}}\".");
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
            localInfo.peerCon.processSignalingMessage(localInfo.readySDP);
        }
    }

    function onSignalingMessage(msg) {
        console.log("receive signaling message");

        localInfo.ws.send(msg);
    }


});
