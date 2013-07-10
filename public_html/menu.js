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

var MenuList = function(entryList) {
    var entries = {};
    var $menu = $('<ul class="headerMenu"></ul>');
    var parent = null;
    
    // Merge and check entries
    addEntries(entryList);
    
    // -- Private Functions -- //
    function isValidEntry(entry) {
        if(!entry.hasOwnProperty("text")) {
            console.error("Entry must contain a 'text' property.");
            return false;
        }
        if(entry.hasOwnProperty("action") && typeof entry.action !== "function") {
            console.error("The 'action' property must be a function.");
            return false;
        }
        return true;
    }
    
    function addEntries(entryList) {
        var entry;
        for(entry in entryList) {
            if(entries.hasOwnProperty(entry)) {
                console.error("Unable to add menu '" + entry + "'! Entry already exists.");
                continue;
            }
            addEntry(entry, entryList[entry]);
        }
    }
    
    function addEntry(entryID, entry) {
        if(!isValidEntry(entry)) {
            console.error("Invalid entry '" + entryID + "'.");
            return false;
        }
        
        // Create entry elments
        var $entry = $("<li></li>");
        var $entryLink = $('<a href="#">'+entry.text+'</a>');
        
        $entryLink.click(entry.action).click(function() {
            close();
            this.blur();
        }).appendTo($entry);
        
        if(entry.description) {
            $entryLink.attr("title", entry.description);
        }
        // Save important part
        entry['$link'] = $entryLink;
        
        $menu.append($entry);
        
        entries[entryID] = entry;
        
        return true;
    }
    
    function addMenu(entryId, menu) {
        if(!entries.hasOwnProperty(entryId)) {
            console.error("Entry '" + entryId + "' does not exist.");
            return false;
        } else if(typeof menu !== "object") {
            console.error("Menu must be a MenuList object.");
            return false;
        }
        
        var entry = entries[entryId];
        
        var $e = entry.$link;
        
        $e.prepend("&lt; ");

        $e.on("mouseover", function() {
            var loc = $e.parent().position();
            var menuWidth = $menu.width();
            entry.child.pos(loc.top, menuWidth-1); // Move it back 1 pixel to cover the border
            
            entry.child.openMenu();
            
            // Hide when moving to another element in the menu
            $e.parent().siblings('li').children().one("mouseover", function() {
                entry.child.closeChildren();
            });
        });
        
        entry['child'] = menu;
        $menu.append(menu.getRoot());
        return true;
    }
    
    function updateElem(entryId) {
        var entry = entries[entryId];
        entry.$link.html(entry.text);
    }
    
    function position(top, right) {
        $menu.css({
            'top': top+'px',
            'right': right+'px'
        });
    }
    
    function closeChildren() {
        for(var e in entries) {
            var entry = entries[e];
            if(entry.child) {
                entry.child.closeChildren();
            }
        }
    }
    
    function closeParent() {
        if(parent === null) {
            return;
        }
        parent.closeParent();
    }
    
    function close() {
        closeChildren();
        closeThis();
        closeParent();
    }
    
    function closeThis() {
        $menu.hide();
    }
    
    return {
        addMenu: function(entryId, menu) {
            menu.setParent(this);
            return addMenu(entryId, menu);
        },
        getRoot: function() {
            return $menu;
        },
        openMenu: function() {
            $menu.show();
        },
        closeMenu: function() {
            close();
        },
        toggle: function() {
            if($menu.css("display") === "none") {
                this.openMenu();
            } else {
                this.closeMenu();
            }
        },
        pos: function(top, right) {
            position(top, right);
        },
        addEntries: function(entryList) {
            addEntries(entryList);
        },
        modifyEntry: function(entryId, newText) {
            if(!entries.hasOwnProperty(entryId)) {
                console.error("Entry '" + entryId + "' does not exist.");
                return false;
            }
            entries[entryId].text = newText;
            updateElem(entryId);
        },
        setParent: function(newParent) {
            parent = newParent;
        },
        closeChildren: function() {
            closeChildren();
            closeThis();
        },
        closeParent: function() {
            closeThis();
            closeParent();
        }
    };
};
