var chatRoom = (function() {
    var channels = new Array(),
        selectedChannel,
        instance;
    
    function init() {
        // Make sure there is only one
        if(instance === this)
            return;
        instance = this;
        
        channels.push({
            'id': 0,            // Server ID of the channel
            'name': 'Lounge',   // User-friendly name of the channel
            'input': '',        // Contents of the text input (used when switching active channel)
            'scroll': 0         // Scroll location of the channel (this probably isn't needed)
        });
        selectedChannel = 0;
        
        // Handle keybinding
        // Select required elements
        
    }
    
    var eventHandlers = {
        'chatReceive' : function() {
            
        },
        
    };
    
    var public = {
        'joinChannel' : function() {
            
        },
        'leaveChannel' : function() {
            
        },
        'selectChannel' : function() {
            
        }
    };
    
    return public;
});

// Ancillary functions
function toggleHelp() {
    $('#chatHelp').toggle();
}