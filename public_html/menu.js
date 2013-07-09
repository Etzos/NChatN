var MenuList = function(entryList) {
    var entries = {};
    var $menu = $('<ul class="headerMenu"></ul>');
    
    
    // Merge and check entries
    for(var prop in entryList) {
        if(entries.hasOwnProperty(prop)) {
            console.error("Unable to add menu '" + prop + "'! Entry already exists.");
            continue;
        }
        var entry = entryList[prop];
        
        if(!isValidEntry(entry)) {
            console.error("Invalid entry '" + prop + "'.");
            continue;
        }
        
        // Create entry elments
        var $entry = $("<li></li>");
        var $entryLink = $('<a href="#">'+entry.text+'</a>').attr("id", "menuList-"+prop);
        
        $entryLink.click(entry.action).click(function() {
            // Find a way to close the uppermost menu
            // TODO: This only closes the current menu (and sub menus) *NOT* parent menus!
            close();
        }).appendTo($entry);
        
        if(entry.description) {
            $entryLink.attr("title", entry.description);
        }
        // Save important part
        entry['$link'] = $entryLink;
        
        $menu.append($entry);
        
        entries[prop] = entry;
    }
    
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

        $e.on("mouseover", function() {
            // TODO: Position based on the parent's position!
            var loc = $e.parent().position();
            
            //var first = parseInt($menu.css('right'));
            var second = $menu.width();
            
            //console.log("First part (css right): "+first+" Second part (width): "+second);
            
            entry.child.pos(loc.top, second+4); // The 4 is from the headerMenu class (should be fixed eventually)
            
            entry.child.open();
            
            // Hide when moving to another element in the menu
            $e.parent().siblings('li').children().one("mouseover", function() {
                entry.child.close();
            });
        });
        
        entry['child'] = menu;
        $menu.append(menu.getRoot());
        return true;
    }
    
    function position(top, right) {
        $menu.css({
            'top': top,
            'right': right
        });
    }
    
    function closeChildren() {
        for(var e in entries) {
            var entry = entries[e];
            if(entry.child) {
                entry.child.close();
            }
        }
    }
    
    function close() {
        closeChildren();
        $menu.hide();
    }
    
    return {
        addMenu: function(entryId, menu) {
            return addMenu(entryId, menu);
        },
        getRoot: function() {
            return $menu;
        },
        open: function() {
            $menu.show();
        },
        close: function() {
            close();
        },
        toggle: function() {
            if($menu.css("display") === "none") {
                this.open();
            } else {
                this.close();
            }
        },
        pos: function(top, right) {
            position(top, right);
        }
    };
};
