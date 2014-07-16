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

// Utility Functions
// This function assumes permission was asked for already
function notify(title, msg) {
    if(!("Notification" in window)) {
        return;
    } else if(Notification.permission === "granted") {
        var note = new Notification(title, {body: msg});
    }
}

// Plugins
Chat.addPlugin({
    name: "/who Command",
    description: "Gives basic /who and /whois support. A nice simple plugin",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        send: function(e) {
            var line = e.text;
            if(line.indexOf("/who") === 0 || line.indexOf("/whois") === 0) {
                var textPiece = line.split(" ").splice(1).join("_");
                window.open("player_info.php?SEARCH=" + escape(textPiece), "_blank", "depandant=no,height=600,width=430,scrollbars=no");
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
        joinChat: function(e) {
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
            var $msg = e.message;
            var self = this;
            // Check against online players [TODO]
            // Person doing /pop or /afk
            $msg.filter("span.popin, span.back, span.away, span.action, span.hugs").not(".bot").each(function() {
                self.makeClickable(self.actionPopReg, $(this));
            });

            $msg.filter("span.username").not(".bot").each(function() {
                self.makeClickable(self.messageReg, $(this));
            });
            e.message = $msg;
        }
    },
    globals: {
        makeClickable: function(reg, $obj) {
            //var parts = reg.exec($obj.html());
            //var content = ((parts[1]) ? parts[1] : "") + "<a href='#' class='chatLineName' onClick='openWhoWindow(\"" + parts[2] + "\"); this.blur(); return false;'>" + parts[2] + "</a>" + ((parts[3]) ? parts[3] : "");
            var content = $obj.html().replace(reg, "$1<a href='#' class='chatLineName' onClick='openWhoWindow(\"$2\"); this.blur(); return false;'>$2</a>$3");
            $obj.html(content);
        },
        messageReg: /(to |from )?([\w\- ]+)(\&gt;)/i,
        // Yep, I'm ignoring spaces here because there's no way to know where the username ends and the rest of the popin/action ends
        actionPopReg: /(\*\* |\-\- )([\w\-]+)( )/i
    }
});

Chat.addPlugin({
    name: "Image Preview",
    description: "Makes links to images show a small preview when hovered over",
    author: "Etzos",
    license: "GPLv3",
    globals: {
        /**
         * Binds a hover/leave to an anchor if it's for an image
         * @param {jQuery Object} $anchors A jQuery Object containing a list of anchors to bind events to
         */
        bindAnchors: function($anchors) {
            var imageExtensionReg = /\.(png|jpeg|jpg|gif)$/i;
            $anchors.each(function() {
                var $this = $(this);
                var location = $this.prop("href");
                if(imageExtensionReg.test(location)) {
                    // Mouse in
                    $this.on("mouseenter.NChatNPlugin-ImagePreview", function(e) {
                        var $img = $("<img></img>").prop("src", location).css("visibilty", "hidden");
                        var $prog = $("<progress></progress>").css({
                            width: "100%",
                            height: "100%"
                        });

                        $img.on("load", function() {
                            var $parent = $img.parent();
                            var top = parseInt($parent.css("top"));
                            var height = parseInt($img.css("height"));
                            if((top + height) > document.body.clientHeight) {
                                top = Math.floor(top - height - $this.height());
                            }
                            $parent.css({
                                "width": $img.css("width"),
                                "height": height,
                                "top": top + "px"
                            });
                            $img.css("visibility", "visible");
                            $prog.hide();
                        }).on("error", function() {
                            $("#customImageLoader").remove();
                        });

                        $img.css({"max-height": "240px", "max-width":"240px"});
                        var linkPos = $this.offset();
                        var $div = $("<div></div>")
                        .css({
                            "position":"absolute",
                            "height": "15px",
                            "width": "150px",
                            "top": Math.floor(linkPos.top + $this.height()) + "px",
                            "left": Math.floor(linkPos.left) + "px",
                            "background-color": "lightblue",
                            "overflow": "hidden",
                            "border": "1px solid black",
                            "box-shadow": "0 0 1em gray"
                            })
                        .attr("id", "customImageLoader")
                        .append($prog)
                        .append($img);
                        $("body").append($div);
                    })
                    // Mouse out
                    .on("mouseleave.NChatNPlugin-ImagePreview", function() {
                        $("#customImageLoader").remove();
                    });
                }
            });
            return $anchors;
        }
    },
    hooks: {
        receive: function(e) {
            var $msg = e.message;
            var $anchors = $msg.find("a").addBack().filter("a");
            this.bindAnchors($anchors);
            e.message = $msg;
        }
    },
    onEnable: function() {
        var $anchors = $("#chat").find("a").addBack().filter("a");
        this.bindAnchors($anchors);
    },
    onDisable: function() {
        $("#chat").find("a").addBack().filter("a").off("mouseenter.NChatNPlugin-ImagePreview mouseleave.NChatNPlugin-ImagePreview");
        // TODO: Make sure all extra elements are removed
    }
});

Chat.addPlugin({
    name: "Name Notifier",
    description: "Show a notification when your name is said in chat",
    author: "Etzos",
    license: "GPLv3",
    hooks: {
        receive: function(e) {
            // Don't notify of init messages or if the window is visible
            // TODO: Add a pref and make page focus possibly also be a value
            if(e.isInit || !document.hidden) {
                return;
            }
            // Don't notify if the message came from you
            var pl = e.message.filter("span.username").text();
            if(pl.indexOf(this.getPlayerName()) > -1 || e.message.filter(".whisper.to").length > 0) {
                return;
            }

            var playerNameReg = new RegExp(this.getPlayerName(), "i");
            e.message.filter(function() {
                return this.nodeType === 3; // Text Node type number
            }).each(function() {
                if(playerNameReg.test(this.textContent)) {
                    notify("NChatN", e.message.text());
                    return false;
                }
            });

            /*$msg.each(function() {
                console.log("Running though");
                var text = this.innerHTML;
                console.log("Text:", text);
                if(playerNameReg.test(text)) {
                    console.log("Sending");
                    notify("NChatN : Your Name was Mentioned!", $msg.text());
                    return false;
                }
            });*/
        }
    },
    onEnable: function() {
        if(!("Notification" in window)) {
            return;
        } else if(Notification.permission === "granted") {
            // NOOP
        } else if(Notification.permission !== "denied") {
            Notification.requestPermission(function(perm) {
                Notification.permission = perm;
            });
        }
        Notification.onclick = function() {
            window.focus();
        };
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