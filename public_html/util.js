/**
 * Provides general utilities for various things
 */
var Util = {
    /**
     * Provides methods for dealing with cookies
     */
    Cookies : {
        /**
         * Get a particular cookie key
         * 
         * @param {String} key The cookie key to return
         * @returns {String} Cookie key value
         */
        getValue: function(key) {
            // This is taken from MDN and the cookie.js framework ( https://developer.mozilla.org/en-US/docs/DOM/document.cookie )
            return unescape(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + escape(key).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
        },
        /**
         * Get a value from a cookie NEaB-style
         * 
         * NEaB seperates values inside of cookies further using the slash (/) character.
         * This method just makes access a bit easier.
         * 
         * @param {String} key The cookie key
         * @param {Number} index The NEaB cookie value index
         * @returns {String} The value specified by the key and index, or an empty string
         */
        neabGet: function(key, index) {
            var cookie = this.getValue(key);
            if(cookie === null) {
                return "";
            }
            return this.neabSplit(cookie)[index] || "";
        },
        /**
         * Returns a string split by the slash (/) character
         * 
         * @param {String} str A string to split by slashes
         * @returns {Array[String]} The array of results
         */
        neabSplit: function(str) {
            return str.split("/");
        }
    }
};
