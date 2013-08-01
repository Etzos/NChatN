/*
 * This is a JavaScript Scratchpad.
 *
 * Enter some JavaScript, then Right Click or choose from the Execute Menu:
 * 1. Run to evaluate the selected text (Ctrl+R),
 * 2. Inspect to bring up an Object Inspector on the result (Ctrl+I), or,
 * 3. Display to insert the result in a comment after the selection. (Ctrl+L)
 */

function removeTime(str) {
    return str.replace(/^<B>.*?<\/B>/ig, "");
};

var chatLine = "<B><FONT COLOR=#336600>21:59</FONT></B> <FONT COLOR=#00C000><B>Garth&gt;</B></FONT> <FONT COLOR=#0000C0>Test</FONT><BR>";

removeTime(chatLine);
