var tooltip = (function($) {
    var $div;
    
    function init() {
        $div = $('#tooltip');
    }
    
    function setText(text) {
        $div.html(text);
    }
    
    function setPosition(posx, posy) {
        var newTop = (posy-25);
        var newLeft = (posx-$div.outerWidth());
        // Adjust to make sure it can't go off screen
        newTop = newTop < 0 ? 0 : newTop;
        newLeft = newLeft < 0 ? 0 : newLeft;
        // Plave the div
        $div.css({
            'top': newTop, // Move above mouse
            'left': newLeft // Move the tooltip to the left side
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
})(jQuery);
