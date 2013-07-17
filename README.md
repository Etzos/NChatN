NEaB Chat Next (NChatN)
=======================
This project was started to fill a need for a better chat client on NEaB

Installing/Running
------------------
Installing and running this client is a bit troublesome at the moment.
There are now two different ways to go about running this chat. You can 
use the bookmarklet or the GreaseMonkey route. The preferred method is 
the GreaseMonkey one. For more details see ./util/index.html

GreaseMonkey
------------
This method has been tested on Firefox and Chrome.
Install GreaseMonkey or Tampermonkey and install the GMShim.user.js
script. Just that simple.

Bookmarklet
-----------
Please note that this method currently only seems to work on Firefox!
I have provided a page called bookmarklet.html in the util/ directory.
That file needs to be put on a web server and opened in a browser. Be 
careful that you do that instead of just running it as a file. Otherwise,
you *will* run into issues! From there, just do what it says on screen.
You will have to modify chat.html to point to web-accessible version of
chat.css and chat.js in order for it to run properly.

License
-------
Copyright (c) 2013 Kevin Ott (aka Etzos) <supercodingmonkey@gmail.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.