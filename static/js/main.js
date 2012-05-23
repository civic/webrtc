$(function(){
    var video_local = $("#video_local").get(0)
    $("#connect").toggle(
        function(){
            navigator.webkitGetUserMedia({video: true, audio: true}, onGUMSuccess, onGUMError);

            function onGUMSuccess(stream){
                video_local.src = window.webkitURL ?  window.webkitURL.createObjectURL(stream) : stream;

                createPeerConnection(stream);
            }
            function onGUMError(error){
                console.error('An error occurred: [CODE ' + error.code + ']');
                return;
            }
            $(this).text("Disconnect");
        }, function(){
            video_local.src = null;
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
        pc.onconnecting = onSessionConnecting;
        pc.onopen = onSessionOpened;
        pc.onaddstream = onRemoteStreamAdded;
        pc.onremovestream = onRemoteStreamRemoved;
    }
    function onSignalingMessage(mesg) {
      console.log("receive signaling message");

      // send SDP message to session server.
      //////////////////////////////////////

      sendMessage(mesg);
    }

    function sendMessage(data) {
      console.log("=====================================");
      console.log("C=>S");
      console.log("---");
      console.log(data);
      console.log("=====================================");

      ws.send(data);
    }

    // Handlers for peerconnection events.
    ///////////////////////////////////////
    function onSessionConnecting(e) {
      console.log("onSessionConnecting...");
    }

    function onSessionOpened(e) {
      console.log("onSessionOpened...");
    }

    function onRemoteStreamAdded(e) {
      console.log("onRemoteStreamAdded...");

      var url = webkitURL.createObjectURL(event.stream);
      $("video_remote")[0].src = url;
    }

    function onRemoteStreamRemoved(e) {
      console.log("onRemoteStreamRemoved...");
    }

});
