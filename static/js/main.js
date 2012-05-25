$(function(){
    var localInfo = {
        video:  $("#video_local").get(0),
        stream: null,
        ws: null,
        peerCon: null
    };
    var ws = new WebSocket("ws://" + location.host + "/ws");
    $(ws).bind("open", function(){
        console.log("web socket opened");
    });
    $(ws).bind("message", function(e){
        var data = JSON.parse(e.originalEvent.data);
        console.log("websocket receive", data);

        if (localInfo.peerCon == null){
            createPeerConnection(localInfo.stream);
        }
        localInfo.peerCon.processSignalingMessage(data.sdp);
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
                    createPeerConnection(null);
                }
            }
            function onGUMSuccess(stream){
                localInfo.stream = stream;
                localInfo.video.src = window.webkitURL ?  window.webkitURL.createObjectURL(stream) : stream;

                createPeerConnection(stream);
            }
            function onGUMError(error){
                console.error('An error occurred: [CODE ' + error.code + ']');
                createPeerConnection(null);
                return;
            }
            $(this).text("Disconnect");
        }, function(){
            localInfo.stream.stop();
            $(localInfo.video).removeAttr("src");
            $(this).text("Connect");

        }
    );
    function createPeerConnection(stream){
        //connect to STUN server
        var pc;
        var stun = "STUN stun.l.google.com:19302";
        //var stun = "STUN NONE";

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

        if (stream != null){
            console.log("add stream");
            pc.addStream(stream);
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
            $("video_remote")[0].src = url;

        };
        $(pc).bind("removestream", function(){
            console.log("onRemoteStreamRemoved...");
        });
    }

    function onSignalingMessage(msg) {
        console.log("receive signaling message");

        localInfo.ws.send(msg);
    }


});
