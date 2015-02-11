/* Copyright (c) 2013-2014 Kevin Ott (aka Etzos) <supercodingmonkey@gmail.com>
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
var Chat = (function (window, $) {
    var version = "2.4.2";

    var URL = {
        send: '../sendchat.php',
        receive: '../lastchat.php',
        channels: '../rs/channels.php',
        online: '../rs/online.php',
        invasion: '../check_invasions.php',
        player: '../player_info.php'
    };

    var INVASION_STATUS = {
        // I'm guessing for these, since there seems to be some duplication
        "1": {msg: "Unknown", color: "greenText"},            // Default (unknown) value
        "2": {msg: "Invasion!", color: "redText"},            // An active invasion
        "3": {msg: "Possible Invasion", color: "yellowText"}, // An invasion either will happen or has already happened today
        "4": {msg: "No Invasion", color: "greenText"}         // No invasions today
    };

    var localStorageSupport = "localStorage" in window && window.localStorage !== null;
    var scriptRegex = /<script>[^]*?<\/script>/gi;
    var whisperRegex = /(to |from )([\w\- ]+)(>)/i;

    var channelMeta = {},           // Contains metadata on channels that have been joined
        focusedChannel = null,      // The currently selected and visible channel
        numTimeouts,                // The number of times the connection has timed out
        lastConnection,             // The time it took for the last connection to go through
        playerName,                 // The player's name
        availChannels = [           // The list of available channels
            {"id": 0, "name": "Lodge"},
            {"id": 1, "name": "Newbie"},
            {"id": 6, "name": "Trade Channel"}
        ],
        initiated = false,          // True when init() has been run, false otherwise
        queuedPlugins = [],         // Stop-gap container for plugins that have to wait for init()
        queryTimeout = 4 * 1000;    // Value to use for timeouts (4 seconds)

    var settings = {
        showSysMessages: true,      // Whether or not to show system messages
        chatHistoryLogin: 20,       // The number of history lines shown on entry
        maxHistoryLength: -1,       // The number of chat history lines to save (values < 1 default to all saved)
        versionPopup: true,         // Whether to show the version popup when NChatN updates or not
        forceDown: false,           // Whether to just force the chat to bottom when a new message is added
        selfMsgNoDisplay: true,     // Whether to show a new message animation from your own messages or not
        disabledPlugins: [          // A list of the names of plugins to disable
            "Smiley Replace"        // This plugin is more of a test than an actual plugin, so disable it
        ]
    };

    var $input,                     // Input for chat
        $tabContainer,              // The container for chat tabs
        $onlineContainer,           // The container for online players
        $chatContainer,             // The container for chat
        $menu,                      // The menu container
        $invasion;                  // Invasion message container

    // Initialize the PluginManager
    try {
        // TODO: Remove external dependencies from the PluginManager
        // NOTE: For now, export just the values the PluginManager needs access to.
        var pluginManager = new PluginManager($, {
            sendMessage: sendMessage,
            channelMeta: channelMeta,
            focusedChannel: focusedChannel,
            playerName: playerName,
            settings: settings
        });
    } catch(e) {
        console.error(e);
    }

    /**
     * Generates a row (one entry) for the online player list
     *
     * @param {number} id - The ID of the player
     * @param {string} name - The name of the player
     * @param {string} icon - The filename of the player's icon
     * @param {boolean} isAway - Whether the player is away or not
     * @returns {string} The templated string for a single plyer entry in the online player list
     */
    function templateOnlinePlayerRow(id, name, icon, isAway) {
        var awayClass = (isAway === "true") ? "" : "inactive";
        var spanAwayClass = (isAway === "true") ? "dimText" : '';

        return "<li id='player-list-player-"+id+"' class=''>" +
               "<a href='#'>" +
               "<span class='player-icon'><img src='../" + icon + "'></span><img src='../images/away.gif' class='" + awayClass + "'>" +
               "<span class='player-name " + spanAwayClass + "'>" + name + "</span>" +
               "</a>" +
               "<ol class='inactive'><li><a href='#'>Private Chat</a></li><li><a href='#'>Whois</a></li></ol>" +
               "</li>";
    }

    /**
     * Gets the invasion status from the server
     */
    function getInvasionStatus() {
        $.ajax({
            url: URL.invasion,
            data: "RND=" + _getTime(),
            type: "GET",
            context: this,
            timeout: queryTimeout,
            success: function(result) {
                var imageId = result.charAt(0);
                var message = result.substring(1);
                _updateInvasionMessage(imageId, message);
            }
        });
    }

    /**
     * Updates the connection status light
     */
    function updateTickClock() {
        var lightClass = "greenLight";
        var text = "Delay: " + (lastConnection/1000) + " sec";
        if(numTimeouts === 1) {
            lightClass = "yellowLight";
            text = "Timeout: 1";
        } else if(numTimeouts > 1) {
            lightClass = "redLight";
            text = "Timeout: " + numTimeouts;
        } else if(lastConnection > 1000) {
            lightClass = "yellowLight";
            text = "High Delay (" + (lastConnection/1000) + " sec)";
        }

        var $light = $("#mainLight").children().first();
        $light.removeClass("greenLight yellowLight redLight")
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
     * @param {string} status - The numerical status message (treated as a string)
     * @param {string} message - The invasion message to be shown on hovering over the status
     */
    function _updateInvasionMessage(status, message) {
        if(!INVASION_STATUS.hasOwnProperty(status)) {
            console.error("Unknown invasion status: '"+status+"'");
            return;
        }
        var invStatus = INVASION_STATUS[status];
        // Create the new elements
        var $span = $("<span></span>")
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
     * @param {string} message - The message to wrap
     * @returns {string} A string wrapped in the appropiate tags to mark it as a system message
     */
    function _formatSystemMsg(message) {
        return '<span class="systemMsg">'+message+'<br></span>';
    }

    /**
     * Returns wheter the given element is scrolled all the way down or not
     *
     * @param {jQuery} $elem - The jQuery wrapped element
     * @returns {boolean} True if the given element is scrolled all the way down, false otherwise
     */
    function _isAtBottom($elem) {
        return ($elem.prop("scrollHeight") - $elem.prop("scrollTop") === $elem.prop("clientHeight"));
    }

    /**
     * Subtracts the contents of the second array from the contents of the first and returns the result
     *
     * @param {mixed[]} first - The first array, the one that will have elements subtracted
     * @param {mixed[]} second - The second array, the one that will be subtracted
     * @returns {mixed[]} The result of first - second
     */
    function _arrSub(first, second) {
        return $.grep(first, function(x) {
            return $.inArray(x, second) < 0;
        });
    }

    /**
     * Returns the current datetime as a UTC string
     *
     * This is used as the random value in the queries (as far as I can tell)
     * @returns {string} The escaped time
     */
    function _getTime() {
        return escape(new Date().toUTCString());
    }

    /**
     * Attempts to match a partial username to one in the list of online players
     *
     * @param {string} fragment The player name fragment to attempt to find a match for
     * @returns {mixed} Returns an empty string if none found, a string containing the one name matched, or an array of matches
     */
    function matchPlayerName(fragment) {
        var players = channelMeta[focusedChannel].playerList;
        var matches = [];

        fragment = fragment.toLowerCase();
        for(var i = 0; i < players.length; i++) {
            var player = players[i];
            if(player.toLowerCase().indexOf(fragment) === 0) {
                matches.push(player);
            }
        }

        if(matches.length === 1) {
            return matches[0];
        }
        return "";
    }

    // -- Server Methods -- //
    /**
     * Sends a message to the server
     *
     * @param {string} message - The message to send to the server
     * @param {Channel} channel - The channel to sendd the message to (this is one of the internal Channel objects)
     */
    function sendMessage(message, channel) {
        var text;
        var isFromInput = true;
        if(typeof message === "undefined") {
            text = $input.val();
        } else {
            text = message;
            isFromInput = false;
        }
        var chan;
        if(typeof channel === "undefined") {
            chan = channelMeta[focusedChannel];
        } else {
            chan = channel;
        }

        // PreSend Hook
        var ctx = {
            channel: chan,      // The current channel (should be read-only)
            text: text,         // The text being sent
            clearInput: true,   // Whether the input box should be cleared or not
            addToBuffer: true   // Whether the line should be added to the history buffer or not
        };
        var hook = pluginManager.runHook("send", ctx);

        text = hook.text;

        if(hook.addToBuffer === true) {
            // Trim input buffer back if it's large (give it some headroom too)
            if(chan.buffer.length > 55) {
                chan.buffer = chan.buffer.splice(49);
            }

            // Push this entry into the buffer
            chan.buffer.push(text);
            // And clear any leftovers
            chan.buffer[0] = "";
            chan.bufferPointer = 0;
        }

        if(isFromInput && hook.clearInput) {
            $input.val("");
        }
        if(hook.stopEvent) {
            return;
        }

        var isServer = (chan.type === "server");
        // Target whisper channels to lodge (to remain consistent)
        var targetChannel = isServer ? chan.id : 0;
        var to = isServer ? "*" : chan.pm;
        var rand = _getTime();

        // Process text for transmission
        // TODO: Get around using escape(), it's a nasty thing to do as it's been deprecated
        text = escape(text).replace(/\+/g, "%2B");

        // Send the message
        $.ajax({
            url: URL.send,
            data: "CHANNEL=" + targetChannel + "&TO=" + to + "&RND=" + rand + "&TEXT=" + text,
            type: "GET",
            timeout: queryTimeout,
            error: function() {
                // TODO: Store message
            }
        });
        // TODO: PostSend Hook
    }

    /**
     * Checks the server for new messages
     *
     * @param {Channel} channel - The channel to check for new messages (internal Channel object)
     */
    function retrieveMessage(channel) {
        // Skip non-server channels
        if(channel.type !== "server") {
            return;
        }

        // Check connection speed only for Lodge (for now)
        if(channel.id === 0) {
            var timeStart = Date.now();
        }

        $.ajax({
            url: URL.receive,
            data: "CHANNEL=" + channel.id + "&RND=" + _getTime() + "&ID=" + channel.lastMessageID,
            type: "GET",
            context: this,
            timeout: queryTimeout,
            success: function(result) {
                if(result === "")
                    return;

                if(channel.id === 0) {
                    // Update last connection
                    lastConnection = Date.now() - timeStart;
                    // Clear any timeouts
                    numTimeouts = 0;
                }

                var splitLoc = result.indexOf("\n");
                var last = parseInt(result.substring(0, splitLoc));

                if(last !== channel.lastMessageID) {
                    var isInit = (channel.lastMessageID === 0);
                    channel.lastMessageID = last;

                    var msgArr = result.substring(splitLoc+1, result.length).split("<BR>");
                    // Init has an extra <BR> tag that should be avoided
                    var end = (isInit) ? msgArr.length-1 : msgArr.length;
                    // Only reset the begining if it's needed (init and the sent messages are too long)
                    var begin = (isInit && end > (settings.chatHistoryLogin-1)) ? end-settings.chatHistoryLogin : 0;

                    var whisperTarget = null;
                    // Insert each message in order
                    for(var i = begin; i < end; i++) {
                        var msg = msgArr[i];
                        if(msg === "") {
                            continue;
                        }
                        // Fix the href attributes
                        msg = msg.replace(/(?:<a)(.*)href=(?!")(.+?) /gi, "<a$1href=\"$2\" ");
                        var isScript = scriptRegex.test(msg);
                        // Remove any attempts at inserting script tags a player may have used
                        if(!isScript) {
                            msg = msg.replace(/\%3C/ig, "%253C").replace(/\%3E/ig, "%253E");
                        }

                        msg = unescape(msg);
                        msg += "<br>";

                        while (msg.indexOf("<img src=smilies/") >= 0) {
                            msg = msg.replace("<img src=smilies/","<img src=../smilies/");
                        }
                        msg = $($.parseHTML(msg, !isInit));

                        var lineIdent = msg.filter("span.username,span.bot.whisper").text();
                        whisperTarget = whisperRegex.exec(lineIdent);

                        // Old scripts shouldn't run during init
                        if(isInit && isScript) {
                            continue;
                        }

                        // No one is allowed to circumvent scripts running
                        if(!isScript) {
                            var hook = pluginManager.runHook("receive", {
                                isInit: isInit,
                                message: msg,
                                channel: channel
                            });

                            if(hook.stopEvent) {
                                continue;
                            }

                            var noShowNewMessage = false;

                            if(whisperTarget) {
                                var whisperChannel;
                                if(!inChannel("local", whisperTarget[2], true)) {
                                    whisperChannel = createWhisperChannel(whisperTarget[2], true);
                                } else {
                                    whisperChannel = channelMeta[getTag("local", whisperTarget[2])];
                                }

                                // Check for self message
                                if(settings.selfMsgNoDisplay && lineIdent.indexOf("to ") > -1) {
                                    noShowNewMessage = true;
                                }
                                insertMessage(whisperChannel, hook.message, false, noShowNewMessage);
                            } else {
                                if(settings.selfMsgNoDisplay && lineIdent.indexOf(playerName) > -1) {
                                    noShowNewMessage = true;
                                }
                                insertMessage(channel, hook.message, false, noShowNewMessage);
                            }
                        } else {
                            // This is inserting a script not really a message
                            insertMessage(channel, msg, false);
                        }
                    }
                    if(isInit && channel.id === 0) {
                        // Add a visual cue of messages past
                        for(var chan in channelMeta) {
                            insertMessage(channelMeta[chan], "<hr>", false, true);
                        }
                    } else if(isInit) {  // NOTE: This means isInit && channel.id != 0
                        insertMessage(channel, "<hr>", false, true);
                    }
                }
            }
        })
        .fail(function() {
            if(channel.id === 0)
                numTimeouts++;
        })
        .always(function() {
            if(channel.id === 0) {
                updateTickClock();
            }
        });
    }

    /**
     * Helper function to get new messages from all channels
     *
     * This checks all channels that are marked as type "server" so things like whisper tabs
     * won't mess it up at all.
     */
    function retrieveAllMessages() {
        var channel;
        for(var tag in channelMeta) {
            channel = channelMeta[tag];
            if(channel.type !== "server" || !channel.active) {
                continue;
            }
            try {
                retrieveMessage(channel);
            } catch(e) {
                console.error(e);
            }
        }
    }

    /**
     * Checks the server for online players
     *
     * @param {Channel} channel - The channel to look for online players in (internal Channel object)
     */
    function retrieveOnline(channel) {
        if(channel.type !== "server") {
            return;
        }

        $.ajax({
            url: URL.online,
            data: "CHANNEL=" + channel.id,
            type: "GET",
            context: this,
            timeout: queryTimeout,
            dataType: "json",
            success: function(result) {
                var oldPlayerList = $.merge([], channel.playerList);

                channel.playerList = [];
                // Add bots
                $.each(result.bots, function(i, data) {
                    channel.playerList.push(data.name);
                });
                // Add players (as well as changing the way they're stored)
                $.each(result.players, function(i, data) {
                    channel.playerList.push(data.name);
                });
                // Note: I'm ignoring guests on purpose as that function isn't possible anymore (as far as I know)

                // TODO: This doesn't really check if it's when first entering the chat room, although that's probably not an issue
                if(oldPlayerList.length > 0) {
                    var entered = _arrSub(channel.playerList, oldPlayerList);
                    for(var i = 0; i < entered.length; i++) {
                        insertMessage(channel, _formatSystemMsg("-- " + entered[i] + " joins --"), true);
                    }
                    // old - new = leave
                    var left = _arrSub(oldPlayerList, channel.playerList);
                    for(var i = 0; i < left.length; i++) {
                        insertMessage(channel, _formatSystemMsg("-- " + left[i] + " departs --"), true);
                    }
                }

                channel.players = result;
                redrawOnlineList(channel);
            }
        });
    }

    /**
     * Helper function to get online players from all channels
     *
     * This checks all channels that are marked as type "server" so things like whisper tabs
     * won't mess it up at all.
     */
    function retrieveAllOnline() {
        var channel;
        for(var tag in channelMeta) {
            channel = channelMeta[tag];
            if(channel.type !== "server" || !channel.active) {
                continue;
            }
            try {
                retrieveOnline(channel);
            } catch(e) {
                console.error(e);
            }
        }
    }

    // -- Online Player Util Methods -- //
    /**
     * Redraws the online player list for a given channel
     *
     * @param {Channel} channel - The channel for which to redraw the online list
     */
    function redrawOnlineList(channel) {
        // TODO: Include guests
        var players = channel.players;

        // Build the contents
        var $html = $();
        $.each(players.bots, function(key, value) {
            var $row = $( templateOnlinePlayerRow(value.name, value.title + " " + value.name, value.icon, "false") );
            $row.find("ol li a").each(function(i) {
                var $this = $(this);
                $this.on("click", function() {
                    if(i === 0) {
                        createWhisperChannel(value.name);
                    } else if(i === 1) {
                        alert(value.name + " is a chat bot. He doesn't have any stats.");
                    }
                    return false;
                });
            });
            if($html.length < 1) {
                $html = $row;
            } else {
                $html = $html.add($row);
            }
        });
        $.each(players.players, function(key, value) {
            var $row = $( templateOnlinePlayerRow(value.id, value.title + " " + value.name, "players_small/" + value.icon, value.away) );
            $row.find("ol li a").each(function(i) {
                var $this = $(this);
                $this.on("click", function() {
                    if(i === 0) {
                        createWhisperChannel(value.name);
                    } else if(i === 1) {
                        openWhoWindow(value.name);
                    }
                    return false;
                });
            });
            if($html.length < 1) {
                $html = $row;
            } else {
                $html = $html.add($row);
            }
        });

        var $onlineWin = $(channel.elem.online);
        // Remember any opened players
        var $found = $onlineWin.find(".playerMenuShown");
        var selectedID = "";
        if($found.length > 0) {
            selectedID = $found.attr("id");
        }

        // Add transition and other handy effects to the built content
        $html.each(function() {
            var $this = $(this);
            var $toHide = $this.find("ol");

            var hideFunc = function() {
                $toHide.one("transitionend", function() {
                    $toHide.hide();
                });
                $this.removeClass("playerMenuShown");
            };

            if($this.attr("id") === selectedID) {
                $this.addClass("playerMenuShown");
                $(document).one("click", hideFunc);
                $this.find("ol a").one("click", hideFunc);
            }

            $this.find("a:first").on("click", function() {
                $this.siblings().removeClass("playerMenuShown");
                $toHide.show();

                $(document).one("click", hideFunc);
                $this.find("ol a").one("click", hideFunc);

                // We have to wait for it to be added before showing
                setTimeout(function() {
                    $this.toggleClass("playerMenuShown");
                }, 1);
                return false;
            });
        });

        $onlineWin.empty().append($html);
    }

    /**
     * Redraws the online player list for a whisper channel
     *
     * @param {Channel} channel - The channel for which to redraw the online list
     * @todo Check to make sure that the channel is a whisper channel
     */
    function redrawWhisperOnlineList(channel) {
        var $onlineWin = $(channel.elem.online);
        $.each(channel.playerList, function(index, value) {
            var $elem = $("<li class='onlineListTextOnly'><a href='#'>" + value + "</a></li>");
            $elem.find("a").on("click", function() {
                // TODO: Find a better way to figure out which is a bot
                if(value === "Glum") {
                    alert("Glum is a bot and doesn't have any stats.");
                } else {
                    openWhoWindow(value);
                }
                return false;
            });
            $elem.appendTo($onlineWin);
        });
    }

    // -- Channel Methods -- //
    /**
     * "Interal" function that handles actually inserting a new message
     *
     * @param {Channel} channel - The channel to insert the message into (internal channel object)
     * @param {string} message - The message to insert into the channel
     * @param {boolean} [isSys=false] - Sets whether the message is a "system" message (used for join/depart) or not
     * @param {boolean} [skipNewAnim=false] - Whether to skip the new message animation or not
     */
    function insertMessage(channel, message, isSys, skipNewAnim) {
        if(typeof isSys === "undefined") {
            isSys = false;
        }
        if(typeof skipNewAnim === "undefined") {
            skipNewAnim = false;
        }

        var $chatWin = $(channel.elem.chat);
        var isSelected = (channel === channelMeta[focusedChannel]);
        var isBottom = (isSelected) ? _isAtBottom($chatWin) : channel.atBottom;

        $chatWin.append(message);

        if(isSys && !settings.showSysMessages) {
            $(".systemMsg").hide();
        }
        if(isBottom || settings.forceDown) {
            // TODO: Attempt to animate this
            $chatWin.scrollTop($chatWin.prop("scrollHeight"));
        }
        scrollCheck(channel);
        // Update tabs (if working on a tab that's not focused)
        if(!isSelected && !skipNewAnim && (!isSys || (isSys && settings.showSysMessages))) {
            // This if is nasty, so let me explain for quicker parsing:
            // * If the current tab isn't selected AND
            // * If we weren't told to skip the animation AND
            //   - It's not a system message/It's a normal message OR
            //   - It is a system message AND system message's are turned on
            channel.newMessage++;
            var $tabElem = $(channel.elem.tab);
            $tabElem.addClass("newMessageTab");
            _showNewMessageNum($tabElem, channel.newMessage);
        }
    }

    /**
     * Gets the tag name for a channel
     *
     * This function is almost entirely useless as it's basically just a
     * string concat. However, it's handy as a shortener.
     *
     * @param {string} type - The type of channel
     * @param {string|number} id - The id of the channel
     * @return {string} The resulting tag
     */
    function getTag(type, id) {
        id = (typeof id === "string") ? id.toLowerCase() : id;
        return type.toLowerCase() + "-" + id;
    }

    /**
     * Creates, returns, and adds a channel to the interal channel store
     *
     * @param {string} type - The type of channel (currently only "server" or "local")
     * @param {string|number} id - The id of the channel
     * @param {string} name - The name of the channel
     * @return {Channel} The newly created channel object
     */
    function addChannelMeta(type, id, name) {
        if(!type in ["server", "local"]) {
            throw Error("Bad channel type '" + type + "'");
            return null;
        }
        if(typeof id === "undefined") {
            throw Error("ID must be given! (Int for server type, String for whisper type)");
            return null;
        }

        var tag = getTag(type, id);
        // Don't allow recreation of existing channels
        if(channelMeta.hasOwnProperty(tag)) {
            return channelMeta[tag];
        }
        var chan = {
            type: type,             // Type of channel (server or local)
            id: id,                 // ID of channel (an int for a server channel and a string for a local channel)
            active: true,           // True if the channel is active (open) and false if not (closed)
            elem: {                 // The element IDs of the channel (for the chat, online, and tab elements)
                chat: "#chat-window-" + tag,
                online: "#online-window-" + tag,
                tab: "#chat-tab-" + tag
            },

            name: name,             // The name of the channel
            lastMessageID: 0,       // [Server] The ID of the last message received from the server
            input: "",              // The current input (only valid when the channel isn't focused)
            players: [],            // [Server] A list of players
            lastPlayerHash: "",     // [Server] The last player hash sent by the server
            playerList: [],         // A list of players currently in the channel (used for tab-completion)
            pm: "*",                // [Local] The current private message target
            newMessage: 0,          // How many new unread messages there are
            atBottom: true,         // Whether the player is scrolled all the way to the bottom of chat history (only valid on non-focus)
            buffer: [''],           // A buffer of the last messages sent to this channel (fill with one bcause that's current buffer)
            bufferPointer: 0        // Where in the buffer the player is viewing currently
        };
        channelMeta[tag] = chan;
        return chan;
    }

    /**
     * A helper function for joining a given channel
     *
     * @param {string} type - The type of the channel
     * @param {string|number} id - The ID of the channel
     * @returns {Channel} A reference to the channel that was joined
     */
    function joinChannel(type, id) {
        var chan;
        if(inChannel(type, id, true)) {
            chan = channelMeta[getTag(type, id)];
            // Force the channel to be active again (if it wasn't already)
            if(!chan.active) {
                chan.active = true;
            }
        } else {
            var name = "";
            if(type === "server") {
                name = "";
            } else {
                name = "W: " + id;
            }
            chan = createChannel(type, id, name);
            // Make sure the target is set for a whisper channel
            if(type === "local") {
                chan.pm = id;
            }
        }
        focusChannel(type, id);
        return chan;
    }

    /**
     * Creates a new channel (and EVERYTHING along with it)
     *
     * This is used to create a channel, tabs, window, etc.
     *
     * @param {string} type - The type of channel (server or local)
     * @param {string|number} id - The id of the channel
     * @param {string} name - The name of the channel
     * @return {Channel} A refernce to the newly created channel
     * @note I made this because joinChannel() may not be the only one creating channels (e.g. plugins)
     */
    function createChannel(type, id, name) {
        var tag = getTag(type, id);
        if(channelMeta.hasOwnProperty(tag)) {
            return null;
        }
        var chan = addChannelMeta(type, id, name);
        // TODO: Add some form of the joinChat hook
        // Chat History
        $("<div>", {
            id: chan.elem.chat.substring(1),
            class: "chatWindow inactive"
        }).scroll(function() {
            //Check to see if it's at the bottom
            scrollCheck(chan);
        }).appendTo($chatContainer);

        // Online Window
        $("<ol>", {
            id: chan.elem.online.substring(1),
            class: "onlineWindow onlinePlayerList inactive"
        }).appendTo($onlineContainer);

        // Chat Tab
        var $del = '';
        if(chan.id !== 0) {
            $del = $("<span>")
                .addClass("tabClose")
                .append(
                    $("<a>", {
                        href: "#"
                    })
                    .html("X")
                    .click(function(e) {
                        closeChannel(type, id);
                        e.stopImmediatePropagation();
                        return false;
                    })
                );
        }
        var $tab = $("<li>", {
            id: chan.elem.tab.substring(1),
            class: "closedTab"
        }).append(
            $("<a>", {
                href: "#",
                class: "tabLink",
                title: chan.name
            }).click(function() {
                focusChannel(chan.type, chan.id);
                return false;
            }).append("<span class='tabName'>" + chan.name + "</span><span class='newMsgs'>0</span>").append($del)
        );
        // Hackery to animate things
        $tab.appendTo($tabContainer);
        setTimeout(function() {
            $tab.removeClass("closedTab");
        }, 10);
        return chan;
    }

    /**
     * Helper function for creating and then focusing on a server channel
     *
     * This can safely be used to "create" a channel that already exists.
     *
     * @param {number} id - The ID of the channel to create
     * @param {string} name - The name of the channel to create
     * @param {boolean} [noFocus=true] - Whether the channel should be focused or just created
     * @return {Channel} A reference to the channel
     */
    function createServerChannel(id, name, noFocus) {
        var shouldFocus = (typeof noFocus === "undefined") ? true : !noFocus;
        var channel = createChannel("server", id, name);
        if(channel === null) {
            var chan = channelMeta[getTag("server", id)];
            openChannel(chan);
            if(shouldFocus) {
                focusChannel("server", id);
            }
            return chan;
        }
        retrieveOnline(channel);
        if(shouldFocus) {
            focusChannel("server", id);
        }
        return channel;
    }

    /**
     * Helper function for creating and then focusing on a whisper channel
     *
     * This can safely be used to "create" a channel that already exists.
     *
     * @param {number} id - The ID of the channel to create
     * @param {string} name - The name of the channel to create
     * @param {boolean} [noFocus=true] - Whether the channel should be focused or just created
     * @return {Channel} A reference to the channel
     */
    function createWhisperChannel(player, noFocus) {
        var shouldFocus = (typeof noFocus === "undefined") ? true : !noFocus;
        var normalizedPlayer = player.toLowerCase();
        var channel = createChannel("local", normalizedPlayer, "W: " + player);
        if(channel === null) {
            var chan = channelMeta[getTag("local", normalizedPlayer)];
            openChannel(chan);
            if(shouldFocus) {
                focusChannel("local", normalizedPlayer);
            }
            return chan;
        }
        channel.pm = player; // TODO: Replace spaces with underlines
        channel.playerList = [playerName, player];
        channel.playerList.sort();
        // Whisper channels only do one render of online list
        redrawWhisperOnlineList(channel);
        if(shouldFocus) {
            focusChannel("local", normalizedPlayer);
        }
        return channel;
    }

    /**
     * Interal function for focusing a channel
     *
     * This should be used *everywhere* a channel needs to be focused as it
     * calls a hook.
     *
     * @param {string} type - The type of channel
     * @param {string|number} id - The ID of the channel
     */
    function focusChannel(type, id) {
        var tag = getTag(type, id);
        var currentExists = (focusedChannel !== null);
        var newFocus = channelMeta[tag];
        // Non-active tabs cannot be focused
        if(!newFocus.active) {
            return;
        }
        var currentFocus = currentExists ? channelMeta[focusedChannel] : null;

        // Tab Change Hook
        var ctx = {
            newChannel: newFocus,
            oldChannel: currentFocus
        };
        var hook = pluginManager.runHook("tabChange", ctx);
        if(hook.stopEvent) {
            return;
        }
        // End Tab Change Hook

        // Old focus
        if(currentExists) {
            currentFocus.input = $input.val();
            var $currentChatWin = $(currentFocus.elem.chat);
            currentFocus.atBottom = _isAtBottom($currentChatWin);
            $currentChatWin.find("hr.lastSeen").remove().end().append("<hr class='lastSeen'>");
            $(currentFocus.elem.tab).removeClass("selectedTab");
        }

        // New focus
        var $chatWin = $(newFocus.elem.chat);
        var $newFocusTabElem = $(newFocus.elem.tab);
        $chatWin.show().siblings().hide();
        $(newFocus.elem.online).show().siblings().hide();
        if(newFocus.atBottom === true) {
            $chatWin.scrollTop($chatWin.prop("scrollHeight"));
        }
        if(newFocus.newMessage > 0) {
            newFocus.newMessage = 0;
            _hideNewMessageNum($newFocusTabElem);
        } else {
            // If there are no new messages, don't show an indicator
            $chatWin.find("hr.lastSeen").remove();
        }
        $newFocusTabElem.addClass("selectedTab").removeClass("newMessageTab");
        $input.val(newFocus.input).focus();

        focusedChannel = tag;
        pluginManager.setChatValue("focusedChannel", focusedChannel);
    }

    /**
     * Handles drawing the new number of new messages on a chat tab
     *
     * Numbers > 99 will automatically be rounded.
     *
     * @param {jQuery} $elem - The jQuery object reference of the tab to modify
     * @param {number} amount - The number of new messages
     */
    function _showNewMessageNum($elem, amount) {
        if(amount > 99) {
            amount = amount.toString() + "+";
        }
        $elem.find(".tabName").css("width", "90px");
        $elem.find(".newMsgs").text(amount).show();
    }

    /**
     * Handles clearing the number of new messages on a chat tab
     *
     * @param {jQuery} $elem - The jQuery object reference of the tab to modify
     */
    function _hideNewMessageNum($elem) {
        $elem.find(".newMsgs").hide();
        $elem.find(".tabName").css("width", "110px");
    }

    /**
     * Returns whether the player is in the channel already or not
     *
     * @param {string} type - The type of channel
     * @param {number|string} id - The ID of channel
     * @param {boolean} [ignoreActive=false] - Whether to ignore channels that are active (actually open) or not
     * @return {boolean} True if the channel exists in the channelMeta list, otherwise False
     */
    function inChannel(type, id, ignoreActive) {
        var tag = getTag(type, id);
        ignoreActive = (typeof ignoreActive === "undefined") ? false : ignoreActive;
        if(channelMeta.hasOwnProperty(tag)) {
            if(!ignoreActive || channelMeta[tag].active) {
                return true;
            }
        }
        return false;
    }

    /**
     * Handles closing a channel
     *
     * More specifically this is used to remove a channel from getting new
     * message, hiding the channel window (or destrying it if it's a server
     * channel), and removing the tab. It will not allow closing the Lodge
     * chat.
     * @param {string} type - The type of the channel
     * @param {number|string} id - The ID of the channel
     */
    function closeChannel(type, id) {
        if(type === "server" && id === 0) {
            return; // Leaving Lodge is not allowed
        }

        var tag = getTag(type, id);
        if(focusedChannel === tag) {
            focusChannel("server", 0);
        }

        var chan = channelMeta[tag];
        chan.active = false;
        var $chatWin = $(chan.elem.chat);
        if(chan.type === "server") {
            $chatWin.empty();
            chan.lastMessageID = 0;
        } else if(chan.type === "local") {
            $chatWin.find("hr").remove();
        }
        $chatWin.hide();
        $(chan.elem.online).hide();
        var $tab = $(chan.elem.tab);
        var listenEvent = function(e) {
            if(e.propertyName === "width") {
                $tab.hide().prependTo($tabContainer);
                this.removeEventListener("transitionend", listenEvent, true);
            }
        };
        $tab[0].addEventListener("transitionend", listenEvent, true);
        $tab.addClass("closedTab");
    }

    /**
     * Handles opening a channel
     *
     * More specifically this handles showing the chat window, adding the
     * previous chat indicator, and showing the tab in the tab list.
     * @param {Channel} channel - The channel to open
     */
    function openChannel(channel) {
        if(channel.active) {
            return;
        }
        channel.active = true;
        if(channel.type === "local") {
            // Since local channels don't rely on server, append this now.
            $(channel.elem.chat).append("<hr>");
        }
        var $tab = $(channel.elem.tab);
        $tab.show().appendTo($tabContainer);
        setTimeout(function() {
            $tab.removeClass("closedTab");
        }, 1);
    }

    /**
     * Sets the channel's internal store of the scroll position
     *
     * This function is a bit hard to explain. It's used to store the channel.atBottom property
     * based on the scroll position of the chat window. It's called when a new message is inserted
     * or when switching chat tabs. Needless to say, this should ONLY be called on channels that
     * are visible.
     *
     * @param {Channel} channel - The channel to store scroll information on
     */
    function scrollCheck(channel) {
        var $chatWin = $(channel.elem.chat);
        var atBottom = channel.atBottom;
        if(channel === channelMeta[focusedChannel]) {
            atBottom = _isAtBottom($chatWin);
        }
        channel.atBottom = atBottom;

        if(atBottom) {
            $chatWin.removeClass("historyShade");
        } else {
            $chatWin.addClass("historyShade");
        }
    }

    /**
     * Loads saved settings from localStorage into the internal NChatN variables
     */
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

    /**
     * Saves the internal NChatN settings to localStorage
     */
    function _saveSettings() {
        if(!localStorageSupport) {
            return;
        }

        localStorage.setItem("NChatN-settings", JSON.stringify(settings));
    }

    /**
     * Sets an internal NChatN setting and commits the change
     *
     * @param {string} setting - The name of the setting to change
     * @param {mixed} newValue - The value to change the given setting to
     */
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
     * Changes whether system messages are shown or hidden in chat
     */
    function toggleSysMsgVisibility() {
        if(settings.showSysMessages) {
            $(".systemMsg").hide();
        } else {
            $(".systemMsg").show();
        }
        changeSetting("showSysMessages", !settings.showSysMessages);
    }

    /**
     * Changes how many lines of chat history are shown when entering chat (prompt)
     */
    function changeLoginHistory() {
        var result = window.prompt("How many lines of chat history should show on entry?\n(Enter a number less than 0 to reset to default)", settings.chatHistoryLogin);
        // If empty, assume they want to leave it the same
        if(!result || result === "") {
            return;
        }

        if(result < 0) {
            result = 20;
        }

        changeSetting("chatHistoryLogin", result);
    }

    /**
     * Handles creation of the channel dropdown
     */
    function renderChannelList() {
        var menuContents = {};
        for(var i = 0; i < availChannels.length; i++) {
            var c = availChannels[i];
            menuContents["chan-" + c.id] = {
                text: c.name,
                description: "Join " + c.name,
                action: function(c) {
                    try {
                        createServerChannel(c.id, c.name);
                    } catch(e) {
                        console.error(e);
                    }
                }.bind(this, c)
                // The above bind() is required because the "c" wouldn't be bound until the function is called
            };
        }
        var menu = new MenuList(menuContents);
        var $chan = $("#channelMenu");
        var $chanLink = $("#channelLink");
        $chanLink.off("click");
        $chan.empty();
        // This must be done because the default setting is set to the far right
        menu.pos("4", "124"); // 124px was obtained rather arbitrarily, hopefully it will work for everyone
        $chan.append(menu.getRoot());
        $("#channelLink").click(function() {
            $(document).one("click", function() {
                menu.closeMenu();
            });

            menu.toggle();
            this.blur();
            return false;
        });
    }

    /**
     * Makes a call to the server for a new list of available channels and then updates the list
     */
    function updateChannels() {
        $.ajax({
            url: URL.channels,
            data: "RND=" + _getTime(),
            type: "GET",
            context: this,
            timeout: queryTimeout,
            dataType: "json",
            success: function(result) {
                availChannels = result.channels;
                renderChannelList();
            },
            error: function() {
                renderChannelList();
            }
        });
        // TODO: Handle failure
    }

    /**
     * Adds a root menu object to the chat header
     *
     * @param {Menu} menu - The root menu object
     */
    function addMenu(menu) {
        $menu.removeClass("headerMenu");
        $menu.append(menu.getRoot());
        $("#menuLink").click(function() {
            $(document).one("click", function() {
                menu.closeMenu();
            });

            menu.toggle();
            this.blur();
            return false;
        });
    }

    /**
     * Queues a plugin for registration if init() hasn't been called
     *
     * @todo Load settings before init() is called so that there's no need for this (since plugin registration relies on settings.disabledPlugins)
     *
     * @param {JSON} plugin - The plugin to queue to be added
     * @returns {bool} Result of pluginManager.registerPlugin() or true if init() not called yet
     */
    function queuePlugin(plugin) {
        if(initiated === true) {
            return pluginManager.registerPlugin(plugin);
        } else {
            queuedPlugins.push(plugin);
            return true;
        }
    }

    /**
     * Returns a tokenized version of a version string
     * 
     * Version string format is: major.minor[.release]<br>
     * Where: major = Integer, minor/release = Integer[String]<br>
     * If release is omitted it is assumed to always be 0.<br>
     * Valid version strings:<br>
     * 1.0, 1.2, 1.2a, 1.20.1b
     * @example Version string '1.10' gives {major: 1, minor: 10, minorStr: "", release: 0, releaseStr: ""}
     * @example Version string '1.3.6a' gives {major: 1, minor: 3, minorStr: "", release: 6, releaseStr: "1"}
     * @param {String} str The version string to be tokenized
     * @returns {Object} An object containing the major, minor, release, minorStr, and releaseStr properties reflecting the given version string
     */
    function splitVersionString(str) {
        var tok = /(\d*)\.(\d*)(\w*)(?:\.)?(\d*)(\w*)/i.exec(str);
        if(tok) {
            var major = (tok[1] !== "") ? parseInt(tok[1], 10) : 0,
                minor = (tok[2] !== "") ? parseInt(tok[2], 10) : 0,
                release = (tok[4] !== "") ? parseInt(tok[4], 10) : 0;
            return {
                major: major,
                minor: minor,
                minorStr: tok[3],
                release: release,
                releaseStr: tok[5]
            };
        }
        return {major: 0, minor: 0, minorStr: "", release: 0, releaseStr: ""};
    }

    /**
     * Compares two version strings and returns whether they are the same, the first is greater, or the second is greater
     * @param {String} versionOne First version string
     * @param {String} versionTwo Second version string
     * @returns {Number|int} Returns 0 if versions match, -1 if version one is lesser, and 1 if version one is greater
     */
    function versionCompare(versionOne, versionTwo) {
        var vOne = splitVersionString(versionOne),
            vTwo = splitVersionString(versionTwo);

        // Major
        if(vOne.major > vTwo.major) {
            return 1;
        } else if(vTwo.major > vOne.major) {
            return -1;
        }

        // Minor
        if(vOne.minor > vTwo.minor) {
            return 1;
        } else if(vTwo.minor > vOne.minor) {
            return -1;
        }

        // Minor String
        if(vOne.minorStr === "" && vTwo.minorStr !== "") {
            return 1;
        } else if(vTwo.minorStr === "" && vOne.minorStr !== "") {
            return -1;
        } else if(vOne.minorStr > vTwo.minorStr) {
            return 1;
        } else if(vTwo.minorStr > vOne.minorStr) {
            return -1;
        }

        // Release
        if(vOne.release > vTwo.release) {
            return 1;
        } else if(vTwo.release > vOne.release) {
            return -1;
        }

        // Release String
        if(vOne.releaseStr === "" && vTwo.releaseStr !== "") {
            return 1;
        } else if(vTwo.releaseStr === "" && vOne.releaseStr !== "") {
            return -1;
        } else if(vOne.releaseStr > vTwo.releaseStr) {
            return 1;
        } else if(vTwo.releaseStr > vOne.releaseStr) {
            return -1;
        }

        return 0;
    }

    /**
     * Turns a version string into a GitHub Pages friendly anchor target
     * @param {String} versionStr The version string to convert
     * @returns {String} The resulting GH-Pages friendly anchor target
     */
    function versionToAnchor(versionStr) {
        return "#version-" + versionStr.replace(/\./g, "");
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

        $input = $("#chatInput");
        $tabContainer = $("#tabList");
        $onlineContainer = $("#onlineList");
        $chatContainer = $("#chat");
        $menu = $("#mainMenu");
        $invasion = $("#invasionStatus");

        if(!localStorageSupport) {
            alert("NChatN will not function properly without localStorage support. Please enable it!");
        }

        // For Firefox users (or browsers that support the spellcheck attribute)
        if("spellcheck" in document.createElement("input")) {
            $input.prop("spellcheck", "true");
        }

        createChannel("server", 0, "Lodge");
        focusChannel("server", 0);
        var channel = channelMeta[focusedChannel];

        // Load settings
        _loadSettings();

        // Get value from cookie
        playerName = Util.Cookies.neabGet("RPG", 1);
        // Set value in plugin PluginManager
        pluginManager.setChatValue("playerName", playerName);

        // Load queued plugins
        for(var i = 0; i < queuedPlugins.length; i++) {
            pluginManager.registerPlugin(queuedPlugins[i]);
        }

        var $container = $("<span></span>");
        pluginManager.forEachPlugin(function(plugin) {
            var $inpt = $('<input type="checkbox" ' + ((plugin.active) ? "checked=checked" : "") + '>');
            $inpt.change(function() {
                var checked = $(this).prop("checked");
                if(!checked) {
                    settings.disabledPlugins.push(plugin.name);
                    _saveSettings();
                    pluginManager.deactivatePlugin(plugin.name);
                } else {
                    settings.disabledPlugins.splice(settings.disabledPlugins.indexOf(plugin.name), 1);
                    _saveSettings();
                    pluginManager.activatePlugin(plugin.name);
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
            content: 'NEaB Chat Next (NChatN) version ' + version + ' Copyright 2013 Kevin Ott<br><br>' +
                     'NChatN is licensed under the GNU Public License version 3.<br>' +
                     'A copy of the license is available at ' +
                     '&lt;<a href="http://www.gnu.org/licenses/" target="_blank">http://www.gnu.org/licenses/</a>&gt;.<br><br>' +
                     '<span>If you like what I\'ve done, feel free to thank me for my work.<br>Or if you\'re feeling really ' +
                     'generous, consider giving me a Gittip: ' +
                     '<script data-gittip-username="Etzos" data-gittip-widget="button" src="//gttp.co/v1.js"></script><br>' +
                     'Do both, one, or none!<br>No matter which you pick, I appreciate you giving my chat client a try!' +
                     '</span>'
        });

        var newVersionDialog = new Dialog({
            title: "New Version",
            content: "You are now using NChatN version <b>" + version + "</b>!<br><br>" +
                     "To see a list of changes go to the <a href='http://etzos.github.io/NChatN/" + versionToAnchor(version) + "' target='_blank'>Release Notes</a> page.<br>" +
                     "To disable these messages when NChatN updates, go to <b>Menu -&gt; Settings -&gt; Update Messages</b>"
        });
        // Fill in the Menu
        $menu.html('');


        var mainMenu = new MenuList({
            select: {
                text: "Download Chat",
                description: "Download the current chat history to a file",
                action: function() {
                    var channel = channelMeta[focusedChannel];

                    function downloadRaw(text) {
                        var a = document.createElement("a");
                        document.body.appendChild(a);
                        a.style = "display: none";

                        var blob = new Blob([text], {type: "application/octet-stream"});
                        var src = window.URL.createObjectURL(blob);
                        a.href = src;

                        var time = new Date();
                        // Format: 2013-06-23
                        var timeStr = time.getFullYear() + "-" + numPad(time.getMonth()+1) + "-" + numPad(time.getDate());
                        a.download = "NEaB Chat - "+channel.name+" ["+timeStr+"].html";
                        a.click();

                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }

                    // Grab the NEaB stylesheet for embedding
                    var reg = /http:\/\/(.+?)\//i;
                    var loc = window.location.href.split(reg);
                    var sheet = document.styleSheets[0].href.replace(reg, "http://" + loc[1] + "/");
                    // Horrible code duplication, but it works
                    var sheet2 = document.styleSheets[1].href.replace(reg, "http://" + loc[1] + "/");
                    $.get(sheet, function(data) {
                        $.get(sheet2, function(data2) {
                            var channel = channelMeta[focusedChannel];

                            var $raw = $(channel.elem.chat).clone();
                            $raw.find("img").addBack().filter("img").each(function() {
                                this.src = base64FromImg(this);
                            });
                            var raw = $raw.html();
                            // TODO: Embed at least part of the NChatN stylesheet
                            var page = "<!DOCTYPE html><html>" +
                                    "<head><meta charset='UTF-8'>\n" +
                                    "<script type='text/javascript'>" + openWhoWindow.toString() + "</script>\n" +
                                    "<style>" + data + "</style>\n" +
                                    "<style>" + data2 + "</style>\n" +
                                    "<link href='" + document.styleSheets[1].href + "' rel='stylesheet' type='text/css'>\n" +
                                    "</head>\n"+
                                    "<body style='overflow: auto;'>" + raw + "</body></html>";

                            downloadRaw(page);
                        });
                    });
                    return false;
                }
            },
            updateOnline: {
                text: "Update Online Players",
                description: "Manually refreshes the online player list",
                action: function() {
                    retrieveOnline(channelMeta[focusedChannel]);
                    // TODO: Prevent spamming this
                    return false;
                }
            },
            updateChannels: {
                text: "Update Channel List",
                description: "Manually refreshes the channel list",
                action: function() {
                    updateChannels();
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
            hideOnlineList: {
                text: "Show/Hide Online List",
                decsription: "Shows or hides the online player list",
                action: function() {
                    var $cc = $("#channelContainer");
                    if($cc.hasClass("noPlayers")) {
                        // If at bottom, attempt to restore that
                        var $chatWin = $(channelMeta[focusedChannel].elem.chat);
                        var atBottom = _isAtBottom($chatWin);
                        if(atBottom) {
                            $cc.on("transitionend.NChatNonline", function(e) {
                                if(e.originalEvent.propertyName === "left") {
                                    $chatWin.scrollTop($chatWin.prop("scrollHeight"));
                                    $cc.off("transitionend.NChatNonline");
                                }
                            });
                        }
                        $onlineContainer.show();
                        setTimeout(function() {
                            $cc.removeClass("noPlayers");
                        }, 1);
                    } else {
                        $cc.on("transitionend.NChatNonline", function(e) {
                            if(e.originalEvent.propertyName === "left") {
                                $onlineContainer.hide();
                                $cc.off("transitionend.NChatNonline");
                            }
                        });
                        $cc.addClass("noPlayers");
                    }
                    return false;
                }
            },
            showNewMessages: {
                text: "Alert Self Message [" + (!settings.selfMsgNoDisplay ? "on" : "off") + "]",
                description: "Turn the new message indicator from messages from yourself off/on",
                action: function() {
                    var newVal = !settings.selfMsgNoDisplay;
                    settingMenu.modifyEntry("showNewMessages",
                                            "Alert Self Message [" + (!newVal ? "on" : "off") + "]");
                    changeSetting("selfMsgNoDisplay", newVal);
                    return false;
                }
            },
            versionPopup: {
                text: "Update Messages [" + (settings.versionPopup ? "on" : "off") + "]",
                description: "Turn the popup off/on when NChatN updates",
                action: function() {
                    var newVal = !settings.versionPopup;
                    settingMenu.modifyEntry("versionPopup", "Update Messages [" + (newVal ? "on" : "off") + "]");
                    changeSetting("versionPopup", newVal);
                    return false;
                }
            },
            advanced: {
                text: "Advanced Settings",
                description: "Settings you probably shouldn't mess around with.",
                action: function() {
                    return false;
                }
            }
        });

        var advSettingMenu = new MenuList({
            forceDown: {
                text: "Force to Bottom [" + (settings.forceDown ? "on" : "off") + "]",
                description: "Force the current chat window down to the bottom when new messages are posted",
                action: function() {
                    var newVal = !settings.forceDown;
                    advSettingMenu.modifyEntry("forceDown", "Force Chat to Bottom [" + (newVal ? "on" : "off") + "]");
                    changeSetting("forceDown", newVal);
                    return false;
                }
            },
            showVersion: {
                text: "Show Version Popup",
                action: function() {
                    newVersionDialog.openDialog();
                    return false;
                }
            }
        });
        settingMenu.addMenu("advanced", advSettingMenu);
        mainMenu.addMenu("settings", settingMenu);

        addMenu(mainMenu);

        // Keybinding
        // Input Enter key pressed
        $(window).keydown(function(e) {
            var isInputFocused = $input.is(":focus");
            if(!isInputFocused) {
                return;
            }
            var key = e.keyCode ? e.keyCode : e.which;
            if(key === 13) { // Enter key
                // Check focus
                var $focus = $(this).filter(":focus");
                if($focus.length >= 1) {
                    var id = $focus.attr("id");
                    if($input.attr("id") === id) {
                        $("#chatInputForm").submit();
                    }
                }
            } else if(key === 9) { // Tab Key
                var val = $input.val();
                if(val.length < 1) {
                    return;
                }
                var cursorPos = $input.prop("selectionEnd");
                // TODO: Do something about names with spaces
                // If the cursor is on a non-name character (letters and '-'), then there is nothing to complete
                if(!(/[\w\-]/).test(val.charAt(cursorPos-1))) {
                    return;
                }
                // Cut off anything on the right hand side of cursor
                var namePart = val.substring(0, cursorPos);
                // And everything on the left hand side to the previous space
                var lastSpace = namePart.lastIndexOf(" ");
                if(lastSpace < 0) {
                    lastSpace = 0;
                } else {
                    // If a space is found we don't want to include it
                    lastSpace++;
                }
                var endPos = namePart.length;
                namePart = namePart.substring(lastSpace, endPos);
                // Disinclude non-username characters from the search
                var startPos = namePart.search(/[\w\-]+/);
                namePart = namePart.substring(startPos, endPos);
                var fullStartPos = lastSpace + startPos;

                var match = matchPlayerName(namePart);
                if(match !== "") {
                    $input.val( val.substring(0, fullStartPos) + match + val.substring(endPos, val.length) );
                    var newCursorPos = fullStartPos+match.length;
                    $input[0].setSelectionRange(newCursorPos, newCursorPos);
                }
                $input.focus();
                e.preventDefault();
                e.stopPropagation();
            } else if(key === 38) { // Up arrow key
                var channel = channelMeta[focusedChannel];

                if(channel.bufferPointer > 1) {
                    --channel.bufferPointer;
                } else if(channel.bufferPointer === 0) {
                    channel.bufferPointer = (channel.buffer.length - 1);
                    // Store current val
                    channel.buffer[0] = $input.val();
                }

                $input.val(channel.buffer[channel.bufferPointer]);
            } else if(key === 40) { // Down arrow key
                var channel = channelMeta[focusedChannel];

                if(channel.bufferPointer === 0) { // Can only get as low as current
                    return;
                }

                if(channel.bufferPointer < (channel.buffer.length - 1)) {
                    ++channel.bufferPointer;
                } else if(channel.bufferPointer === (channel.buffer.length - 1)) {
                    channel.bufferPointer = 0;
                }

                $input.val(channel.buffer[channel.bufferPointer]);
            }
        });

        // Event Handlers
        $("#chatInputForm").submit(function() {
            sendMessage();
        });
        // Track page resizing for scroll
        $(window).resize(function() {
            var channel = channelMeta[focusedChannel];
            var $chatWin = $(channel.elem.chat);
            if(channel.atBottom) {
                $chatWin.scrollTop( $chatWin.prop("scrollHeight") );
            } else {
                $chatWin.addClass("historyShade");
            }
        });

        // Timers (Times are default from NEaB)
        // Start Chat Timer
        retrieveAllMessages();
        setInterval(retrieveAllMessages, 4000);
        retrieveAllOnline();
        setInterval(retrieveAllOnline, 16000);

        getInvasionStatus();
        var invasionHeartBeat = setInterval(getInvasionStatus, 20000);

        // This is a special call to joinChat that can't be canceled, it's the initial join
        var ctx = {
            channel: channel,
            firstJoin: true
        };
        pluginManager.runHook("joinChat", ctx);

        // Check versions
        if(localStorageSupport) {
            var pastVersion = localStorage.getItem("NChatN-version");
            if(!pastVersion) {
                pastVersion = "0.0";
            }
            var versionAge = versionCompare(version, pastVersion);
            // Current version is newer than the stored one
            if(versionAge > 0) {
                if(settings.versionPopup === true) {
                    newVersionDialog.openDialog();
                }
            }

            // Always set the version, just to be sure
            localStorage.setItem("NChatN-version", version);
        }

        updateChannels();
    }

    return {
        init: function() {
            init();
        },
        joinChannel: function(chanServerId, name) {
            joinServerChannel(chanServerId, name);
        },
        leaveChannel: function(chanId) {
            removeChannel(chanId);
        },
        selectChannel: function(id) {
            switchChannel(id);
        },
        insertInputText: function(text, focus) {
            $input.val($input.val() + text);
            if(typeof focus === 'undefined' || focus !== false) {
                $input.focus();
            } 
        },
        addPlugin: function(plugin) {
            //return pluginManager.registerPlugin(plugin);
            return queuePlugin(plugin);
        }
    };
})(window, jQuery);

// -- Ancillary functions -- //
/**
 * Toggles the visibility of the help menu
 */
function toggleHelp() {
    $("#chatHelp").toggle();
}

/**
 * Pads a number with a 0 if the number is < 10
 * @param {int} num The number to be padded
 * @returns {String} The resulting padded number
 */
function numPad(num) {
    return num < 10 ? "0" + num : num;
}

function openWhoWindow(player) {
    var base = "../";
    if(window.location.href.indexOf('nowhere-else.org') < 0) {
        base = "http://www.nowhere-else.org/";
    }
    window.open(base + "player_info.php?SEARCH=" + escape(player), "_blank", "dependant=no,height=600,width=430,scrollbars=no");
    return false;
}

/**
 * Returns a base64 data stream from a given img element (always PNG)
 *
 * This was largely inspired by various StackOverflow answers.
 *
 * @param {HTMLImageElement} img - The image element to turn into a data url
 * @return {string} The base64 encoded image
 */
function base64FromImg(img) {
    var cvs = document.createElement("canvas");
    cvs.width = img.naturalWidth;
    cvs.height = img.naturalHeight;

    var ctx = cvs.getContext("2d");
    ctx.drawImage(img, 0, 0);

    return cvs.toDataURL("image/png");
}
