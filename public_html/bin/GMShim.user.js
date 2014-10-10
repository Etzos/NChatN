// ==UserScript==
// @name         NChatN Shim Loader
// @namespace    http://garth.web.nowhere-else.org/web/
// @version      2.4.1
// @description  Loads NChatN (NEaB Chat Next) instead of the default NEaB chat
// @grant        GM_getResourceText
// @match        *://www.nowhere-else.org/general_chat.php
// @match        *://nowhere-else.org/general_chat.php
// @match        *://*.nowhere-else.org/general_chat.php
// @match        *://www.nowhere-else.org/general_chat.php#
// @match        *://nowhere-else.org/general_chat.php#
// @match        *://*.nowhere-else.org/general_chat.php#
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @copyright    2013-2014+, Kevin Ott
// @resource     payload https://rawgit.com/Etzos/NChatN/master/public_html/chat.html
// @run-at       document-start
// @updateURL    https://rawgit.com/Etzos/NChatN/master/public_html/bin/GMShim.user.js
// ==/UserScript==

$(document).ready(function() {
    var $if = $("iframe");
    if($if.length > 0) { // If the iframe exists stop /exit
        var $doc = $($if[0].contentWindow.document);
        if($doc.length > 0) {
            $doc.find("body").html(""); // Try to stop /pop as soon as possible
        }
        
        $if[0].contentWindow.onunload = null;
    }
    $("body").html(""); // Stop /pop for sure
    // Print a fancy message to the users about loading.
    $("body").html("<div style='width: 100%; height: 100%; background-color: #F5F5F5;'>" +
            "<div style='width: 320px; height: 80px; background-color: lightblue; border-radius: 0.8em; " +
            "border: 1px solid gray; box-shadow: 0.2em 0.2em 0.7em darkgray;  text-align: center; padding: 0.4em; " +
            "margin: auto auto; position: absolute; top: 0px; bottom: 0px; left: 0px; right: 0px'>" +
            "<span id='message'>Loading NChatN... Please wait.</span><br><br><br>" +
            "<progress style='width: 300px; height: 20px;'></progress></div></div>");
    
    try {
        var contents = GM_getResourceText("payload");
    } catch (e) {
        console.error(e);
        $("#message").html("There has been an issue attempting to load NChatN. Please send the following error " +
                "to Garth:<br><br>[" + e.fileName + "] (" + e.lineNumber + "): " + e.message);
        return;
    }
    // Because of the way element.innerHTML works, trying to outright replace html with a new head and body won't work
    // So, I regex this crap into pieces and insert it "manually"
    var firstSplit = contents.split(/<\/?head>/ig);
    var secondSplit = firstSplit[2].split(/<\/?body>/ig); // After second head tag should be body
    
    var headContent = firstSplit[1];   // After first head tag should be the head
    var bodyContent = secondSplit[1];  // After first body tag should be body
    
    // Replace the head and body with our new contents
    $("body").html(bodyContent);
    $("head").html(headContent);
});
