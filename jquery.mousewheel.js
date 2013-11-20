/*! Copyright (c) 2013 Brandon Aaron (http://brandon.aaron.sh)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Version: 4.0.0-pre
 *
 * Requires: jQuery 1.7+
 */

(function (factory) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS style for Browserify
        module.exports = factory;
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    var toFix  = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'],
        toBind = ( 'onwheel' in document || document.documentMode >= 9 ) ?
                    ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
        slice  = Array.prototype.slice,
        nullLowestDeltaTimeout, lowestDelta;

    if ( $.event.fixHooks ) {
        for ( var i = toFix.length; i; ) {
            $.event.fixHooks[ toFix[--i] ] = $.event.mouseHooks;
        }
    }

    var special = $.event.special.mousewheel = {
        version: '4.0.0-pre',
        setup: function() {
            if ( this.addEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.addEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = handler;
            }
        },

        add: function(handleObj) {
            var data = handleObj.data,
                settings = data && data.mousewheel;
            if ( settings ) {
                if ( "intent" in settings ) {
                    special._intentHandler.call(this, handleObj);
                }
                if ( "throttle" in settings || "debounce" in settings ) {
                    special._delayHandler.call(this, handleObj);
                }
            }
        },

        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.removeEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = null;
            }
        },

        trigger: function(data, event) {
            if (!event) {
                event = data;
                data = null
            }

            handler.call(this, event);

            return false;
        },

        _fix: function(orgEvent) {
            var deltaX   = 0,
                deltaY   = 0,
                absDelta = 0,
                event    = $.event.fix(orgEvent);

            // Old school scrollwheel delta
            if ( 'detail'      in orgEvent ) { deltaY = orgEvent.detail; }
            if ( 'wheelDelta'  in orgEvent ) { deltaY = orgEvent.wheelDelta  * -1; }
            if ( 'wheelDeltaY' in orgEvent ) { deltaY = orgEvent.wheelDeltaY * -1; }
            if ( 'wheelDeltaX' in orgEvent ) { deltaX = orgEvent.wheelDeltaX * -1; }

            // Firefox < 17 horizontal scrolling related to DOMMouseScroll event
            if ( 'axis' in orgEvent && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
                deltaX = deltaY;
                deltaY = 0;
            }

            // New school wheel delta (wheel event)
            if ( 'deltaY' in orgEvent ) { deltaY = orgEvent.deltaY; }
            if ( 'deltaX' in orgEvent ) { deltaX = orgEvent.deltaX; }

            // No change actually happened, no reason to go any further
            if ( deltaY === 0 && deltaX === 0 ) { return; }

            // Store lowest absolute delta to normalize the delta values
            absDelta = Math.max( Math.abs(deltaY), Math.abs(deltaX) );
            if ( !lowestDelta || absDelta < lowestDelta ) {
                lowestDelta = absDelta;
            }

            // Get a whole, normalized value for the deltas
            deltaX = Math[ deltaX >= 1 ? 'floor' : 'ceil' ](deltaX / lowestDelta);
            deltaY = Math[ deltaY >= 1 ? 'floor' : 'ceil' ](deltaY / lowestDelta);

            // Add information to the event object
            event.deltaX = deltaX;
            event.deltaY = deltaY;
            event.deltaFactor = lowestDelta;

            event.type = 'mousewheel';

            return event;
        },

        _intentHandler: function(handleObj) {
            var timeout,
                pos = [],
                hasIntent = false,
                elem = this,
                settings = handleObj.data.mousewheel,
                oldHandler = handleObj.handler,
                newHandler = function(event) {
                    if (hasIntent) {
                        oldHandler.apply(elem, arguments);
                    }
                };
            $(elem).on('mouseenter', function(event) {
                var timeout = setTimeout(function() { hasIntent = true; }, settings.intent);
            }).on('mouseleave', function(event) {
                if (timeout) { clearTimeout(timeout); }
                hasIntent = false;
            });
            handleObj.handler = newHandler;
        },

        _delayHandler: function(handleObj) {
            var timeout,
                elem = this,
                settings = handleObj.data.mousewheel,
                oldHandler = handleObj.handler,
                newHandler = function(event) {
                    var args = arguments;
                    var delayed = function() {
                        oldHandler.apply(elem, args);
                        timeout = null;
                    };
                    if ( "debounce" in settings && timeout ) {
                        clearTimeout(timeout);
                    }
                    if ( "throttle" in settings && !timeout || "debounce" in settings ) {
                        timeout = setTimeout(delayed, (settings.throttle || settings.debounce));
                    }
                };
            handleObj.handler = newHandler;
        }
    };

    function handler(event) {
        // might be trigged event, so check for the originalEvent first
        var orgEvent = event ? event.originalEvent || event : window.event,
            args     = slice.call(arguments, 1);

        event = special._fix(orgEvent);

        // Add event to the front of the arguments
        args.unshift(event);

        // Clearout lowestDelta after sometime to better
        // handle multiple device types that give different
        // a different lowestDelta
        // Ex: trackpad = 3 and mouse wheel = 120
        if (nullLowestDeltaTimeout) { clearTimeout(nullLowestDeltaTimeout); }
        nullLowestDeltaTimeout = setTimeout(nullLowestDelta, 200);

        return $.event.dispatch.apply(this, args);
    }

    function nullLowestDelta() {
        lowestDelta = null;
    }

}));
