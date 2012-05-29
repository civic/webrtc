webrtc
======

webRTC python webapp2 demo


*depending python library

    webapp2
    paste
    webob
    jinja2
    uwsgi

*chrome webRTC setting
    about:flags

    check 2 section,

        <video> elements media stream API

        enable peer connection     newer chrome(dev)
          or
        enable MediaStream         normal chrome


            
*same network peer connection.
    not to use STUN
        //var stun = "STUN stun.l.google.com:19302";
        var stun = "STUN NONE";

    use google's STUN server
        var stun = "STUN stun.l.google.com:19302";
        //var stun = "STUN NONE";

    at static/js/main.js
