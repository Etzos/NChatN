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
    var URL = {
      'send': 'sendchat.php',
      'receive': 'lastchat.php',
      'online': 'online.php',
      'invasion': 'check_invasions.php'
    };
    
    var channels = new Array(),     // Contains all of the (joined) channels
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
            URL.send,
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
            url: URL.receive,
            data: 'CHANNEL=0&RND='+_getTime()+'&ID='+chan.lastId,
            type: 'GET',
            context: this, // Check to see what this actually does. You may be better off creating a special object for this
            success: function(result) {
                if(result === '')
                    return;
                
                var splitLoc = result.indexOf('\n');
                var last = parseInt(result.substring(0, splitLoc));
                if(last !== chan.lastId) {
                    chan.lastId = last;
                
                    var msg = result.substring(splitLoc+1, result.length);
                    
                    // TODO: Select the actual channel
                    _insertMessage(selectedChannel, msg);
                }
            }
        })
        .fail(function() {
            // TODO
        });
        // TODO: Check for failure, and just about every other possible result
        
        // TODO: PostReceive Hook
    }
    
    function getOnline() {
        var chan = channels[0];
        
        $.ajax({
            url: URL.online,
            data: 'CHANNEL='+chan.id+'&CMD=REFRESH&LASTCRC='+chan.playerHash+'&RND='+_getTime(),
            type: 'GET',
            context: this,
            success: function(result) {
                var resParts = result.split('---***---');
                if(resParts.length !== 3)
                    return;
                
                var newPlayerList = resParts[1].split('\n');
                // Remove extra empty element added by the extra \n
                newPlayerList.splice((newPlayerList.length-1), 1);
                var onlinePayload = resParts[2];
                
                if(chan.playerHash !== '') {
                    // Yeah this is really slow, but it take 16 seconds anyway, what's a few more
                    // new - old = enter
                    var entered = _arrSub(newPlayerList, chan.players);
                    for(var i=0; i<entered.length; i++) {
                        _insertMessage(selectedChannel, _formatSystemMsg('-- '+entered[i]+' joins --'));
                    }
                    // old - new = leave
                    var left = _arrSub(chan.players, newPlayerList);
                    for(var i=0; i<left.length; i++) {
                        _insertMessage(selectedChannel, _formatSystemMsg('-- '+left[i]+' departs --'));
                    }
                
                }
                
                chan.players = newPlayerList;
                
                // Update the list only if the current channel is the selected one
                if(chan.id === channels[selectedChannel].id) { // TODO: Update this
                    _updatePlayerDropdown();
                }
                
                // For now, I'm just dumping this in as-is
                $('#online-window-'+selectedChannel).html(onlinePayload);
                
                chan.playerHash = resParts[0];
            }
        });
    }
    
    function _formatSystemMsg(message) {
        return '<span class="systemMsg">'+message+'</span><br>';
    }
    
    function _updatePlayerDropdown() {
        var chan = channels[selectedChannel];
        
        var cont = _genOption('*', '-- To All --');
        
        for(var i=0; i<chan.players.length; i++) {
            var safeName = chan.players[i].replace(/ /g, '_');
            cont += _genOption(safeName, chan.players[i]);
        }
        
        $pmSelect.html(cont);
    }
    
    function _insertMessage(chanId, message) {
        var $cc = $('#chat-window-'+chanId);
        var cc = $cc[0];

        if(cc.scrollHeight - $cc.scrollTop() === $cc.outerHeight()) {
            $cc.append(message);
            cc.scrollTop = cc.scrollHeight;
        } else {
            $cc.append(message);
        }
    }
    
    function _genOption(id, text) {
        return '<option value="'+id+'">'+text+'</option>';
    }
    
    function _arrSub(first, second) {
        return $.grep(first, function(x) {
            return $.inArray(x, second) < 0;
        });
    }
    
    /**
     * Creates the various HTML elements for the given channel ID
     * @param chanId The ID of the channel
     * @param chanName The name of the channel
     */
    function _createChannelElem(chanId, chanName) {
        console.log('Running!');
        // Create chat window
        if( $('#chat-window-'+chanId).length === 0 ) {
            $('<div></div>', {
                'id': 'chat-window-'+chanId,
                'class': 'chatWindow inactive'
            }).appendTo($chatContainer);
        }
        
        // Create online window
        if( $('#online-window-'+chanId).length === 0 ) {
            $('<div></div>', {
                'id': 'online-window-'+chanId,
                'class': 'onlineWindow inactive'
            }).appendTo($onlineContainer);
        }
        
        // Add tab
        if( $('#chat-tab-'+chanId).length === 0 ) {
            $('<div></div>', {
                'id': 'chat-tab-'+chanId,
                'class': 'chatTabDiv'
            })
            .appendTo($tabContainer)
            .append(
                $('<a>'+chanName+'</a>')
                .attr('href', '#')
                .click(function() {
                    chatRoom.selectChannel(chanId);
                    return false;
                })
            );
        }
    }
    
    function _selectChannelElem(chanId) {
        $('#chat-window-'+selectedChannel).hide();
        $('#online-window-'+selectedChannel).hide();
        
        $('#chat-window-'+chanId).show();
        $('#online-window-'+chanId).show();
    }
    
    /**
     * Returns the current datetime as a UTC string
     * 
     * This is used as the random value in the queries (as far as I can tell)
     * @returns The escaped time
     */
    function _getTime() {
        return escape(new Date().toUTCString());
    }
    
    function init() {
        // Make sure there is only one
        if(instance === this)
            return;
        instance = this;
        
        channels.push({
            'id': 0,                // Server ID of the channel
            'name': 'Lodge',       // User-friendly name of the channel
            'lastId': 0,            // The ID of the last message sent
            'input': '',            // Contents of the text input (used when switching active channel)
            'players': new Array(), // List of players currently in this channel
            'playerHash': '',       // Last hash sent by the server for the online players
            'pm': '*',              // The name of the selected player to pm in this chanel
            'newMessage': false     // Whether there are new unread messages or not
        });
        selectedChannel = 0;
        $input = $('#chatInput');
        $tabContainer = $('#tabContainer');
        $onlineContainer = $('#onlineList');
        $chatContainer = $('#chat');
        $pmSelect = $('#onlineSelect');
        
        _createChannelElem(selectedChannel, channels[selectedChannel].name);
        _selectChannelElem(selectedChannel);
        
        // Keybinding
        // Input Enter key pressed
        $(window).keypress(function(e) {
            var key = e.keyCode ? e.keyCode : e.which;
           if(key === 13) { // Enter key
               // Check focus
               var $focus = $(this).filter(':focus');
               if($focus.length >= 1) {
                   var id = $focus.attr('id');
                   if($input.attr('id') === id) {
                       $('#chatInputForm').submit();
                   }
               }
           }
        });
        
        // Event Handlers
        $('#chatInputForm').submit(function() {
           sendChat(); 
        });
        
        // Timers (Times are default from NEaB)
        // Start Chat Timer
        getMessage();
        getOnline();
        var chatHeartBeat = setInterval(getMessage, 4000);
        // Start Online Timer
        var onlineHeartBeat = setInterval(getOnline, 16000);
        
    }
    
    var public = {
        'init': function() {
            init();
        },
        'joinChannel': function() {
            
        },
        'leaveChannel': function() {
            
        },
        'selectChannel': function(id) {
            _selectChannelElem(id);
        }
    };
    
    return public;
})(window);

// -- Ancillary functions -- //
/**
 * Toggles the visibility of the help menu
 */
function toggleHelp() {
    $('#chatHelp').toggle();
}
