$(function(){
    var localInfo = {
        video:  $("#video_local").get(0),
        stream: null,
        ws: null
    };
    var ws = new WebSocket("ws://" + location.host + "/ws");
    $(ws).bind("open", function(){
        console.log("web socket opened");
        setInterval(function(){
            console.log("sendws");
            ws.send("hogehoge" + new Date());
        }, 3000);
    });
    $(ws).bind("message", function(e){
        var data = JSON.parse(e.originalEvent.data);
        console.log(data);
        console.log("data:"+ data.msg);
    });


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

                createPeerConnection(stream);
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
    function createPeerConnection(stream){
        //connect to STUN server
        var pc;
        try {
            pc = new webkitDeprecatedPeerConnection("STUN stun.l.google.com:19302", onSignalingMessage);
        } catch (e){
            try {
                pc = new webkitPeerConnection("STUN stun.l.google.com:19302", onSignalingMessage);
                console.log("Created webkitPeerConnnection with config \"{{pc_config}}\".");
            } catch (e) {
                console.log("Failed to create webkitPeerConnection, exception: " + e.message);
                alert("Cannot create PeerConnection object; Is the 'PeerConnection' flag enabled in about:flags?");
                return;
            }
        }

        pc.addStream(stream);

        // set handlers for peerconnection events
        $(pc).bind("connecting", function(){
            console.log("onSessionConnecting...");
        });
        $(pc).bind("open", function(){
            console.log("onSessionOpened...");
        });
        $(pc).bind("addstream", function(){
            console.log("onRemoteStreamAdded...");
            var url = webkitURL.createObjectURL(event.stream);
            $("video_remote")[0].src = url;

        });
        $(pc).bind("removestream", function(){
            console.log("onRemoteStreamRemoved...");
        });
    }

    function onSignalingMessage(mesg) {
        console.log("receive signaling message");

        console.log(mesg);
        //ws.send(data);
    }


});
