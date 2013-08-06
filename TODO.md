TODO
====

For Feature Parity
------------------
- Initial commands
- Various command aliases
  - /help
  - /?
- Clickable usernames

Cool Additions
--------------
- Parse the incoming player list for various tidbits (like if they're
  admins or PHs and away status)
- Support player scripts (see about using the old API, or at least 
  providing compatability with it)
- Intelligent communication with server
  - When checking tabs that aren't open, don't poll every 4 seconds.
    Instead, aim for double that time *until* a new message is actually
    received, then check double or triple that.
- Add a /join command
- Channel-based private communication
- Player filtering (i.e. ignoring a player)
- Saving chat (or sections of it) to a file