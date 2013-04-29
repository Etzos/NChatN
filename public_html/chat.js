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
        numTimeouts,                // The number of times the connection has timed out
        lastConnection;             // The time it took for the last connection to go through
        
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
        
        // If the buffer is too large, trim it (current 5 at a time to reduce the number of times this needs to be done)
        if(chan.buffer.length > 55) {
            chan.buffer = chan.buffer.splice(49);
        }
        
        // Stick the input into the buffer
        chan.buffer.push(text);
        
        // Clear out anything in the saved buffer and reset the pointer
        chan.buffer[0] = '';
        chan.bufferPointer = 0;
        
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
        
        // Check connection speed only for Lodge (for now)
        if(chanId === 0) {
            var timeStart = Date.now();
        }
        
        $.ajax({
            url: URL.receive,
            data: 'CHANNEL='+chan.id+'&RND='+_getTime()+'&ID='+chan.lastId,
            type: 'GET',
            context: this,
            success: function(result) {
                if(result === '')
                    return;
                
                if(chanId === 0) {
                    // Update last connection
                    lastConnection = Date.now() - timeStart;
                    // Clear any timeouts
                    numTimeouts = 0;
                }
                
                var splitLoc = result.indexOf('\n');
                var last = parseInt(result.substring(0, splitLoc));
                if(last !== chan.lastId) {
                    
                    var msg = result.substring(splitLoc+1, result.length);
                    
                    if(chan.lastId === 0) {
                        // Clear out the script tags to make sure we don't reclose a window or something
                        var scriptRegex = /<script>[^]*?<\/script>/gi;
                        msg = msg.replace(scriptRegex, '');
                        var msgArr = msg.split('<BR>');
                        var beginSlice = 0;
                        // Less one since the last one is going to have a <br> that isn't needed anymore
                        var endSlice = msgArr.length-1; // Most recent message
                        if(endSlice > 20) {
                            beginSlice = endSlice-21;
                        }
                        msg = '';
                        for(var i = beginSlice; i < endSlice; i++) {
                            var m = msgArr[i];
                            if(m === '') {
                                continue;
                            }
                            msg += m;
                            if(i < endSlice-1) {
                                msg += '<br>';
                            } else {
                                msg += '<hr>';
                            }
                        }
                    }
                    
                    chan.lastId = last;
                    
                    if(msg !== '') {
                        _insertMessage(chan.id, msg);
                    }
                }
            }
        })
        .fail(function() {
            if(chanId === 0)
                numTimeouts++;
        })
        .always(function() {
            if(chanId === 0) {
                updateTickClock();
            }
        });
        
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
                    var prevSelect = $pmSelect.children(':selected').val();
                    _updatePlayerDropdown();
                    if(prevSelect !== '') // Only an empty string when nothing selected, so ignore
                        _selectWhisperTarget(prevSelect);
                }
                
                // For now, I'm just dumping this in as-is
                $('#online-window-'+chan.id).html(onlinePayload);
                
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
    
    function updateTickClock() {
        var lightClass = 'greenLight';
        var text = 'Delay: '+(lastConnection/1000)+' sec';
        if(numTimeouts === 1) {
            lightClass = 'yellowLight';
            text = 'Timeout: 1';
        } else if(numTimeouts > 1) {
            lightClass = 'redLight';
            text = 'Timeout: '+numTimeouts;
        } else if(lastConnection > 1000) {
            lightClass = 'yellowLight';
            text = 'High Delay ('+(lastConnection/1000)+' sec)';
        }
        
        var $light = $('#mainLight').children().first();
        $light.removeClass('greenLight yellowLight redLight')
            .addClass(lightClass)
            .hover(function(event) {
                tooltip.on(text, event.pageX+100, event.pageY+50);
            }, function() {
                tooltip.off();
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
        
        // Update tabs (if not active tab)
        var localId = _getIdFromServerId(chanServerId);
        if(localId !== selectedChannel) {
            $('#chat-tab-'+chanServerId).addClass('newMessageTab');
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
                .click(function(e) {
                    chatRoom.leaveChannel(chanServerId);
                    e.stopImmediatePropagation();
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
        var selServerId = channels[selectedChannel].id;
        // Get the position of the scroll bar, so it can be restored later
        channels[selectedChannel].atBottom = _isAtBottom( $('#chat-window-'+selServerId) );
        
        var $chatWindow = $('#chat-window-'+chanServerId);
        $chatWindow.show().siblings().hide();
        $('#online-window-'+chanServerId).show().siblings().hide();
        // Restore the position of the scroll bar
        if(channels[localId].atBottom === true) {
            $chatWindow.scrollTop( $chatWindow.prop('scrollHeight') );
        }
        
        // Update the tabs
        $('#chat-tab-'+selServerId).removeClass('selectedTab'); // This MUST come first for init()
        $('#chat-tab-'+chanServerId).addClass('selectedTab').removeClass('newMessageTab');
        
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
        chanServerId = parseInt(chanServerId, 10);
        for(var i=0; i<channels.length; i++) {
            if(channels[i].id === chanServerId)
                return i;
        }
        return -1;
    }
    
    function _selectWhisperTarget(name) {
        var $sel = null;
        
        if(name === '*') {
            $sel = $pmSelect.children('option').first();
        } else {
            $sel = $pmSelect.children('option[value='+name+']');
        }
        
        if($sel.length !== 1) {
            var $children = $pmSelect.children('option');
            if($children.length === 0) {
                return;
            }
            $sel = $children.first();
        }
        $pmSelect.children('option').prop('selected', false);
        $sel.prop('selected', true);
    }
    
    function _insertNewChannel(chanServerId, name) {
        var len = channels.push({
            'id': parseInt(chanServerId, 10),  // Server ID of the channel
            'name': name,                      // Name of the channel
            'lastId': 0,                       // The ID of the last message sent from the server
            'input': '',                       // The contents of the input bar (Used when switching tabs)
            'players': new Array(),            // The list of players currently in the channel
            'playerHash': '',                  // The last hash sent with the player list from the server
            'pm': '*',                         // The selected whisper target for this channel
            'newMessage': false,               // Whether there is a new (unread) message in this channel
            'atBottom': false,                 // Whether the chat window was scrolled to the bottom (only used when switching tabs)
            'buffer': new Array(),             // The last n messages the player has sent to this channel
            'bufferPointer': 0                 // Where in the buffer array the player has last been
        });
        channels[(len-1)].buffer.push('');     // channels.buffer[0] is used for the current input
    }
    
    function inChannel(chanServerId) {
        chanServerId = parseInt(chanServerId, 10);
        for(var i=0; i<channels.length; i++) {
            if(channels[i].id === chanServerId) {
                return true;
            }
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
        chan.pm = $pmSelect.children(':selected').val();
        
        _selectChannelElem(chanServerId);
        _updatePlayerDropdown();
        
        var newChan = channels[_getIdFromServerId(chanServerId)];
        $input.val(newChan.input).focus();
        
        _selectWhisperTarget(newChan.pm);
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
        // Start other required tools
        tooltip.init();
        smileyManager.init();
        _insertNewChannel(0, 'Lodge');
        selectedChannel = 0;
        
        $input = $('#chatInput');
        $tabContainer = $('#tabContainer');
        $onlineContainer = $('#onlineList');
        $chatContainer = $('#chat');
        $pmSelect = $('#onlineSelect');
        $channelSelect = $('#channel');
        
        // For Firefox users (or browsers that support the spellcheck attribute)
        if("spellcheck" in document.createElement('input')) {
            $input.attr('spellcheck', 'true');
        }
        
        var chan = channels[selectedChannel];
        
        _createChannelElem(chan.id, chan.name);
        _selectChannelElem(chan.id);
        
        // Keybinding
        // Input Enter key pressed
        $(window).keydown(function(e) {
            var isInputFocused = $input.is(':focus');
            if(!isInputFocused) {
                return;
            }
            
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
                    $input.val($input.val().replace(/[\w\-]+$/gi, match));
                    $input.focus();
                }
                e.preventDefault();
                e.stopPropagation();
            }
            else if(key === 38) { // Up arrow key
                var chan = channels[selectedChannel];
                
                if(chan.bufferPointer > 1) {
                    --chan.bufferPointer;
                } else if(chan.bufferPointer === 0) {
                    chan.bufferPointer = (chan.buffer.length - 1);
                    // Store current val
                    chan.buffer[0] = $input.val();
                }
                
                $input.val(chan.buffer[chan.bufferPointer]);
            } else if(key === 40) { // Down arrow key
                var chan = channels[selectedChannel];
                
                if(chan.bufferPointer === 0) { // Can only get as low as current
                    return;
                }
                
                if(chan.bufferPointer < (chan.buffer.length - 1)) {
                    ++chan.bufferPointer;
                } else if(chan.bufferPointer === (chan.buffer.length - 1)) {
                    chan.bufferPointer = 0;
                }
                
                $input.val(chan.buffer[chan.bufferPointer]);
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
        { id:'4',  name: 'Undecided', text: [':-/'] },
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
