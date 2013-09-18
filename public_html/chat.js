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
// TODO: *MAJOR* breakage. Using the localId is fine, but it should be unique. Removing elements from the channel array 
//       makes things go bad. Very bad. (i.e. channel 2 elem still exists, but channel 2 has become channel 1)
var Chat = (function(window, $) {
    var URL = {
      'send': 'sendchat.php',
      'receive': 'lastchat.php',
      'online': 'online.php',
      'invasion': 'check_invasions.php',
      'player': 'player_info.php'
    };
    
    var INVASION_STATUS = {
        // I'm guessing for these, since there seems to be some duplication
        '1': {'msg': 'No Invasion', 'color': 'greenText'},          // No invasion. Not sure where this is used
        '2': {'msg': 'Invasion!', 'color': 'redText'},              // An active invasion
        '3': {'msg': 'Previous Invasion', 'color': 'greenText'},    // An invasion happened earlier in the day
        '4': {'msg': 'No Invasion', 'color': 'greenText'}           // Default state, no invasion has happened yet today
    };
    
    var localStorageSupport = 'localStorage' in window && window['localStorage'] !== null;
    var scriptRegex = /<script>[^]*?<\/script>/gi;
    var whisperRegex = /(to|from) ([\w\-]+)(?:<\/I> )?\&gt;/i;
    
    var channels = [],              // Contains all of the (joined) channels
        selectedChannel,            // The currently selected and visible channel
        numTimeouts,                // The number of times the connection has timed out
        lastConnection,             // The time it took for the last connection to go through
        playerName,                 // The player's name
        availChannels = [           // The list of available channels
            {"id": 0, "name": "Lodge"},
            {"id": 1, "name": "Newbie"},
            {"id": 6, "name": "Trade Channel"}
        ],
        initiated = false,          // True when init() has been run, false otherwise
        queuedPlugins = [];         // Stop-gap container for plugins that have to wait for init()
    
    var settings = {
        showSysMessages: true,      // Whether or not to show system messages
        chatHistoryLogin: 20,       // The number of history lines shown on entry
        maxHistoryLength: -1,       // The number of chat history lines to save (values < 1 default to all saved)
        detectChannels: true,       // Attempt to guess which channels (other than the defaults) can be joined
        disabledPlugins: [          // A list of the names of plugins to disable
            'Smiley Replace'        // This plugin is more of a test than an actual plugin, so disable it
        ]
    };
    
    var $input,                     // Input for chat
        $tabContainer,              // The container for chat tabs
        $onlineContainer,           // The container for online players
        $chatContainer,             // The container for chat
        $pmSelect,                  // Select for who to chat with (*, or player names)
        $channelSelect,             // Select to open new channels
        $menu,                      // The menu container
        $invasion;                  // Invasion message container
    
    var PluginManager = (function() {
        var index = 0;
        /* Stores plugins as such:
         * {
         *     plugin0: {
         *         id: 0
         *         name: <plugin name>
         *         description: <plugin description>
         *         author: <plugin author> | null
         *         license: <plugin license> | null
         *         active: <plugin enable status>
         *         hooks: [<reference to plugin hooks>]
         *     },
         *     plugin1: {
         *         . . .
         *     }
         * }
         */
        var pluginList = { };
        
        var newHooks = {
            // Internal
            pluginLoad: [],         // Plugin register and loaded
            pluginUnload: [],       // Plugin unregistered
            // Online List
            playerJoin: [],         // Player joins
            playerDepart: [],       // Player departs
            // Chat
            'send': [],               // Player sends message
            receive: [],            // Player receives a message
            // UI / Mechanics
            tabChange: [],          // Chat tab is changed
            joinChat: [],           // Player joins another channel
            leaveChat: []           // Player closes a chat
        };
        
        // Context exposed by the this variable (contains utilities and such)
        var thisCtx = {
            removeTags: function(str) {
                return str.replace(/(<([^>]+)>)/ig, "");
            },
            removeTime: function(str) {
                return str.replace(/^<B>.*?<\/B>/ig, "");
            },
            isJoinMessage: function(str) {
                return str.test(/color="\#AA0070"/ig);
            },
            isPlayerAction: function(str) {
                // Stub
                return false;
            },
            isSystemMessage: function(str) {
                // Stub
                return false;
            },
            isFromPlayer: function(str) {
                // Stub
                return false;
            },
            isWhisper: function(str) {
                // Stub
                return false;
            },
            isWhisperFrom: function(str, player) {
                // Stub
                return false;
            },
            whisperFrom: function(str) {
                // Stub
                return "";
            },
            whisperTo: function(str) {
                // Stub
                return "";
            },
            // Action context
            sendMessage: function(message) {
                sendChat(message);
            }
        };
        
        // The actual event context
        var eventCtx = {
            'stopEvent': false,     // Stops the event (can be overridden by a plugin called later)
            'stopEventNow': false   // Stops the event immediately (prevents other plugins from running)
        };
        
        // TODO: Expose more of the 'global' chat context for each event, like online players and such
        
        function createContext(original, toMerge) {
            var obj = {};
            
            // Add the original in
            for(var prop in original) {
                obj[prop] = original[prop];
            }
            
            // Add the merge in (be careful not to overwrite)
            for(var prop in toMerge) {
                if(obj.hasOwnProperty(prop)) {
                    console.error("Improper hook register! Trying to add preexisting property: "+prop);
                    continue;
                }
                obj[prop] = toMerge[prop];
            }
            
            return obj;
        }
        
        function runHook(hookName, additionalContext, ignoreStop) {
            if(typeof ignoreStop === 'undefined') {
                ignoreStop = false;
            }
            if(!newHooks.hasOwnProperty(hookName)) {
                console.error("Trying to run non-existant hook "+hookName);
                return {};
            }
            
            var selectedHook = newHooks[hookName];
            var eventContext = createContext(eventCtx, additionalContext);
            
            for(var i = 0; i < selectedHook.length; i++) {
                var runningHook = selectedHook[i];
                // Don't run deactived plugins
                if(!runningHook.active) {
                    continue;
                }
                runningHook.fn.apply(thisCtx, [eventContext]);
                
                if(eventContext.stopEventNow === true) {
                    eventContext.stopEvent = true;
                    break;
                }
            }
            
            return eventContext;
        }
        
        function getPluginIdByName(name) {
            for(var prop in pluginList) {
                var plugin = pluginList[prop];
                if(plugin.name === name)
                    return prop;
            }
            return "";
        }
        
        function pluginTag(plugin) {
            return "[Plugin: '"+plugin.name+"'] ";
        }
        
        function checkPluginValidity(plugin) {
            if(!plugin.hasOwnProperty('name')) {
                console.error("Plugin does not have a name property. Unable to register.");
                return false;
            } else if(!plugin.hasOwnProperty('hooks')) {
                console.error(pluginTag(plugin)+"Plugin must register some hooks in order to work properly.");
                return false;
            }
            
            for(var prop in plugin.hooks) {
                if(!newHooks.hasOwnProperty(prop)) {
                    console.error(pluginTag(plugin)+"Unknown hook '"+prop+"'. Plugin may not function properly.");
                    continue;
                }
                if(typeof plugin.hooks[prop] !== 'function') {
                    console.error(pluginTag(plugin)+"Hook '"+prop+"' is not a function. Plugin may not function properly.");
                    continue;
                }
            }
            
            if(!plugin.hasOwnProperty('description')) {
                console.warn("Plugin should have a description property to describe its purpose.");
            }
            return true;
        }
        
        function registerPlugin(plugin) {
            // Check to make sure the plugin has all required properties
            if(!checkPluginValidity(plugin)) {
                return false;
            }
            
            var pluginId = index;
            index++;
            
            // Avoid running disabled plugins from the start
            var defaultActive = true;
            if(settings.disabledPlugins.indexOf(plugin.name) > -1) {
                defaultActive = false;
            }
            
            var registeredHooks = [];
            for(var prop in plugin.hooks) {
                var hookObj = {'plugin': "plugin"+pluginId, 'fn': plugin.hooks[prop], 'active': defaultActive};
                newHooks[prop].push(hookObj);
                registeredHooks.push(hookObj);
            }
            
            pluginList["plugin"+pluginId] = {
                id: pluginId,
                name: plugin.name,
                description: plugin.description,
                license: (plugin.license) ? plugin.license : null,
                author: (plugin.author) ? plugin.author : null,
                active: defaultActive,
                hooks: registeredHooks
            };
            return true;
        }
        
        /**
         * Activates or deactivates the given plugin
         * 
         * @param {string} pluginName The name of the plugin to enable or disable
         * @param {bool} active [Optional] Whether to enable (true) or disable (false) the plugin (Default: toggle
         * current state)
         * @returns {Boolean} Returns true if the plugin has been enabled or disabled, returns false if the plugin is
         * already enabled/disabled and told to enable or disable respectively
         */
        function changePluginStatus(pluginName, active) {
            var pluginTag = getPluginIdByName(pluginName);
            if(pluginTag === '') {
                console.warn("Unable to find plugin '"+pluginName+"'");
                return false;
            }
            var plugin = pluginList[pluginTag];

            if(typeof active === 'undefined') {
                active = !plugin.active;
            } else {
                if(plugin.active === active) {
                    return false;
                }
            }
            
            $.each(plugin.hooks, function(key, value) {
               value.active = active;
            });
            plugin.active = active;
            return true;
        }
        
        function unregisterPlugin(pluginName) {
            var plugin = getPluginIdByName(pluginName);
            if(plugin === '') {
                return false;
            }
            
            // TODO: Call plugin unload hook
            
            // Remove hooks
            $.each(newHooks, function(key) {
                delete newHooks[key][plugin];
            });
            
            // Remove plugin
            delete pluginList[plugin];
            
            return true;
        }
        
        function listPlugins() {
            
        }
        
        return {
            registerPlugin: function(plugin) {
                return registerPlugin(plugin);
            },
            unregisterPlugin: function(pluginName) {
                return unregisterPlugin(pluginName);
            },
            runHook: function(hookName, additionalContext) {
                return runHook(hookName, additionalContext, false);
            },
            deactivatePlugin: function(pluginName) {
                return changePluginStatus(pluginName, false);
            },
            activatePlugin: function(pluginName) {
                return changePluginStatus(pluginName, true);
            },
            forEachPlugin: function(callback) {
                $.each(pluginList, function(key, value) {
                    callback(value);
                });
            }
        };
    })();
    
    function sendChat(msg) {
        var text = $input.val();
        
        if(typeof msg !== 'undefined') {
            text = msg;
        }
        
        if(text === '')
            return;
        
        var chan = channels[selectedChannel];
        
        // PreSend Hook
        var ctx = {
            'channel': chan,
            'text': text,
            'clearInput': true
        };
        var hook = PluginManager.runHook('send', ctx);
        
        // This should be done *first* because even a stopped event should be able to control the input value
        if(hook.clearInput) {
            $input.val('');
        }
        
        if(hook.stopEvent) {
            return;
        }
        // End PreSend Hook
        
        // If the buffer is too large, trim it (current 5 at a time to reduce the number of times this needs to be done)
        if(chan.buffer.length > 55) {
            chan.buffer = chan.buffer.splice(49);
        }
        
        // Stick the input into the buffer
        chan.buffer.push(text);
        
        // Clear out anything in the saved buffer and reset the pointer
        chan.buffer[0] = '';
        chan.bufferPointer = 0;
        
        // All whisper channels are directed to Lodge (to make it viewer-friendly for non NChatN users)
        var targetChannel = chan.isServer ? chan.id : 0;
        // Whisper target for whisper channels should come from the chan.pm (since it's permanent)
        var to = chan.isServer ? $pmSelect.find(':selected').val() : chan.pm;
        console.log(chan.isServer + " and target: "+to);
        var rand = _getTime();
        
        // Process text (escape and replace +)
        text = escape(text).replace(/\+/g, '%2B');
        
        $.get(
            URL.send,
            'CHANNEL='+targetChannel+'&TO='+to+'&RND='+rand+'&TEXT='+text
        );
        // TODO: Check for failure. If there is a failure, store the message
        // TODO: PostSend Hook
    }
    
    function getMessage(chanId) {
        var chan = channels[chanId];
        
        // Skip non-server channels
        if(!chan.isServer) {
            return;
        }
        
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
                    var msgArr = result.substring(splitLoc+1, result.length).split('<BR>');
                    
                    var isInit = (chan.lastId === 0);
                    // Init has an extra <BR> tag that should be avoided
                    var end = (isInit) ? msgArr.length-1 : msgArr.length;
                    // Only reset the begining if it's needed (init and the sent messages are too long)
                    var begin = (isInit && end > (settings.chatHistoryLogin-1)) ? end-settings.chatHistoryLogin : 0;
                    
                    var whisperTarget = null;
                    // Insert each message in order
                    for(var i = begin; i < end; i++) {
                        var msg = msgArr[i];
                        if(msg === '') {
                            continue;
                        }
                        
                        var isScript = scriptRegex.test(msg);
                        whisperTarget = whisperRegex.exec(msg);
                        
                        msg += '<br>';

                        if(isInit) {
                            // Ignore old scripts
                            if(isScript) {
                                continue;
                            }
                            if(i === (end-1)) {
                                // Expensive operation, thankfully only done once
                                msg = msg.slice(0, msg.length-4) + "<hr>";
                            }
                        }
                        
                        // No one is allowed to circumvent scripts running
                        if(!isScript) {
                            var hook = PluginManager.runHook('receive', {
                                'isInit': isInit,
                                'message': msg,
                                'channel': chan
                            });

                            if(hook.stopEvent) {
                                continue;
                            }
                            
                            if(whisperTarget) {
                                _insertWhisper(whisperTarget[2], hook.message);
                            } else {
                                _insertMessage(chanId, hook.message);
                            }
                        } else {
                            _insertMessage(chanId, msg);
                        }
                    }
                    
                    chan.lastId = last;
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
    }
    
    function getOnline(chanId) {
        var chan = channels[chanId];
        // Skip non-server channels
        if(!chan.isServer) {
            return;
        }
        
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
                        _insertMessage(chanId, _formatSystemMsg('-- '+entered[i]+' joins --'), true);
                    }
                    // old - new = leave
                    var left = _arrSub(chan.players, newPlayerList);
                    for(var i=0; i<left.length; i++) {
                        _insertMessage(chanId, _formatSystemMsg('-- '+left[i]+' departs --'), true);
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
                $('#online-window-'+chanId).html(onlinePayload);
                
                chan.playerHash = resParts[0];
            }
        });
    }
    
    /**
     * Gets the invasion status from the server
     * 
     * @returns {undefined}
     */
    function getInvasionStatus() {
        $.ajax({
            url: URL.invasion,
            data: 'RND='+_getTime(),
            type: 'GET',
            context: this,
            success: function(result) {
                var imageId = result.charAt(0);
                var message = result.substring(1);
                _updateInvasionMessage(imageId, message);
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
    
    /**
     * Updates the connection status light
     * 
     * @returns {undefined}
     */
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
                Tooltip.on(text, event.pageX+100, event.pageY+50);
            }, function() {
                Tooltip.off();
            });
    }
    
    /**
     * Updates the invasion status portion of chat
     * 
     * @param {string} status The numerical status message (treated as a string)
     * @param {string} message The invasion message to be shown on hovering over the status
     * @returns {undefined}
     */
    function _updateInvasionMessage(status, message) {
        if(!INVASION_STATUS.hasOwnProperty(status)) {
            console.error("Unknown invasion status: '"+status+"'");
            return;
        }
        var invStatus = INVASION_STATUS[status];
        // Create the new elements
        var $span = $('<span></span>')
            .addClass(invStatus.color)
            .html(invStatus.msg)
            .hover(function(event) {
                Tooltip.on(message, event.pageX+100, event.pageY+40);
            }, function() {
                Tooltip.off();
            });

        // Clear old invasion
        $invasion.html($span);
    }
    
    /**
     * Wraps a given string is the tags required to mark it as a system message
     * 
     * @param {string} message The message to wrap
     * @returns {String} A string wrapped in the appropiate tags to mark it as a system message
     */
    function _formatSystemMsg(message) {
        return '<span class="systemMsg">'+message+'<br></span>';
    }
    
    /**
     * Regenerates the online player dropdown (used for selecting whisper target)
     * 
     * @returns {undefined}
     */
    function _updatePlayerDropdown() {
        var chan = channels[selectedChannel];
        
        var cont = _genOption('*', '-- To All --');
        
        for(var i=0; i<chan.players.length; i++) {
            var safeName = chan.players[i].replace(/ /g, '_');
            cont += _genOption(safeName, chan.players[i]);
        }
        
        $pmSelect.html(cont);
    }
    
    /**
     * Returns wheter the given element is scrolled all the way down or not
     * 
     * @param {jquery} $elem The jQuery wrapped element
     * @returns {Boolean} True if the given element is scrolled all the way down, false otherwise
     */
    function _isAtBottom($elem) {
        return ( $elem.prop('scrollHeight') - $elem.scrollTop() === $elem.outerHeight() );
    }
    
    /**
     * Appends a message to the defined channel
     * 
     * @param {int} chanId The local ID of the channel to append a message
     * @param {string} message The message to be appended
     * @param {bool} isSys [Optional] If true, the message will be treated as a message from the chat client (Default: false) 
     * @returns {undefined}
     */
    function _insertMessage(chanId, message, isSys) {
        if(typeof isSys === 'undefined') {
            isSys = false;
        }
        var $cc = $('#chat-window-'+chanId);

        var isSelected = (chanId === selectedChannel);
        var isBottom = (isSelected)? _isAtBottom($cc) : channels[chanId].atBottom;
        
        $cc.append(message);
        
        if(isSys && !settings.showSysMessages) {
            $('.systemMsg').hide();
        }
        
        if(isBottom) {
            $cc.scrollTop( $cc.prop('scrollHeight') );
        }
        
        // Check scroll
        doScrollCheck(chanId);
        // Update tabs (if not active tab)
        if(!isSelected && (!isSys || (isSys && settings.showSysMessages))) {
            $('#chat-tab-'+chanId).addClass('newMessageTab');
        }
    }
    
    /**
     * Generates the HTML for an option tag
     * 
     * @param {int} id The content of the value attribute
     * @param {string} text The value between the option tags i.e. what is shown to the user
     * @returns {String} The resulting option element
     */
    function _genOption(id, text) {
        return '<option value="'+id+'">'+text+'</option>';
    }
    
    function _arrSub(first, second) {
        return $.grep(first, function(x) {
            return $.inArray(x, second) < 0;
        });
    }
    
    /**
     * Checks to see if the given chat is at the bottom or not and handles all modifiers
     * @param {int} localId The local id for the channel
     */
    function doScrollCheck(localId) {
        var $cWin = $('#chat-window-'+localId);
        // Don't poll to see if the element is at the bottom if it's not the active tab (it will return bogus info)
        var atBottom = (localId === selectedChannel)? _isAtBottom( $cWin ) : channels[localId].atBottom;
        channels[localId].atBottom = atBottom;
        
        if(atBottom) {
            $cWin.removeClass('historyShade');
        } else {
            $cWin.addClass('historyShade');
        }
    }
        
    /**
     * Creates the various HTML elements for the given channel ID
     * @param {int} chanId The internal ID of the channel
     * @param {string} chanName The name of the channel
     */
    function _createChannelElem(chanId, chanName) {
        // Create chat window
        if( $('#chat-window-'+chanId).length === 0 ) {
            $('<div></div>', {
                'id': 'chat-window-'+chanId,
                'class': 'chatWindow inactive'
            }).scroll(function() {
                // Check to see if it's at the bottom
                doScrollCheck(chanId);
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
            var $del = ''; 
            if(chanId !== 0) { // Only display the close option for channels that aren't Lodge
                $del = $('<a href="#">X</a>')
                .click(function(e) {
                    removeChannel(chanId);
                    e.stopImmediatePropagation();
                    return false;
                })
                .css({
                    'float': 'right',
                    'padding-right': '2px'
                });
            }
            
            $('<div></div>', {
                'id': 'chat-tab-'+chanId,
                'class': 'chatTabDiv'
            })
            .appendTo($tabContainer)
            .append(
                $('<a>'+chanName+'</a>')
                .attr('href', '#')
                .click(function() {
                    switchChannel(chanId);
                    return false;
                })
                .append($del)
            ).click(function() {
                    switchChannel(chanId);
                    return false;
            });
        }
    }
    
    /**
     * Makes an existing channel (i.e. one already open) the active one
     * 
     * @param {int} chanId The internal ID of the channel to make active
     */
    function _makeChannelActive(chanId) {
        // Get the position of the scroll bar, so it can be restored later
        channels[selectedChannel].atBottom = _isAtBottom( $('#chat-window-'+selectedChannel) );
        
        var $chatWindow = $('#chat-window-'+chanId);
        $chatWindow.show().siblings().hide();
        $('#online-window-'+chanId).show().siblings().hide();
        // Restore the position of the scroll bar
        if(channels[chanId].atBottom === true) {
            $chatWindow.scrollTop( $chatWindow.prop('scrollHeight') );
        }
        
        // Update the tabs
        $('#chat-tab-'+selectedChannel).removeClass('selectedTab'); // This MUST come first for init()
        $('#chat-tab-'+chanId).addClass('selectedTab').removeClass('newMessageTab');
        
        selectedChannel = chanId;
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
    
    function _getIdFromWhisperTarget(whisperTarget) {
        for(var i = 0; i < channels.length; i++) {
            if(channels[i].pm === whisperTarget) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * Safely inserts a whisper (makes sure the channel exists first)
     * @param {string} whisperTarget
     * @param {string} message
     */
    function _insertWhisper(whisperTarget, message) {
        var localId = _getIdFromWhisperTarget(whisperTarget);
        if(localId < 0) {
            localId = _createWhisperChannel(whisperTarget);
        }
        
        _insertMessage(localId, message, false);
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
            'id': parseInt(chanServerId, 10),  // Server ID of the channel (For non-server channels this should be -1)
            'name': name,                      // Name of the channel
            'lastId': 0,                       // The ID of the last message sent from the server
            'input': '',                       // The contents of the input bar (Used when switching tabs)
            'players': new Array(),            // The list of players currently in the channel
            'playerHash': '',                  // The last hash sent with the player list from the server
            'isServer': true,                  // Whether the channel is a server channel or a custom one (used for whisper)
            'pm': '*',                         // The selected whisper target for this channel
            'newMessage': false,               // Whether there is a new (unread) message in this channel
            'atBottom': false,                 // Whether the chat window was scrolled to the bottom (only used when switching tabs)
            'buffer': new Array(),             // The last n messages the player has sent to this channel
            'bufferPointer': 0                 // Where in the buffer array the player has last been
        });
        channels[(len-1)].buffer.push('');     // channels.buffer[0] is used for the current input
        return len-1;
    }
    
    function _addMenuItem(text, stopHide) {
        if(typeof stopHide === 'undefined') {
            stopHide = false;
        }
        var $container = $('<li></li>');
        var $link = $('<a></a>');
        $link.attr('href', '#')
            .html(text)
            .appendTo($container);
        $container.appendTo($menu);
        if(!stopHide) {
            $link.click(function() {
               $menu.hide();
               return false;
            });
        }
        
        return $link;
    }
    
    function _loadSettings() {
        if(!localStorageSupport) {
            return;
        }
        
        var savedSettings = localStorage.getItem("NChatN-settings");
        
        try {
            savedSettings = JSON.parse(savedSettings);

            for(var prop in savedSettings) {
                settings[prop] = savedSettings[prop];
            }
        } catch(e) {
            // Faulty data. Not really a problem
        }
    }
    
    function _saveSettings() {
        if(!localStorageSupport) {
            return;
        }
        
        localStorage.setItem("NChatN-settings", JSON.stringify(settings));
    }
    
    function changeSetting(setting, newValue) {
        if(!settings.hasOwnProperty(setting)) {
            return;
        }
        if(settings[setting] === newValue) {
            return;
        }
        
        settings[setting] = newValue;
        _saveSettings();
    }
    
    /**
     * Checks if a given server channel ID is in the list of active channels
     * @param {type} chanServerId
     * @returns {Boolean}
     */
    function inChannel(chanServerId) {
        chanServerId = parseInt(chanServerId, 10);
        if(chanServerId < 0) {
            return false;
        }
        for(var i=0; i<channels.length; i++) {
            if(channels[i].id === chanServerId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Attempts to join a channel, if it already is joined then switches to that channel
     * @param {int} chanId The local channel ID to attempt to switch to
     * @param {name} name The name to use for the channel if it needs to be joined
     */
    function joinChannel(chanId, name) {
        console.log("This shouldn't be called, but it is.");
        // TODO: This can't do what it's supposed to without a server ID!
        // Check if it could be a local ID
        if(chanId > -1 && chanId < channels.length-1) {
            switchChannel(chanId);
            return;
        }
        // selfJoin Hook
        var ctx = {
            channelId: chanId,
            channel: name,
            firstJoin: false
        };
        var res = PluginManager.runHook('joinChat', ctx);
        if(res.stopEvent) {
            return;
        }
        // End selfJoin Hook
        _insertNewChannel(chanServerId, name);
        var localId = _getIdFromServerId(chanServerId);
        _createChannelElem(chanServerId, name);
        getMessage(localId);
        getOnline(localId);
        switchChannel(chanServerId);
    }
    
    /**
     * Creates a "channel stub": A blank channel, and returns the internal ID
     * @param {string} name The name to give the new channel
     * @returns {int} The local ID of the newly created channel
     */
    function createBlankChannel(name) {
        var localId = _insertNewChannel(-1, name);
        channels[localId].isServer = false;
        _createChannelElem(localId, name);
        switchChannel(localId);
        return localId;
    }
    
    function _createWhisperChannel(whisperTarget) {
        var localId = createBlankChannel("W: "+whisperTarget);
        var chan = channels[localId];
        // TODO: Insert player and whisperTarget
        //chan.players = []
        chan.pm = whisperTarget;
        
        return localId;
    }
    
    /**
     * Join a channel using the server channel ID
     * 
     * This method is a convience method to provide a quick way to join a channel without having to manually translate
     * a server ID into a local ID.
     * @param {int} chanServerId The server ID of the channel to join
     * @param {string} name The name to give the channel if it needs to be created
     */
    function joinServerChannel(chanServerId, name) {     
        if(inChannel(chanServerId)) {
            var chanId = _getIdFromServerId(chanServerId);
            switchChannel(chanId);
            return;
        }
        
        // selfJoin Hook
        var ctx = {
            channelId: chanServerId,
            channel: name,
            firstJoin: false
        };
        var res = PluginManager.runHook('joinChat', ctx);
        if(res.stopEvent) {
            return;
        }
        // End selfJoin Hook
        _insertNewChannel(chanServerId, name);
        var localId = _getIdFromServerId(chanServerId);
        _createChannelElem(localId, name);
        getMessage(localId);
        getOnline(localId);
        switchChannel(localId);
    }
    
    /**
     * Switches the active channel to the one provided
     * @param {int} chanId The internal ID of the channel to switch to
     */
    function switchChannel(chanId) {
        // Switch the input over
        var chan = channels[selectedChannel];
        
        // changeTab Hook
        var ctx = {
            'channel': chanId,
            'previousChannel': selectedChannel
        };
        var hook = PluginManager.runHook('tabChange', ctx);
        
        if(hook.stopEvent) {
            return;
        }
        // End changeTab Hook
        
        chan.input = $input.val();
        if(chan.isServer) {
            chan.pm = $pmSelect.children(':selected').val();
        }
        
        _makeChannelActive(chanId);
        _updatePlayerDropdown();
        
        var newChan = channels[chanId];
        $input.val(newChan.input).focus();
        
        if(newChan.isServer) {
            _selectWhisperTarget(newChan.pm);
        }
    }
    
    /**
     * Removes a channel from the tab list (as well as all of its elements)
     * @param {int} chanId The internal ID of the channel
     */
    function removeChannel(chanId) {
        if(chanId === 0) {
            return; // No leaving Lodge!
        }
        
        //var chan = channels[chanId];
        // If selected channel, move to Lodge
        if(selectedChannel === chanId) {
            switchChannel(0);
        }
        
        // Clear it from the array
        channels.splice(chanId, 1);
        // Clear the chat
        $('#chat-window-'+chanId).remove();
        // Clear the online
        $('#online-window-'+chanId).remove();
        // Clear the tag
        $('#chat-tab-'+chanId).remove();
    }
    
    function toggleSysMsgVisibility() {
        if(settings.showSysMessages) {
            $('.systemMsg').hide();
        } else {
            $('.systemMsg').show();
        }
        changeSetting('showSysMessages', !settings.showSysMessages);
    }
    
    function changeLoginHistory() {
        var result = window.prompt('How many lines of chat history should show on entry?\n(Enter a number less than 0 to reset to default)', settings.chatHistoryLogin);
        // If empty, assume they want to leave it the same
        if(!result || result === "") {
            return;
        }
        
        if(result < 0) {
            result = 20;
        }
        
        changeSetting("chatHistoryLogin", result);
    }
    
    function renderChannelList() {
        $channelSelect.empty();
        $channelSelect.append("<option value=''>-- Channels --</option>\n");
        for(var i = 0; i < availChannels.length; i++) {
            var c = availChannels[i];
            $channelSelect.append("<option value='"+c.id+"'>"+c.name+"</option>\n");
        }
    }
    
    function addMenu(menu) {
        $menu.removeClass("headerMenu");
        $menu.append(menu.getRoot());
        $('#menuLink').click(function() {
            $(document).one('click', function() {
                menu.closeMenu();
            });
            
            menu.toggle();
            this.blur();
            return false;
        });
    }
    
    /**
     * Queues a plugin for registration if init() hasn't been called
     * TODO: Load settings before init() is called so that there's no need for this (since plugin registration relies on settings.disabledPlugins)
     * 
     * @param {JSON} plugin The plugin to queue to be added
     * @returns {bool} Result of PluginManager.registerPlugin() or true if init() not called yet
     */
    function queuePlugin(plugin) {
        if(initiated === true) {
            return PluginManager.registerPlugin(plugin);
        } else {
            queuedPlugins.push(plugin);
            return true;
        }
    }
    
    function init() {
        // Don't start twice
        if(initiated === true) {
            return;
        }
        initiated = true;
        // Start other required tools
        Tooltip.init();
        Smilies.init();
        _insertNewChannel(0, 'Lodge');
        selectedChannel = 0;
        
        $input = $('#chatInput');
        $tabContainer = $('#tabContainer');
        $onlineContainer = $('#onlineList');
        $chatContainer = $('#chat');
        $pmSelect = $('#onlineSelect');
        $channelSelect = $('#channel');
        $menu = $('#mainMenu');
        $invasion = $('#invasionStatus');
        
        // For Firefox users (or browsers that support the spellcheck attribute)
        if("spellcheck" in document.createElement('input')) {
            $input.attr('spellcheck', 'true');
        }
        
        var chan = channels[selectedChannel];
        
        _createChannelElem(selectedChannel, chan.name);
        _makeChannelActive(selectedChannel);
        
        // Load settings
        _loadSettings();
        
        // Get value from cookie
        playerName = Util.Cookies.neabGet("RPG", 1);
        
        // Load queued plugins
        for(var i = 0; i < queuedPlugins.length; i++) {
            PluginManager.registerPlugin(queuedPlugins[i]);
        }
        
        var $container = $("<span></span>");
        PluginManager.forEachPlugin(function(plugin) {
            var $inpt = $('<input type="checkbox" '+((plugin.active) ? "checked=checked" : "")+'>');
            $inpt.change(function() {
                var checked = $(this).prop('checked');
                if(!checked) {
                    settings.disabledPlugins.push(plugin.name);
                    _saveSettings();
                    PluginManager.deactivatePlugin(plugin.name);
                } else {
                    settings.disabledPlugins.splice(settings.disabledPlugins.indexOf(plugin.name), 1);
                    _saveSettings();
                    PluginManager.activatePlugin(plugin.name);
                }
            });
            $container.append($inpt);
            $container.append("<b>"+plugin.name+"</b> <i>"+plugin.author+"</i> ("+plugin.license+")<br>"+
                    "&nbsp;&nbsp;&nbsp;"+plugin.description+" "+
                    "<br><br>");
        });
        
        // Create the user script dialog
        var userDialog = new Dialog({
            title: "User scripts",
            //content: "Hopefully a checkbox list will go here eventually or something"
            content: $container
        });
        
        var aboutDialog = new Dialog({
            title: "About NChatNext",
            content: 'NEaB Chat Next (NChatN) Copyright 2013 Kevin Ott<br>'+
                     'NChatN is licensed under the GNU Public License version 3.<br>'+
                     'A copy of the license is available at &lt;<a href="http://www.gnu.org/licenses/" target="_blank">http://www.gnu.org/licenses/</a>&gt;.'
        });
        // Fill in the Menu
        $menu.html('');
        

        var mainMenu = new MenuList({
            select: {
                text: "Download Chat",
                description: "Download the current chat history to a file",
                action: function() {
                    var chan = channels[selectedChannel];
                    
                    // TODO: Fix smilies and bad styles
                    // This download method only works on recent version of Firefox and Chrome
                    var raw = $('#chat-window-'+selectedChannel).html();
                    raw = Smilies.replaceTagsWithText(raw);
                    var blob = new Blob([raw], {type: 'application/octet-stream'});
                    var src = window.URL.createObjectURL(blob);
                    this.href = src;
                    
                    var time = new Date();
                    // Format: 2013-06-23
                    var timeStr = time.getFullYear() + "-" + numPad(time.getMonth()+1) + "-" + numPad(time.getDate());
                    this.download = "NEaB Chat - "+chan.name+" ["+timeStr+"].html";
                    
                    // Note: This should be allowed to bubble (apparently, haven't tested)
                    //return false;
                }
            },
            updateOnline: {
                text: "Update Online Players",
                description: "Manually refreshes the online player list",
                action: function() {
                    getOnline(selectedChannel);
                    // TODO: Prevent spamming this
                    return false;
                }
            },
            settings: {
                text: "Settings",
                action: function() {
                    return false;
                }
            },
            scripts: {
                text: "User Scripts",
                action: function() {
                    userDialog.openDialog();
                    return false;
                }
            },
            about: {
                text: "About",
                action: function() {
                    aboutDialog.openDialog();
                    return false;
                }
            }
        });
        
        var settingMenu = new MenuList({
            toggleSys: {
                text: "System Messages ["+ (settings.showSysMessages ? "on" : "off") +"]",
                description: "Toggles the visibility of system messages",
                action: function() {
                    toggleSysMsgVisibility();
                    var stat = settings.showSysMessages ? "on" : "off";
                    settingMenu.modifyEntry("toggleSys", "System Messages ["+stat+"]");
                    return false;
                }
            },
            loginHistory: {
                text: "Change Login History",
                description: "Change the amount of chat history shown upon entering",
                action: function() {
                    changeLoginHistory();
                    return false;
                }
            },
            detectChannel: {
                text: "Detect Channels ["+ (settings.detectChannels ? "on" : "off") +"]",
                description: "Automatically detect the available channels",
                action: function() {
                    var newVal = !settings.detectChannels;
                    
                    settingMenu.modifyEntry("detectChannel", "Detect Channels ["+ (newVal ? "on" : "off") +"]");
                    
                    changeSetting("detectChannels", newVal);
                    // TODO: If changed to true, attempt to load the channels
                    return false;
                }
            }
        });
        mainMenu.addMenu("settings", settingMenu);
        
        addMenu(mainMenu);
        
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
                var val = $input.val();
                if(val.length < 1) {
                    return;
                }
                var cursorPos = $input.prop('selectionEnd');
                // TODO: Do something about names with spaces
                // If the cursor is on a non-name character (letters and '-'), then there is nothing to complete
                if(!(/[\w\-]/).test(val.charAt(cursorPos-1))) {
                    return;
                }
                // Cut off anything on the right hand side of cursor
                var namePart = val.substring(0, cursorPos);
                // And everything on the left hand side to the previous space
                var lastSpace = namePart.lastIndexOf(' ');
                if(lastSpace < 0) {
                    lastSpace = 0;
                } else {
                    // If a space is found we don't want to include it
                    lastSpace++;
                }
                var endPos = namePart.length;
                var namePart = namePart.substring(lastSpace, endPos);
                
                var match = _matchPlayers(namePart);
                if(match !== '') {
                    // TODO: Location aware replace based on preference
                    $input.val( val.substring(0, lastSpace) + match + val.substring(endPos, val.length) );
                    // TODO: Make this optional, putting the cursor at the end of the line can be handy
                    var newCursorPos = lastSpace+match.length;
                    $input[0].setSelectionRange(newCursorPos, newCursorPos);
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
           
           joinServerChannel(chanServerId, $chanSel.html());
           
           $channelSelect.children('option:eq(0)').prop('selected', true);
           $chanSel.prop('selected', false);
        });
        // Track page resizing for scroll
        $(window).resize(function() {
            var curChan = channels[selectedChannel];
            // Maintain bottom-ness if at bottom
            var $cWin = $('#chat-window-'+curChan.id);

            if(curChan.atBottom) {
                $cWin.scrollTop( $cWin.prop('scrollHeight') );
            } else {
                $cWin.addClass('historyShade');
            }

        });
        
        // Timers (Times are default from NEaB)
        // Start Chat Timer
        getAllMessages();
        getAllOnline();
        getInvasionStatus();
        var chatHeartBeat = setInterval(getAllMessages, 4000);
        // Start Online Timer
        var onlineHeartBeat = setInterval(getAllOnline, 16000);
        // Start Checking for Invasions
        var invasionHeartBeat = setInterval(getInvasionStatus, 20000);
        
        // This is a special call to joinChat that can't be canceled, it's the initial join
        var ctx = {
            channelId: chan.id,
            channel: chan.name,
            firstJoin: true
        };
        PluginManager.runHook('joinChat', ctx);
        
        renderChannelList();
        if(settings.detectChannels === true) {
            $.ajax({
                url: 'general_chat.php',
                data: 'CHANNEL=0&TAB=0',
                type: 'GET',
                context: this,
                success: function(result) {
                    var r = /\<option[ selected]* value=(\d+)\>([A-Za-z0-9 ]+)\n/gi;
                    var tmp = result.split(r);
                    tmp.shift();
                    tmp.pop();
                    if(tmp.length < 2) {
                        return;
                    }
                    // This yields a strange array, something like:
                    // ["<room id>", "<room name>", "", "<next room id>", ...]
                    // So that's why we're skipping 3 instead of the usual 1
                    availChannels = [];
                    for(var i = 0; i < tmp.length; i+=3) {
                        availChannels.push({"id": parseInt(tmp[i]), "name": tmp[i+1]});
                    }
                    renderChannelList();
                }
            });
        }
    }
    
    return {
        'init': function() {
            init();
        },
        'joinChannel': function(chanServerId, name) {
            joinServerChannel(chanServerId, name);
        },
        'leaveChannel': function(chanId) {
            removeChannel(chanId);
        },
        'selectChannel': function(id) {
            switchChannel(id);
        },
        'insertInputText': function(text, focus) {
            $input.val($input.val() + text);
            if(typeof focus === 'undefined' || focus !== false) {
                $input.focus();
            } 
        },
        'addPlugin': function(plugin) {
            //return PluginManager.registerPlugin(plugin);
            return queuePlugin(plugin);
        }
    };
})(window, jQuery);

// -- Ancillary functions -- //
/**
 * Toggles the visibility of the help menu
 */
function toggleHelp() {
    $('#chatHelp').toggle();
}

/**
 * Selects the text (and other contents) of an element
 * @param {DOMNode} elem The DOM Node to select the contents of
 */
function selectElement(elem) {
    // Heavily influenced by http://stackoverflow.com/a/2838358
    if (window.getSelection && document.createRange) {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(elem);
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (document.body.createTextRange) {
        var range = document.body.createTextRange();
        range.moveToElementText(elem);
        range.select();
    }
}

/**
 * Pads a number with a 0 if the number is < 10
 * @param {int} num The number to be padded
 * @returns {String} The resulting padded number
 */
function numPad(num) {
    return num < 10 ? '0'+num : num;
}

function openWhoWindow(player) {
    window.open('player_info.php?SEARCH='+escape(player), '_blank', 'depandant=no,height=600,width=430,scrollbars=no');
    return false;
}

Chat.addPlugin({
    name: "/who Command",
    description: "Gives basic /who and /whois support. A nice simple plugin",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        'send': function(e) {
            var line = e.text;
            if(line.indexOf('/who') === 0 || line.indexOf('/whois') === 0) {
                var textPiece = line.split(' ').splice(1).join('_');
                window.open('player_info.php?SEARCH='+escape(textPiece), '_blank', 'depandant=no,height=600,width=430,scrollbars=no');
                e.clearInput = true;
                e.stopEventNow = true;
            }
        }
    }
});

Chat.addPlugin({
    name: "Auto /pop",
    description: "Automatically /pops when you enter the Lodge",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        'joinChat': function(e) {
            if(e.firstJoin === true) {
                this.sendMessage("/pop");
            }
        }
    }
});

Chat.addPlugin({
    name: "Clickable Names",
    description: "Makes usernames link to the player's info page",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        receive: function(e) {
            var msg = e.message;
            // Check for actions and joins ('** <username> <whatever>' and '-- <username> <whatever>') [TODO]
            // Check what's said (<username>&gt;)
            // Check against online players [TODO]
            msg = msg.replace(/<B>*([\w\-]+)(\&gt;)<\/B>*/i, "<b><a href='#' class='chatLineName' onclick='openWhoWindow(\"$1\"); return false;'>$1</a>$2</b>");
            e.message = msg;
        }
    }
});

/*Chat.addPlugin({
    name: "Smiley Replace",
    description: "Replaces smilies with their text equivalent",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        receive: function(e) {
            e.message = Smilies.replaceTagsWithText(e.message);
        }
    }
});*/