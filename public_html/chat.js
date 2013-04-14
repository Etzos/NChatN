/* Copyright (c) 2013 Kevin Ott (aka Etzos) <supercodingmonkey@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var chatRoom = (function(window) {
    var sendURL = 'sendchat.php',
        receiveURL = 'lastchat.php',
        onlineURL = 'online.php';
    
    var channels = new Array(),     // Contains all of the channels
        selectedChannel,            // The currently selected and visible channel
        instance;                   // 
        
    var $input,                     // Input for chat
        $tabContainer,              // The container for chat tabs
        $onlineContainer,           // The container for online players
        $chatContainer,             // The container for chat
        $pmSelect;                  // Select for who to chat with (*, or player names)
    
    function sendChat() {
        // TODO: PreSend Hook
        
        var text = $input.val();
        if(text === '')
            return;
        
        var chan = channels[selectedChannel];
        var to = '*'; // TODO: Base this on chan.pm
        var rand = _getTime();
        
        // Process text (escape and replace +)
        text = escape(text).replace(/\+/g, '%2B');
        
        // Clear the entry
        $input.val('');
        
        $.get(
            sendURL,
            'CHANNEL='+chan.id+'&TO='+to+'&RND='+rand+'&TEXT='+text
        );
        // TODO: Check for failure. If there is a failure, store the message
        // TODO: PostSend Hook
    }
    
    function getMessage() {
        // TODO: PreReceive Hook
        // Technically, this should be called once per channel, since I'm testing right now, we're just checking the Lodge
        var chan = channels[0];
        
        $.ajax({
            url: receiveURL,
            data: 'CHANNEL=0&RND='+_getTime()+'&ID='+chan.lastId,
            type: 'GET',
            context: this, // Check to see what this actually does. You may be better off creating a special object for this
            success: function(result) {
                if(result === '')
                    return;
                
                var splitLoc = result.indexOf('\n');
                var last = parseInt(result.substring(0, splitLoc));
                chan.lastId = last;
                
                var msg = result.substring(splitLoc+1, result.length);
                   
                $chatContainer.append(msg);
                $chatContainer[0].scrollTop = $chatContainer[0].scrollHeight;
            }
        })
        .fail(function() {
            // TODO
        });
        // TODO: Check for failure, and just about every other possible result
        
        // TODO: PostReceive Hook
    }
    
        function init() {
        // Make sure there is only one
        if(instance === this)
            return;
        instance = this;
        
        channels.push({
            'id': 0,                // Server ID of the channel
            'name': 'Lounge',       // User-friendly name of the channel
            'lastId': 0,            // The ID of the last message sent
            'input': '',            // Contents of the text input (used when switching active channel)
            'players': new Array(), // List of players currently in this channel
            'pm': -1,               // The ID of the selected player to pm in this chanel
            'newMessage': false     // Whether there are new unread messages or not
        });
        selectedChannel = 0;
        $input = $('#chatInput');
        $tabContainer = $('#tabContainer');
        $onlineContainer = $('#onlineList');
        $chatContainer = $('#chat');
        $pmSelect = $('#onlineSelect');
        
        // Keybinding
        // Input Enter key pressed
        $(window).keypress(function(e) {
            var key = e.keyCode ? e.keyCode : e.which;
           if(key === 13) { // Enter key
               // Check focus
               var id = $(this).filter(':focus')[0].getAttribute('id');
               if($input[0].getAttribute('id') === id) {
                   $('#chatInputForm').submit();
               }
           }
        });
        
        // Event Handlers
        $('#chatInputForm').submit(function() {
           sendChat(); 
        });
        
        // Start Chat Timer
        var chatHeartBeat = setInterval(getMessage, 4000);
    }
    
    function _getTime() {
        return escape(new Date().toGMTString());
    }
    
    var public = {
        'init': function() {
            init();
        },
        'joinChannel': function() {
            
        },
        'leaveChannel': function() {
            
        },
        'selectChannel': function() {
            
        }
    };
    
    return public;
})(window);

// Ancillary functions
function toggleHelp() {
    $('#chatHelp').toggle();
}