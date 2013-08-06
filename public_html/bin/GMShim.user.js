// ==UserScript==
// @name         NChatN Shim Loader
// @namespace    http://garth.web.nowhere-else.org/web/
// @version      1.9
// @description  Loads NChatN (NEaB Chat Next) instead of the default NEaB chat
// @match        *://www.nowhere-else.org/general_chat.php
// @match        *://nowhere-else.org/general_chat.php
// @match        *://*.nowhere-else.org/general_chat.php
// @match        *://www.nowhere-else.org/general_chat.php#
// @match        *://nowhere-else.org/general_chat.php#
// @match        *://*.nowhere-else.org/general_chat.php#
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @copyright    2013+, Kevin Ott
// @resource     payload https://rawgithub.com/Etzos/NChatN/master/public_html/chat.html
// @run-at       document-start
// @updateURL    https://rawgithub.com/Etzos/NChatN/master/public_html/util/GMShim.user.js
// ==/UserScript==

$(document).ready(function() {
    var $if = $('iframe');
    if($if.length > 0) { 								// If the iframe exists stop /exit
        var $doc = $($if[0].contentWindow.document);
        if($doc.length > 0) {
        	$doc.find('body').html('');					// Try to stop /pop as soon as possible
        }
        
        $if[0].contentWindow.onunload = null;
    }
    $('body').html(''); 								// Stop /pop for sure
    $('html').html('Loading');  						// Clear everything to start with a clean slate
    
    var contents = GM_getResourceText('payload');
    
    // Because of the way element.innerHTML works, trying to outright replace html with a new head and body won't work
    // So, I regex this crap into pieces and insert it "manually"
    var firstSplit = contents.split(/<\/?head>/ig);
    var secondSplit = firstSplit[2].split(/<\/?body>/ig); // After second head tag should be body
    
    var headContent = firstSplit[1]; // After first head tag should be the head
    var bodyContent = secondSplit[1]; // After first body tag should be body
    
    // Replace the head and body with our new contents
    $('body').html( bodyContent );
    $('head').html( headContent );
});