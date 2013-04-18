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
var chatRoom = (function(window, $) {
    var URL = {
      'send': 'sendchat.php',
      'receive': 'lastchat.php',
      'online': 'online.php',
      'invasion': 'check_invasions.php',
      'player': 'player_info.php'
    };
        
    var channels = new Array(),     // Contains all of the (joined) channels
        selectedChannel,            // The currently selected and visible channel
        instance;                   // 
        
    var $input,                     // Input for chat
        $tabContainer,              // The container for chat tabs
        $onlineContainer,           // The container for online players
        $chatContainer,             // The container for chat
        $pmSelect,                  // Select for who to chat with (*, or player names)
        $channelSelect;             // Select to open new channels
    
    function sendChat() {
        // TODO: PreSend Hook
        
        var text = $input.val();
        if(text === '')
            return;
        
        var chan = channels[selectedChannel];
        var to = $pmSelect.find(':selected').val();
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
    
    function getMessage(chanId) {
        // TODO: PreReceive Hook
        var chan = channels[chanId];
        
        $.ajax({
            url: URL.receive,
            data: 'CHANNEL='+chan.id+'&RND='+_getTime()+'&ID='+chan.lastId,
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
                    _insertMessage(chan.id, msg);
                }
            }
        })
        .fail(function() {
            // TODO
        });
        // TODO: Check for failure, and just about every other possible result
        
        // TODO: PostReceive Hook
    }
    
    function getOnline(chanId) {
        var chan = channels[chanId];
        
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
                        _insertMessage(chan.id, _formatSystemMsg('-- '+entered[i]+' joins --'));
                    }
                    // old - new = leave
                    var left = _arrSub(chan.players, newPlayerList);
                    for(var i=0; i<left.length; i++) {
                        _insertMessage(chan.id, _formatSystemMsg('-- '+left[i]+' departs --'));
                    }
                
                }
                
                chan.players = newPlayerList;
                
                // Update the list only if the current channel is the selected one
                if(chan.id === channels[selectedChannel].id) {
                    _updatePlayerDropdown();
                }
                
                // For now, I'm just dumping this in as-is
                $('#online-window-'+chanId).html(onlinePayload);
                
                chan.playerHash = resParts[0];
            }
        });
    }
    
    function getAllOnline() {
        for(var i=0; i<channels.length; i++) {
            getOnline(i);
        }
    }
    
    function getAllMessages() {
        for(var i=0; i<channels.length; i++) {
            getMessage(i);
        }
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
    
    function _isAtBottom($elem) {
        return ( $elem.prop('scrollHeight') - $elem.scrollTop() === $elem.outerHeight() );
    }
    
    function _insertMessage(chanServerId, message) {
        var $cc = $('#chat-window-'+chanServerId);

        if(_isAtBottom($cc)) {
            $cc.append(message);
            $cc.scrollTop( $cc.prop('scrollHeight') );
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
     * @param chanServerId The server id for the channel
     * @param chanName The name of the channel
     */
    function _createChannelElem(chanServerId, chanName) {
        // Create chat window
        if( $('#chat-window-'+chanServerId).length === 0 ) {
            $('<div></div>', {
                'id': 'chat-window-'+chanServerId,
                'class': 'chatWindow inactive'
            }).appendTo($chatContainer);
        }
        
        // Create online window
        if( $('#online-window-'+chanServerId).length === 0 ) {
            $('<div></div>', {
                'id': 'online-window-'+chanServerId,
                'class': 'onlineWindow inactive'
            }).appendTo($onlineContainer);
        }
        
        // Add tab
        if( $('#chat-tab-'+chanServerId).length === 0 ) {
            var $del = ''; 
            if(chanServerId !== 0) { // Only display the close option for channels that aren't Lodge
                var $del = $('<a href="#">X</a>')
                .click(function() {
                    chatRoom.leaveChannel(chanServerId);
                    return false;
                })
                .css({
                    'float': 'right',
                    'padding-right': '2px'
                });
            }
            
            $('<div></div>', {
                'id': 'chat-tab-'+chanServerId,
                'class': 'chatTabDiv'
            })
            .appendTo($tabContainer)
            .append(
                $('<a>'+chanName+'</a>')
                .attr('href', '#')
                .click(function() {
                    chatRoom.selectChannel(chanServerId);
                    return false;
                })
                .append($del)
            ).click(function() {
                    chatRoom.selectChannel(chanServerId);
                    return false;
            });
        }
    }
    
    function _selectChannelElem(chanServerId) {
        var localId = _getIdFromServerId(chanServerId);
        // Get the position of the scroll bar, so it can be restored later
        channels[selectedChannel].atBottom = _isAtBottom( $('#chat-window-'+selectedChannel) );
        
        var $chatWindow = $('#chat-window-'+chanServerId);
        $chatWindow.show().siblings().hide();
        $('#online-window-'+chanServerId).show().siblings().hide();
        // Restore the position of the scroll bar
        if(channels[localId].atBottom === true) {
            $chatWindow.scrollTop( $chatWindow.prop('scrollHeight') );
        }
        selectedChannel = localId;
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
    
    function _matchPlayers(fragment) {
        var players = channels[selectedChannel].players;
        var matches = new Array();
        
        fragment = fragment.toLowerCase();
        
        for(var i=0; i<players.length; i++) {
            var player = players[i];
            if(player.toLowerCase().indexOf(fragment) === 0)
                matches.push(player);
        }
        
        if(matches.length === 1)
            return matches[0];
        
        return "";
    }
    
    function _getIdFromServerId(chanServerId) {
        for(var i=0; i<channels.length; i++) {
            if(channels[i].id === chanServerId)
                return i;
        }
        return -1;
    }
    
    function _insertNewChannel(chanServerId, name) {
        channels.push({
            'id': chanServerId,       // Server ID of the channel
            'name': name,             // Name of the channel
            'lastId': 0,              // The ID of the last message sent from the server
            'input': '',              // The contents of the input bar (Used when switching tabs)
            'players': new Array(),   // The list of players currently in the channel
            'playerHash': '',         // The last hash sent with the player list from the server
            'pm': '*',                // The selected whisper target for this channel
            'newMessage': false,      // Whether there is a new (unread) message in this channel
            'atBottom': false         // Whether the chat window was scrolled to the bottom (only used when switching tabs)
        });
    }
    
    function inChannel(chanServerId) {
        for(var i=0; i<channels.length; i++) {
            if(channels[i].id === chanServerId)
                return true;
        }
        return false;
    }
    
    function joinChannel(chanServerId, name) {
        if(inChannel(chanServerId)) {
            switchChannel(chanServerId);
            return;
        }
        _insertNewChannel(chanServerId, name);
        var localId = _getIdFromServerId(chanServerId);
        _createChannelElem(chanServerId, name);
        getMessage(localId);
        getOnline(localId);
        switchChannel(chanServerId);
    }
    
    function switchChannel(chanServerId) {
        // Switch the input over
        var chan = channels[selectedChannel];
        
        chan.input = $input.val();
        chan.pm = $channelSelect.children(':selected').val();
        
        _selectChannelElem(chanServerId);
        _updatePlayerDropdown();
        
        var newChan = channels[_getIdFromServerId(chanServerId)];
        $input.val(newChan.input);
        // TODO: Change the selection
    }
    
    function removeChannel(chanServerId) {
        if(chanServerId === 0) 
            return; // No leaving Lodge!
        
        var localId = _getIdFromServerId(chanServerId);
        var chan = channels[localId];
        // If selected channel, move to Lodge
        if(selectedChannel === localId) {
            switchChannel(0);
        }
        
        // Clear it from the array
        channels.splice(localId, 1);
        // Clear the chat
        $('#chat-window-'+chanServerId).remove();
        // Clear the online
        $('#online-window-'+chanServerId).remove();
        // Clear the tag
        $('#chat-tab-'+chanServerId).remove();
    }
        
    function init() {
        // Make sure there is only one
        if(instance === this)
            return;
        instance = this;
        
        _insertNewChannel(0, 'Lodge');
        selectedChannel = 0;
        
        $input = $('#chatInput');
        $tabContainer = $('#tabContainer');
        $onlineContainer = $('#onlineList');
        $chatContainer = $('#chat');
        $pmSelect = $('#onlineSelect');
        $channelSelect = $('#channel');
        
        _createChannelElem(channels[selectedChannel].id, channels[selectedChannel].name);
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
            } else if(key === 9) { // Tab Key
                if($input.is(':focus')) {
                    // Check for content
                    var content = $input.val().split(' ');
                    var last = content[content.length-1];
                    if(last === '') {
                        return;
                    }
                    var match = _matchPlayers(last);
                    if(match !== '') {
                        // TODO: Location aware replace (i.e. If it's the first word make it name:, if not add a space)
                        //       However, base it on if another tab is pressed! :O
                        $input.val($input.val().replace(/\w+$/, match));
                        $input.focus();
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
        
        // Event Handlers
        $('#chatInputForm').submit(function() {
           sendChat(); 
        });
        $channelSelect.change(function() {
           var $chanSel = $channelSelect.children(':selected');
           var chanServerId = $chanSel.val();
           if(chanServerId === '')
               return;
           
           joinChannel(chanServerId, $chanSel.html());
           
           $channelSelect.children('option:eq(0)').prop('selected', true);
           $chanSel.prop('selected', false);
        });
        
        // Timers (Times are default from NEaB)
        // Start Chat Timer
        getAllMessages();
        getAllOnline();
        var chatHeartBeat = setInterval(getAllMessages, 4000);
        // Start Online Timer
        var onlineHeartBeat = setInterval(getAllOnline, 16000);
        
    }
    
    return {
        'init': function() {
            init();
        },
        'joinChannel': function(chanServerId, name) {
            joinChannel(chanServerId, name);
        },
        'leaveChannel': function(chanId) {
            removeChannel(chanId);
        },
        'selectChannel': function(id) {
            switchChannel(id);
        },
        'insertInputText': function(text) {
            $input.val($input.val() + text);
        }
    };
})(window, jQuery);

var smileyManager = (function(){
    var $container;
    var smilies = [
        { id:'0',  name: 'Smile', text: [':)', ':-)'] },
        { id:'1',  name: 'Sticking Tongue Out', text: [':P', ':p', ':-P', ':-p'] },
        { id:'2',  name: 'Yell', text: [':O', ':o', ':-O', ':-o'] },
        { id:'3',  name: 'Frown', text: [':(', ':-('] },
        { id:'4',  name: 'Undecided', text: [':/', ':-/'] },
        { id:'5',  name: 'Wink', text: [';)', ';-)'] },
        { id:'6',  name: 'Grin', text: [':D', ':-D'] },
        { id:'7',  name: 'Sunglasses', text: ['8)', '8-)'] },
        { id:'8',  name: 'Masked', text: ['B)', 'B-)'] },
        { id:'9',  name: 'Laughing', text: ['XD'] },
        { id:'10', name: 'Crying', text: ['T.T'] },
        { id:'11', name: 'Sweat Drop', text: ['^^\''] },
        { id:'12', name: 'Happy', text: ['^.^', '^^'] },
        { id:'13', name: 'Surprised', text: ['O.O', 'o.o'] },
        { id:'14', name: 'Scowl', text: ['8|', '8-|'] },
        { id:'15', name: 'Rock On', text: ['\\M/'] },
        { id:'16', name: 'D\'oh', text: ['>.<'] },
        { id:'17', name: 'Excited Laughing', text: ['XP'] },
        { id:'18', name: 'Shocked', text: ['o.O', 'oO'] },
        { id:'19', name: 'Tired', text: ['-.-'] },
        { id:'20', name: 'Evil Grin', text: ['(:<'] },
        { id:'21', name: 'Facepalm', text: ['f/'] },
        { id:'22', name: 'Unsure', text: [':S', ':s'] },
        { id:'23', name: 'Evil', text: ['*.*'] },
        { id:'24', name: 'Sealed Lips', text: [':X'] },
        { id:'25', name: 'Dead', text: ['X.X', 'x.x'] },
        { id:'26', name: 'Money Eyes', text: ['$.$'] },
        { id:'27', name: 'Embarrased', text: ['o@@o'] },
        { id:'28', name: 'Eye Roll', text: ['9.9'] },
        { id:'29', name: 'Angry Yell', text: ['O:<'] },
        { id:'30', name: 'Straight Face', text: ['B|'] },
        { id:'31', name: 'Puppy Eyes', text: ['B('] },
        { id:'32', name: 'Firey Eyes', text: ['B0'] },
        { id:'33', name: 'Confused', text: ['@.@'] },
        { id:'34', name: 'Evil Horns', text: ['^**^'] },
        { id:'35', name: 'Eyes Spinning', text: ['9.6'] },
        { id:'36', name: 'Pirate', text: ['/.O'] },
        { id:'37', name: 'Frustrated', text: ['d.b'] },
        { id:'38', name: 'Annoyed', text: ['>.>'] },
        { id:'39', name: 'Kitty', text: ['=^_^='] }
    ];
    
    function isSmiley(text) {
        $.each(smilies, function(index, smiley) {
            if($.inArray(text, smiley.text)) {
                return index;
            }
        });
        return false;
    }
    
    function drawTable() {
        // Get the container
        $container = $('#smileyContainer');
        // Bind to the link
        $('#smileyLink').click(function(event) {
            $(document).one('click', function() {
                $('#smileyContainer').hide();
            });
            $('#smileyContainer').toggle();
            
            event.stopPropagation();
            return false;
        });
        $.each(smilies, function(index, smiley) {
            var $entry = $('<a href="#"><img src="http://www.nowhere-else.org/smilies/'+smiley.id+'.gif" alt="'+smiley.name+'"></a>');
            $entry.click(function() {
                chatRoom.insertInputText(' '+smiley.text[0]);
                return false;
            })
            .hover(function(event) {
                tooltip.on(smiley.name, event.pageX, event.pageY);
            }, function() {
                tooltip.off(); 
            });
            $container.append($entry);
        });
    }
    
    function getId(smileyId) {
        for(var i=0; i<smilies.length; i++) {
            if(smilies[i].id === smileyId)
                return smilies[i];
        }
        console.error('Given smiley id is not valid: '+smileyId);
    }
    
    function getSmileyText(id) {
        return getId(id).text[0];
    }
    
    return {
        'init': function() {
            drawTable();
        },
        'toggleTable': function() {
            $container.toggle();
        },
        'getSmileyText': function(id) {
            return getSmileyText(id);
        }
    };
})();

var tooltip = (function() {
    var $div;
    
    function init() {
        $div = $('#tooltip');
    }
    
    function setText(text) {
        $div.html(text);
    }
    
    function setPosition(posx, posy) {
        $div.css({
            'top': (posy-25), // Move above mouse
            'left': (posx-$div.outerWidth()) // Move the tooltip to the left side
        });
    } 
    
    return {
        'init': function() {
            init();
        },
        'on': function(text, posx, posy) {
            setText(text);
            setPosition(posx, posy);
            $div.show();
        },
        'off': function() {
            $div.hide();
        }
    };
})();

// -- Ancillary functions -- //
/**
 * Toggles the visibility of the help menu
 */
function toggleHelp() {
    $('#chatHelp').toggle();
}
