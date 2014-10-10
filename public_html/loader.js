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

var Loader = (function(document) {
    var baseUrl = 'https://rawgit.com/Etzos/NChatN/master/public_html/util/';
    //var baseUrl = 'http://garth.web.nowhere-else.org/web/NChatN/'; // Etzos's experimental branch
    
    var queuedFiles = 0;
    var callback = function() {};
    
    function scriptLoaded() {
        queuedFiles--;
        if(queuedFiles < 1) {
            callback();
        }
    }
    
    function importScripts(scripts) {
        if(!Array.isArray(scripts)) {
            scripts = [scripts];
        }
        
        queuedFiles = scripts.length;

        for(var i = 0; i < scripts.length; i++) {
            var scriptElem = document.createElement('script');

            scriptElem.type = 'text/javascript';
            // This should block execution until the script is loaded
            scriptElem.async = false;
            scriptElem.src = baseUrl+scripts[i];
            scriptElem.onload = function() {
                scriptLoaded();
            };
            // TODO: Handle error state

            document.getElementsByTagName('head')[0].appendChild(scriptElem);
        }
    }
    
    return {
        import: function(scripts) {
            importScripts(scripts);
        },
        onComplete: function(func) {
            callback = func;
        }
    };
})(document);

Loader.onComplete(function() {
    try {
        Chat.init();
    } catch(e) {
        console.error(e);
    }
});

Loader.import(['util.js', 'tooltip.js', 'smilies.js', 'menu.js', 'dialog.js', '../pluginManager.js', '../chat.js', '../plugins/corePlugins.js']);
