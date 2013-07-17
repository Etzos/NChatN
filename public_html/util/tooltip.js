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
