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

var Dialog = function(content) {
    var dialogContent = {};
    var $dialog = $("<div class='dialog'> <div class='dialogContent'>This is a default dialog</div></div>");
    var $dialogTitle = $("<div class='dialogTitle'><span class='dialogTitleContent'>Default Title</span> <a href='#'>[X]</a></div>");
    
    $dialogTitle.mousedown(function(event) {
        var mainPos = $dialog.offset();
        var offset = {
            top: mainPos.top - event.pageY,
            left: mainPos.left - event.pageX
        };
        var $body = $('body');
        
        $body.mousemove(function(event) {            
            $dialog.css({
                top: event.pageY + offset.top,
                left: event.pageX + offset.left
            });
        });
        
        $body.one('mouseup', function() {
            $(this).off('mousemove');
        });
        
        event.preventDefault();
    });
    
    $dialogTitle.prependTo($dialog);
    
    $dialog.find('.dialogTitle a').click(function() {
        closeDialog();
        this.blur();
        return false;
    });
    $dialog.find('.dialogTitleContent').html(content.title);
    // Use append so jQuery objects and other elements can be passed in
    $dialog.find('.dialogContent').append(content.content);
    
    $dialog.appendTo('body');
    
    function closeDialog() {
        // Wait for the transition to finish before hiding
        $dialog.one('transitionend', function() {
            $dialog.hide();
        });
        $dialog.removeClass('dialogOpen');
    }
    
    return {
        /**
         * Opens the dialog to either the default page or the one specified
         * @param {string} page [Optional] The page to open
         * @param {array} options [Optional] The options to pass to the open() function of the page
         */
        openDialog: function(page, options) {
            $dialog.show();
            // Delay since we're changing the display property
            setTimeout(function() {
                $dialog.addClass('dialogOpen');
            }, 1);
        },
        closeDialog: function() {
            closeDialogIn();
        }
    };
};

/*
 * Content formatting should be as follows
 */
var cont = {
    page1: {
        title: "Settings",
        content: "Content is actually plain old HTML. So what you want with it"
    },
    page2: {
        title: "Settings - Scripts",
        content: "This content is going to be dynamically modified",
        back: 'page1',
        open: function() {
            // Put content generating code here
        },
        close: function() {
            // Put content cleanup code here
        }
    }
};
