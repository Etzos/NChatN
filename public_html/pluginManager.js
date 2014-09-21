/* Copyright (c) 2014 Kevin Ott (aka Etzos) <supercodingmonkey@gmail.com>
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

var PluginManager = function($, Chat) {
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
        send: [],               // Player sends message
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
        isPlayerAction: function (str) {
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
            Chat.sendMessage(message);
        },
        isCurrentChannel: function(channel) {
            return channel === Chat.channelMeta[Chat.focusedChannel];
        },
        getPlayerName: function() {
            return Chat.playerName;
        }
    };

    // The actual event context
    var eventCtx = {
        stopEvent: false,     // Stops the event (can be overridden by a plugin called later)
        stopEventNow: false   // Stops the event immediately (prevents other plugins from running)
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
                console.error("Improper hook register! Trying to add preexisting property: " + prop);
                continue;
            }
            obj[prop] = toMerge[prop];
        }

        return obj;
    }

    function runHook(hookName, additionalContext, ignoreStop) {
        if(typeof ignoreStop === "undefined") {
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

            var plugin = pluginList[runningHook.plugin];
            var runningContext = createContext(thisCtx, plugin.globals);
            try {
                runningHook.fn.apply(runningContext, [eventContext]);
            } catch(e) {
                e.message = pluginTag(plugin) + e.message;
                console.error(e);
            }
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
        if(!plugin.hasOwnProperty("name")) {
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
            if(typeof plugin.hooks[prop] !== "function") {
                console.error(pluginTag(plugin)+"Hook '"+prop+"' is not a function. Plugin may not function properly.");
                continue;
            }
        }

        if(!plugin.hasOwnProperty("description")) {
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
        if(Chat.settings.disabledPlugins.indexOf(plugin.name) > -1) {
            defaultActive = false;
        }

        var registeredHooks = [];
        for(var prop in plugin.hooks) {
            var hookObj = {
                plugin: "plugin" + pluginId,
                fn: plugin.hooks[prop],
                active: defaultActive
            };
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
            globals: (plugin.globals) ? plugin.globals : {},
            hooks: registeredHooks,
            onEnable: (plugin.onEnable) ? plugin.onEnable : null,
            onDisable: (plugin.onDisable) ? plugin.onDisable : null
        };
        if(plugin.hasOwnProperty("onEnable")) {
            try {
                plugin.onEnable.apply(plugin.globals);
            } catch(e) {
                e.message = pluginTag(plugin) + e.message;
                console.error(e);
            }
        }
        return true;
    }

    /**
     * Activates or deactivates the given plugin
     * 
     * @param {string} pluginName The name of the plugin to enable or disable
     * @param {bool} active [Optional] Whether to enable (true) or disable (false) the plugin (Default: toggle
     * current state)
     * @returns {bool} Returns true if the plugin has been enabled or disabled, returns false if the plugin is
     * already enabled/disabled and told to enable or disable respectively
     */
    function changePluginStatus(pluginName, active) {
        var pluginTag = getPluginIdByName(pluginName);
        if(pluginTag === "") {
            console.warn("Unable to find plugin '"+pluginName+"'");
            return false;
        }
        var plugin = pluginList[pluginTag];

        if(typeof active === "undefined") {
            active = !plugin.active;
        } else {
            if(plugin.active === active) {
                return false;
            }
        }

        // Run the plugin's enabled/disabled function (if it has one)
        if(active) {
            if(plugin.hasOwnProperty("onEnable")) {
                try {
                    plugin.onEnable.apply(plugin.globals);
                } catch(e) {
                    e.message = pluginTag(plugin) + e.message;
                    console.error(e);
                }
            }
        } else {
            if(plugin.hasOwnProperty("onDisable")) {
                try {
                    plugin.onDisable.apply(plugin.globals);
                } catch(e) {
                    e.message = pluginTag(plugin) + e.message;
                    console.error(e);
                }
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
        if(plugin === "") {
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
        },
        setChatValue: function(variable, value) {
            Chat[variable] = value;
        }
    };
};